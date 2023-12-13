import { BigNumber, ethers } from 'ethers';
import {
  ChainId,
  ChainName,
  EthContext,
  TokenId,
  WormholeContext,
} from '@wormhole-foundation/wormhole-connect-sdk';
import { TokenConfig } from 'config/types';
import {
  SignedMessage,
  UnsignedMessage,
  TokenTransferMessage,
  SignedTokenTransferMessage,
  TransferDisplayData,
  TransferInfoBaseParams,
  TransferDestInfo,
} from '../types';
import { fetchGlobalTx, fetchVaa, getEmitterAndSequence } from 'utils/vaa';
import { hexlify, parseUnits } from 'ethers/lib/utils.js';
import { BaseRoute } from '../bridge';
import { PayloadType, isEvmChain, toChainId, toChainName, wh } from 'utils/sdk';
import { CHAINS, ROUTES, TOKENS, isMainnet } from 'config';
import {
  MAX_DECIMALS,
  getChainConfig,
  getDisplayName,
  getGasToken,
  getTokenById,
  getTokenDecimals,
  getWrappedToken,
  isEqualCaseInsensitive,
  toNormalizedDecimals,
} from 'utils';
import { CreateOrderRequest, CreateOrderResponse } from './types';
import axios from 'axios';
import { TransferWallet, signAndSendTransaction } from 'utils/wallet';
import { porticoSwapFinishedEvent } from './abis';
import { getQuote } from './uniswapQuoter';
import { toDecimals } from 'utils/balance';
import { CREATE_ORDER_API_URL, FEE_TIER, OKU_TRADE_BASE_URL } from './consts';
import { adaptParsedMessage } from 'routes/utils';
import { TransferDestInfoParams } from 'routes/relay';
import { NO_INPUT } from 'utils/style';
import {
  getCanonicalTokenAddress,
  parsePorticoPayload,
  validateCreateOrderResponse,
} from './utils';
import { PorticoBridgeState, PorticoSwapFailedInfo } from 'store/porticoBridge';

export abstract class PorticoBridge extends BaseRoute {
  readonly NATIVE_GAS_DROPOFF_SUPPORTED: boolean = false;
  readonly AUTOMATIC_DEPOSIT: boolean = false;

  constructor(protected supportedTokenSymbols: string[]) {
    super();
  }

  isSupportedChain(chain: ChainName): boolean {
    const { portico, uniswapQuoterV2 } = wh.getContracts(chain) || {};
    return !!(portico && uniswapQuoterV2);
  }

  async isSupportedSourceToken(
    token: TokenConfig | undefined,
    destToken: TokenConfig | undefined,
    sourceChain?: ChainName | ChainId,
    destChain?: ChainName | ChainId,
  ): Promise<boolean> {
    if (!token || !sourceChain || !this.isSupportedToken(token, sourceChain)) {
      return false;
    }
    if (
      destChain &&
      destToken &&
      !this.isSupportedToken(destToken, destChain)
    ) {
      return false;
    }
    return true;
  }

  async isSupportedDestToken(
    token: TokenConfig | undefined,
    sourceToken: TokenConfig | undefined,
    sourceChain?: ChainName | ChainId,
    destChain?: ChainName | ChainId,
  ): Promise<boolean> {
    if (!token || !destChain || !this.isSupportedToken(token, destChain)) {
      return false;
    }
    if (
      sourceChain &&
      sourceToken &&
      !this.isSupportedToken(sourceToken, sourceChain)
    ) {
      return false;
    }
    return true;
  }

  isSupportedToken(token: TokenConfig, chain: ChainName | ChainId): boolean {
    return (
      this.isSupportedChain(token.nativeChain) &&
      this.supportedTokenSymbols.includes(token.symbol) &&
      toChainName(chain) === token.nativeChain
    );
  }

  async isRouteAvailable(
    sourceToken: string,
    destToken: string,
    amount: string,
    sourceChain: ChainName | ChainId,
    destChain: ChainName | ChainId,
  ): Promise<boolean> {
    if (!isMainnet || !ROUTES.includes(this.TYPE)) {
      return false;
    }
    const sourceTokenConfig = TOKENS[sourceToken];
    if (
      !sourceTokenConfig ||
      !this.isSupportedToken(sourceTokenConfig, sourceChain)
    ) {
      return false;
    }
    const destTokenConfig = TOKENS[destToken];
    if (
      !destTokenConfig ||
      !this.isSupportedToken(destTokenConfig, destChain)
    ) {
      return false;
    }
    return true;
  }

  async computeReceiveAmount(
    sendAmount: number,
    token: string,
    destToken: string,
    sendingChain: ChainName | undefined,
    recipientChain: ChainName | undefined,
    routeOptions: PorticoBridgeState,
  ): Promise<number> {
    if (
      !sendAmount ||
      !destToken ||
      !sendingChain ||
      !recipientChain ||
      !routeOptions.relayerFee ||
      // TODO: the caller should be responsible for making sure the route is available
      !(await this.isRouteAvailable(
        token,
        destToken,
        sendAmount.toString(),
        sendingChain,
        recipientChain,
      ))
    ) {
      return 0;
    }
    const startToken = getWrappedToken(TOKENS[token]);
    if (!startToken.tokenId) {
      throw new Error('Unable to get start token');
    }
    const finalToken = getWrappedToken(TOKENS[destToken]);
    if (!finalToken.tokenId) {
      throw new Error('Unable to get final token');
    }
    const startCanonToken = await getCanonicalTokenAddress(startToken);
    const startTokenDecimals = getTokenDecimals(
      toChainId(sendingChain),
      startToken.tokenId,
    );
    const parsedSendAmount = parseUnits(
      sendAmount.toString(),
      startTokenDecimals,
    );
    const startQuote = await getQuote(
      sendingChain,
      startToken.tokenId.address,
      startCanonToken,
      parsedSendAmount.toString(),
      FEE_TIER,
    );
    const destCanonToken = await getCanonicalTokenAddress(finalToken);
    const destQuote = await getQuote(
      recipientChain,
      destCanonToken,
      finalToken.tokenId.address,
      startQuote.amountOut.toString(),
      FEE_TIER,
    );
    const relayerFee = BigNumber.from(routeOptions.relayerFee);
    if (destQuote.amountOut.lt(relayerFee)) {
      throw new Error('Amount can not be less than relayer fee');
    }
    const estimatedAmountOut = destQuote.amountOut.sub(relayerFee);
    const destTokenDecimals = getTokenDecimals(
      toChainId(recipientChain),
      finalToken.tokenId,
    );
    const parsedEstimatedAmountOut = toDecimals(
      estimatedAmountOut,
      destTokenDecimals,
      MAX_DECIMALS,
    );
    return Number(parsedEstimatedAmountOut);
  }

  async computeSendAmount(
    receiveAmount: number | undefined,
    routeOptions: any,
  ): Promise<number> {
    if (!receiveAmount) return 0;
    return receiveAmount;
  }

  async validate(
    token: TokenId | 'native',
    amount: string,
    sendingChain: ChainName | ChainId,
    senderAddress: string,
    recipientChain: ChainName | ChainId,
    recipientAddress: string,
    routeOptions: any,
  ): Promise<boolean> {
    throw new Error('not implemented');
  }

  async estimateSendGas(
    token: TokenId | 'native',
    amount: string,
    sendingChain: ChainName | ChainId,
    senderAddress: string,
    recipientChain: ChainName | ChainId,
    recipientAddress: string,
    routeOptions?: any,
  ): Promise<BigNumber> {
    throw new Error('not implemented');
  }

  async estimateClaimGas(
    destChain: ChainName | ChainId,
    signedMessage?: SignedMessage,
  ): Promise<BigNumber> {
    throw new Error('not implemented');
  }

  getMinSendAmount(
    routeOptions: PorticoBridgeState,
    destToken: string,
    recipientChain?: ChainName | ChainId,
  ): number {
    if (
      !routeOptions ||
      !routeOptions.relayerFee ||
      !destToken ||
      !recipientChain
    ) {
      return 0;
    }
    // need to at least cover the relayer fee
    const relayerFee = BigNumber.from(routeOptions.relayerFee);
    const tokenId =
      destToken === 'native' ? 'native' : TOKENS[destToken].tokenId;
    const decimals = getTokenDecimals(toChainId(recipientChain), tokenId);
    const minAmount = toDecimals(relayerFee, decimals, MAX_DECIMALS);
    return parseFloat(minAmount);
  }

  async send(
    token: TokenId | 'native',
    amount: string,
    sendingChain: ChainName | ChainId,
    senderAddress: string,
    recipientChain: ChainName | ChainId,
    recipientAddress: string,
    destToken: string,
    routeOptions: PorticoBridgeState,
  ): Promise<string> {
    if (!isEvmChain(sendingChain) || !isEvmChain(recipientChain)) {
      throw new Error('Only EVM chains are supported');
    }
    const { slippage, relayerFee } = routeOptions;
    if (!slippage) {
      throw new Error('slippage is required');
    }
    if (!relayerFee) {
      throw new Error('relayerFee is required');
    }
    const slippageBps = slippage * 100;
    if (slippageBps < 1 || slippageBps > 10000) {
      throw new Error('slippage must be between 0.01% and 100%');
    }
    const sourceChainConfig = getChainConfig(sendingChain);
    if (!sourceChainConfig) {
      throw new Error('Unsupported source chain');
    }
    const destChainConfig = getChainConfig(recipientChain);
    if (!destChainConfig) {
      throw new Error('Unsupported dest chain');
    }
    const sourceGasToken = getGasToken(sendingChain);
    const isStartTokenNative =
      token === 'native' || getTokenById(token)!.key === sourceGasToken.key;
    const startToken = isStartTokenNative
      ? getWrappedToken(sourceGasToken)
      : getTokenById(token);
    if (!startToken?.tokenId) {
      throw new Error('Unsupported start token');
    }
    const destGasToken = getGasToken(recipientChain);
    const isDestTokenNative =
      destToken === 'native' || destToken === destGasToken.key;
    const finalToken = isDestTokenNative
      ? getWrappedToken(destGasToken)
      : TOKENS[destToken];
    if (!finalToken?.tokenId) {
      throw new Error('Unsupported dest token');
    }
    const porticoAddress = wh.mustGetContracts(sendingChain).portico;
    if (!porticoAddress) {
      throw new Error('Portico address not found');
    }
    const destinationPorticoAddress =
      wh.mustGetContracts(recipientChain).portico;
    if (!destinationPorticoAddress) {
      throw new Error('Destination portico address not found');
    }
    const decimals = getTokenDecimals(toChainId(sendingChain), token);
    const parsedAmount = parseUnits(amount, decimals);

    // Create the order
    const request: CreateOrderRequest = {
      startingChainId: Number(sourceChainConfig.chainId),
      startingToken: startToken.tokenId.address,
      startingTokenAmount: parsedAmount.toString(),
      destinationToken: finalToken.tokenId.address,
      destinationAddress: recipientAddress,
      destinationChainId: Number(destChainConfig.chainId),
      relayerFee,
      feeTierStart: FEE_TIER,
      feeTierEnd: FEE_TIER,
      slippageStart: slippageBps,
      slippageEnd: slippageBps,
      shouldWrapNative: isStartTokenNative,
      shouldUnwrapNative: isDestTokenNative,
      porticoAddress,
      destinationPorticoAddress,
    };
    const response = await axios.post<CreateOrderResponse>(
      CREATE_ORDER_API_URL,
      request,
    );
    if (response.status !== 200) {
      throw new Error(`Error creating order: ${response.statusText}`);
    }

    // Validate the response
    await validateCreateOrderResponse(response.data, request, startToken);

    // Approve the token if necessary
    if (!isStartTokenNative) {
      const sendingContext = wh.getContext(
        sendingChain,
      ) as EthContext<WormholeContext>;
      await sendingContext.approve(
        sendingChain,
        porticoAddress,
        startToken.tokenId.address,
        parsedAmount,
      );
    }

    // Sign and send the transaction
    const signer = wh.mustGetSigner(sendingChain);
    const transaction = {
      to: porticoAddress,
      data: response.data.transactionData,
      value: isStartTokenNative ? parsedAmount : undefined,
    };
    const tx = await signer.sendTransaction(transaction);
    const receipt = await tx.wait();
    const txId = await signAndSendTransaction(
      toChainName(sendingChain),
      receipt,
      TransferWallet.SENDING,
    );
    return txId;
  }

  async redeem(
    destChain: ChainName | ChainId,
    message: SignedTokenTransferMessage,
    payer: string,
  ): Promise<string> {
    // allow manual redeems in case it wasn't relayed
    const signer = wh.mustGetSigner(destChain);
    const { portico } = wh.mustGetContracts(destChain);
    if (!portico) {
      throw new Error('Portico address not found');
    }
    const contract = new ethers.Contract(
      portico,
      ['function receiveMessageAndSwap(bytes)'],
      signer,
    );
    const transaction =
      await contract.populateTransaction.receiveMessageAndSwap(message.vaa);
    const tx = await signer.sendTransaction(transaction);
    const receipt = await tx.wait();
    const txId = await signAndSendTransaction(
      toChainName(destChain),
      receipt,
      TransferWallet.RECEIVING,
    );
    return txId;
  }

  async getRelayerFee(
    sourceChain: ChainName | ChainId,
    destChain: ChainName | ChainId,
    token: string,
    destToken?: string,
  ): Promise<BigNumber> {
    return BigNumber.from('0');
    /*
    if (!destToken) {
      throw new Error('destToken is required');
    }
    const sourceToken = getWrappedToken(
      token === 'native' ? getGasToken(sourceChain) : TOKENS[token],
    );
    const targetToken = getWrappedToken(
      destToken === 'native' ? getGasToken(destChain) : TOKENS[destToken],
    );
    const request: RelayerQuoteRequest = {
      target_chain: toChainId(destChain),
      source_token: sourceToken.tokenId?.address!,
      target_token: targetToken.tokenId?.address!,
    };
    const response = await axios.post<RelayerQuoteResponse>(
      RELAYER_FEE_API_URL,
      request,
    );
    if (response.status !== 200) {
      throw new Error(`Error getting relayer fee: ${response.statusText}`);
    }
    return BigNumber.from(response.data.fee);
    */
  }

  async getForeignAsset(
    token: TokenId,
    chain: ChainName | ChainId,
  ): Promise<string | null> {
    return await wh.getForeignAsset(token, chain);
  }

  async getMessage(
    tx: string,
    chain: ChainName | ChainId,
  ): Promise<UnsignedMessage> {
    const message = await wh.getMessage(tx, chain, false);
    const adaptedMessage = await adaptParsedMessage(message);
    if (adaptedMessage.payloadID !== PayloadType.Automatic) {
      throw new Error('Invalid payload type');
    }
    const payloadBuffer = Buffer.from(adaptedMessage.payload!.slice(2), 'hex');
    const { recipientAddress } = parsePorticoPayload(payloadBuffer);
    adaptedMessage.recipient = recipientAddress;
    return adaptedMessage;
  }

  async getSignedMessage(
    message: TokenTransferMessage,
  ): Promise<SignedTokenTransferMessage> {
    const vaa = await fetchVaa(message);

    if (!vaa) {
      throw new Error('VAA not found');
    }

    return {
      ...message,
      vaa: hexlify(vaa.bytes),
    };
  }

  async nativeTokenAmount(
    destChain: ChainName | ChainId,
    token: TokenId,
    amount: BigNumber,
    walletAddress: string,
  ): Promise<BigNumber> {
    throw new Error('Not supported');
  }

  async maxSwapAmount(
    destChain: ChainName | ChainId,
    token: TokenId,
    walletAddress: string,
  ): Promise<BigNumber> {
    throw new Error('Not supported');
  }

  async tryFetchRedeemTx(txData: UnsignedMessage): Promise<string | undefined> {
    const redeemTx = await fetchGlobalTx(txData);
    if (redeemTx) {
      return redeemTx;
    }
    const { emitterChain, emitterAddress, sequence } =
      getEmitterAndSequence(txData);
    const context = wh.getContext(
      txData.toChain,
    ) as EthContext<WormholeContext>;
    const tokenBridge = context.contracts.mustGetBridge(txData.toChain);
    const { maxBlockSearch } = CHAINS[txData.toChain]!;
    const filter = tokenBridge.filters.TransferRedeemed(
      emitterChain,
      `0x${emitterAddress}`,
      sequence,
    );
    try {
      const currentBlock = await context.getCurrentBlock(txData.toChain);
      const events = await tokenBridge.queryFilter(
        filter,
        currentBlock - maxBlockSearch,
      );
      if (events.length > 0) {
        return events[0].transactionHash;
      }
    } catch {}
    return undefined;
  }

  async getTransferSourceInfo({
    txData,
  }: TransferInfoBaseParams): Promise<TransferDisplayData> {
    const formattedAmount = toNormalizedDecimals(
      txData.amount,
      txData.tokenDecimals,
      MAX_DECIMALS,
    );
    const gasToken = getGasToken(txData.fromChain);
    const gasTokenDecimals = getTokenDecimals(
      toChainId(gasToken.nativeChain),
      'native',
    );
    const formattedGasFee =
      txData.gasFee &&
      toDecimals(txData.gasFee, gasTokenDecimals, MAX_DECIMALS);
    const payloadBuffer = Buffer.from(txData.payload!.slice(2), 'hex');
    const {
      flagSet: { shouldWrapNative, shouldUnwrapNative, maxSlippageStart },
      relayerFee,
      finalTokenAddress,
    } = parsePorticoPayload(payloadBuffer);
    const token = shouldWrapNative ? gasToken : TOKENS[txData.tokenKey];
    const destToken = shouldUnwrapNative
      ? getGasToken(txData.toChain)
      : getTokenById({ chain: txData.toChain, address: finalTokenAddress });
    if (!destToken) {
      throw new Error('Unable to find dest token');
    }
    const destTokenDecimals = getTokenDecimals(
      toChainId(txData.toChain),
      destToken.tokenId,
    );
    const formattedFee = toDecimals(
      relayerFee,
      destTokenDecimals,
      MAX_DECIMALS,
    );
    return [
      {
        title: 'Amount',
        value: `${formattedAmount} ${getDisplayName(token)}`,
      },
      {
        title: 'Gas fee',
        value: formattedGasFee
          ? `${formattedGasFee} ${getDisplayName(gasToken)}`
          : NO_INPUT,
      },
      {
        title: 'Relayer fee',
        value: `${formattedFee} ${getDisplayName(destToken)}`,
      },
      {
        title: 'Slippage tolerance',
        value: `${maxSlippageStart / 100}%`,
      },
    ];
  }

  async getTransferDestInfo({
    txData,
    receiveTx,
    transferComplete,
  }: TransferDestInfoParams): Promise<TransferDestInfo> {
    if (!receiveTx) {
      return { displayData: [] };
    }
    const provider = wh.mustGetProvider(txData.toChain);
    const receipt = await provider.getTransactionReceipt(receiveTx);
    const payloadBuffer = Buffer.from(txData.payload!.slice(2), 'hex');
    const {
      finalTokenAddress,
      flagSet: { shouldUnwrapNative },
    } = parsePorticoPayload(payloadBuffer);
    const swapFinishedLog = receipt.logs.find(
      (log) => log.topics[0] === porticoSwapFinishedEvent,
    );
    if (!swapFinishedLog) {
      throw new Error('Swap finished log not found');
    }
    // handle the case for when the swap failed
    const swapCompleted = swapFinishedLog.data.slice(0, 66).endsWith('1');
    if (
      !swapCompleted &&
      !isEqualCaseInsensitive(finalTokenAddress, txData.tokenAddress)
    ) {
      const decimals = getTokenDecimals(
        toChainId(txData.toChain),
        txData.tokenId,
      );
      const formattedAmount = toNormalizedDecimals(
        txData.amount,
        decimals,
        MAX_DECIMALS,
      );
      const receivedTokenDisplayName = getDisplayName(
        TOKENS[txData.receivedTokenKey],
      );
      const canonicalTokenAddress = await wh.getForeignAsset(
        txData.tokenId,
        txData.toChain,
      );
      if (!canonicalTokenAddress) {
        throw new Error('Canonical token address not found');
      }
      const extraData: PorticoSwapFailedInfo = {
        message: `The swap reverted on ${
          getChainConfig(txData.toChain).displayName
        } and you received Wormhole-wrapped ${receivedTokenDisplayName} instead. You can retry the swap here:`,
        swapUrl: `${OKU_TRADE_BASE_URL}/${txData.toChain}/swap/${canonicalTokenAddress}/${finalTokenAddress}`,
        swapUrlText: 'Oku Trade',
      };
      return {
        displayData: [
          {
            title: 'Amount',
            value: `${formattedAmount} ${receivedTokenDisplayName}`,
          },
          {
            title: 'Relayer fee',
            value: NO_INPUT,
          },
        ],
        extraData,
      };
    }
    // handle the case for when the swap succeeds
    const finalUserAmount = BigNumber.from(
      `0x${swapFinishedLog.data.slice(66, 130)}`,
    );
    const relayerFeeAmount = BigNumber.from(
      `0x${swapFinishedLog.data.slice(130, 194)}`,
    );
    const finalToken = shouldUnwrapNative
      ? getGasToken(txData.toChain)
      : getTokenById({ chain: txData.toChain, address: finalTokenAddress })!;
    const decimals = getTokenDecimals(
      toChainId(txData.toChain),
      shouldUnwrapNative ? 'native' : finalToken.tokenId,
    );
    const formattedFinalUserAmount = toDecimals(
      finalUserAmount,
      decimals,
      MAX_DECIMALS,
    );
    const formattedRelayerFee = toDecimals(
      relayerFeeAmount,
      decimals,
      MAX_DECIMALS,
    );
    const finalTokenDisplayName = getDisplayName(finalToken);
    return {
      displayData: [
        {
          title: 'Amount',
          value: `${formattedFinalUserAmount} ${finalTokenDisplayName}`,
        },
        {
          title: 'Relayer fee',
          value: `${formattedRelayerFee} ${finalTokenDisplayName}`,
        },
      ],
    };
  }

  async getPreview(
    token: TokenConfig,
    destToken: TokenConfig,
    amount: number,
    sendingChain: ChainName | ChainId,
    receipientChain: ChainName | ChainId,
    sendingGasEst: string,
    claimingGasEst: string,
    receiveAmount: string,
    routeOptions: PorticoBridgeState,
  ): Promise<TransferDisplayData> {
    const { relayerFee, slippage } = routeOptions;
    const sendingChainName = toChainName(sendingChain);
    const sourceGasToken = getGasToken(sendingChainName);
    const sourceGasTokenDisplayName = sourceGasToken
      ? getDisplayName(sourceGasToken)
      : '';
    const destTokenDisplayName = getDisplayName(destToken);
    const destChainConfig = getChainConfig(receipientChain);
    const destTokenDecimals =
      destToken.key === destChainConfig.gasToken
        ? destChainConfig.nativeTokenDecimals
        : getTokenDecimals(toChainId(receipientChain), destToken.tokenId);
    let totalFeesText = '';
    let fee = '';
    if (sendingGasEst && relayerFee) {
      fee = toDecimals(relayerFee, destTokenDecimals, MAX_DECIMALS);
      totalFeesText = `${sendingGasEst} ${sourceGasTokenDisplayName} & ${fee} ${destTokenDisplayName}`;
    }
    return [
      {
        title: 'Amount estimate',
        value: `${receiveAmount} ${destTokenDisplayName}`,
      },
      {
        title: 'Slippage tolerance',
        value: `${slippage}%`,
      },
      {
        title: 'Total fee estimates',
        value: totalFeesText,
        rows: [
          {
            title: 'Source chain gas estimate',
            value: sendingGasEst
              ? `~ ${sendingGasEst} ${sourceGasTokenDisplayName}`
              : NO_INPUT,
          },
          {
            title: 'Relayer fee',
            value: fee ? `${fee} ${destTokenDisplayName}` : NO_INPUT,
          },
        ],
      },
    ];
  }
}
