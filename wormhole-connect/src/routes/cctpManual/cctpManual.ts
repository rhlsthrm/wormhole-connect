import {
  ChainId,
  ChainName,
  TokenId,
} from '@wormhole-foundation/wormhole-connect-sdk';
import { BigNumber, utils } from 'ethers';

import { CHAINS, ROUTES, TOKENS, TOKENS_ARR, sdkConfig } from 'config';
import { Route, TokenConfig } from 'config/types';
import {
  MAX_DECIMALS,
  getDisplayName,
  getTokenDecimals,
  toNormalizedDecimals,
} from 'utils';
import { isEvmChain, toChainId, wh } from 'utils/sdk';
import { NO_INPUT } from 'utils/style';
import { TransferWallet, signAndSendTransaction } from 'utils/wallet';
import { toDecimals } from '../../utils/balance';
import { getSolanaAssociatedTokenAccount } from '../../utils/solana';
import { BaseRoute } from '../bridge/baseRoute';
import {
  ManualCCTPMessage,
  SignedCCTPMessage,
  SignedMessage,
  TransferDestInfoBaseParams,
  TransferDisplayData,
  TransferInfoBaseParams,
  UnsignedCCTPMessage,
} from '../types';
import { formatGasFee } from '../utils';
import ManualCCTP from './chains/abstract';
import ManualCCTPEvmImpl from './chains/evm';
import { ManualCCTPSolanaImpl } from './chains/solana';
import {
  CCTPManual_CHAINS,
  CCTPTokenSymbol,
  tryGetCircleAttestation,
} from './utils';

export class CCTPManualRoute extends BaseRoute {
  readonly NATIVE_GAS_DROPOFF_SUPPORTED: boolean = false;
  readonly AUTOMATIC_DEPOSIT: boolean = false;

  isSupportedChain(chain: ChainName): boolean {
    return !!sdkConfig.chains[chain]?.contracts.cctpContracts;
  }

  async isSupportedSourceToken(
    token: TokenConfig | undefined,
    destToken: TokenConfig | undefined,
    sourceChain?: ChainName | ChainId,
    destChain?: ChainName | ChainId,
  ): Promise<boolean> {
    if (!token) return false;
    const sourceChainName = token.nativeChain;
    const sourceChainCCTP =
      CCTPManual_CHAINS.includes(sourceChainName) &&
      (!sourceChain || wh.toChainName(sourceChain) === sourceChainName);

    if (destToken) {
      const destChainName = destToken.nativeChain;
      const destChainCCTP =
        CCTPManual_CHAINS.includes(destChainName) &&
        (!destChain || wh.toChainName(destChain) === destChainName);

      return (
        destToken.symbol === CCTPTokenSymbol &&
        token.symbol === CCTPTokenSymbol &&
        sourceChainCCTP &&
        destChainCCTP
      );
    }
    return token.symbol === CCTPTokenSymbol && sourceChainCCTP;
  }

  async isSupportedDestToken(
    token: TokenConfig | undefined,
    sourceToken: TokenConfig | undefined,
    sourceChain?: ChainName | ChainId,
    destChain?: ChainName | ChainId,
  ): Promise<boolean> {
    if (!token) return false;
    const destChainName = token.nativeChain;
    const destChainCCTP =
      CCTPManual_CHAINS.includes(destChainName) &&
      (!destChain || wh.toChainName(destChain) === destChainName);
    if (sourceToken) {
      const sourceChainName = sourceToken.nativeChain;
      const sourceChainCCTP =
        CCTPManual_CHAINS.includes(sourceChainName) &&
        (!sourceChain || wh.toChainName(sourceChain) === sourceChainName);
      return (
        sourceToken.symbol === CCTPTokenSymbol &&
        token.symbol === CCTPTokenSymbol &&
        sourceChainCCTP &&
        destChainCCTP
      );
    }
    return token.symbol === CCTPTokenSymbol && destChainCCTP;
  }

  async supportedSourceTokens(
    tokens: TokenConfig[],
    destToken?: TokenConfig,
    sourceChain?: ChainName | ChainId,
    destChain?: ChainName | ChainId,
  ): Promise<TokenConfig[]> {
    if (!destToken) return tokens;
    const shouldAdd = await Promise.allSettled(
      tokens.map((token) =>
        this.isSupportedSourceToken(token, destToken, sourceChain, destChain),
      ),
    );
    return tokens.filter((_token, i) => {
      const res = shouldAdd[i];
      return res.status === 'fulfilled' && res.value;
    });
  }

  async supportedDestTokens(
    tokens: TokenConfig[],
    sourceToken?: TokenConfig,
    sourceChain?: ChainName | ChainId,
    destChain?: ChainName | ChainId,
  ): Promise<TokenConfig[]> {
    if (!sourceToken) return tokens;
    const shouldAdd = await Promise.allSettled(
      tokens.map((token) =>
        this.isSupportedDestToken(token, sourceToken, sourceChain, destChain),
      ),
    );
    return tokens.filter((_token, i) => {
      const res = shouldAdd[i];
      return res.status === 'fulfilled' && res.value;
    });
  }

  async isRouteAvailable(
    sourceToken: string,
    destToken: string,
    amount: string,
    sourceChain: ChainName | ChainId,
    destChain: ChainName | ChainId,
  ): Promise<boolean> {
    if (!ROUTES.includes(Route.CCTPManual)) {
      return false;
    }

    const sourceTokenConfig = TOKENS[sourceToken];
    const destTokenConfig = TOKENS[destToken];

    if (!sourceChain || !destChain || !sourceTokenConfig || !destTokenConfig)
      return false;

    const sourceChainName = wh.toChainName(sourceChain);
    const destChainName = wh.toChainName(destChain);

    if (sourceChainName === destChainName) return false;
    if (sourceTokenConfig.symbol !== CCTPTokenSymbol) return false;
    if (destTokenConfig.symbol !== CCTPTokenSymbol) return false;
    if (sourceTokenConfig.nativeChain !== sourceChainName) return false;
    if (destTokenConfig.nativeChain !== destChainName) return false;

    return (
      CCTPManual_CHAINS.includes(sourceChainName) &&
      CCTPManual_CHAINS.includes(destChainName)
    );
  }

  async computeReceiveAmount(
    sendAmount: number | undefined,
    routeOptions: any,
  ): Promise<number> {
    if (!sendAmount) return 0;
    return sendAmount;
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
    return this.getImplementation(sendingChain).estimateSendGas(
      token,
      amount,
      sendingChain,
      senderAddress,
      recipientChain,
      recipientAddress,
      routeOptions,
    );
  }

  async estimateClaimGas(
    destChain: ChainName | ChainId,
    signedMessage?: SignedMessage,
  ): Promise<BigNumber> {
    throw new Error('not implemented');
  }

  /**
   * These operations have to be implemented in subclasses.
   */
  getMinSendAmount(routeOptions: any): number {
    return 0;
  }

  async send(
    token: TokenId | 'native',
    amount: string,
    sendingChain: ChainName | ChainId,
    senderAddress: string,
    recipientChain: ChainName | ChainId,
    recipientAddress: string,
    routeOptions: any,
  ): Promise<string> {
    const recipientAccount =
      wh.toChainName(recipientChain) === 'solana'
        ? await getSolanaAssociatedTokenAccount(
            token,
            sendingChain,
            recipientAddress,
          )
        : recipientAddress;

    const tx = await this.getImplementation(sendingChain).send(
      token,
      amount,
      sendingChain,
      senderAddress,
      recipientChain,
      recipientAccount,
    );
    const txId = await signAndSendTransaction(
      wh.toChainName(sendingChain),
      tx,
      TransferWallet.SENDING,
    );
    wh.registerProviders();
    return txId;
  }

  async redeem(
    destChain: ChainName | ChainId,
    message: SignedMessage,
    payer: string,
  ): Promise<string> {
    const tx = await this.getImplementation(destChain).redeem(
      destChain,
      message,
      payer,
    );
    const txId = await signAndSendTransaction(
      wh.toChainName(destChain),
      tx,
      TransferWallet.RECEIVING,
    );
    wh.registerProviders();
    return txId;
  }

  public async getPreview(
    token: TokenConfig,
    destToken: TokenConfig,
    amount: number,
    sendingChain: ChainName | ChainId,
    receipientChain: ChainName | ChainId,
    sendingGasEst: string,
    claimingGasEst: string,
    routeOptions?: any,
  ): Promise<TransferDisplayData> {
    const sendingChainName = wh.toChainName(sendingChain);
    const receipientChainName = wh.toChainName(receipientChain);
    const sourceGasToken = CHAINS[sendingChainName]?.gasToken;
    const destinationGasToken = CHAINS[receipientChainName]?.gasToken;
    const sourceGasTokenSymbol = sourceGasToken
      ? getDisplayName(TOKENS[sourceGasToken])
      : '';
    const destinationGasTokenSymbol = destinationGasToken
      ? getDisplayName(TOKENS[destinationGasToken])
      : '';
    return [
      {
        title: 'Amount',
        value: `${amount} ${getDisplayName(destToken)}`,
      },
      {
        title: 'Total fee estimates',
        value:
          sendingGasEst && claimingGasEst
            ? `${sendingGasEst} ${sourceGasTokenSymbol} & ${claimingGasEst} ${destinationGasTokenSymbol}`
            : '',
        rows: [
          {
            title: 'Source chain gas estimate',
            value: sendingGasEst
              ? `~ ${sendingGasEst} ${sourceGasTokenSymbol}`
              : 'Not available',
          },
          {
            title: 'Destination chain gas estimate',
            value: claimingGasEst
              ? `~ ${claimingGasEst} ${destinationGasTokenSymbol}`
              : 'Not available',
          },
        ],
      },
    ];
  }

  async getRelayerFee(
    sourceChain: ChainName | ChainId,
    destChain: ChainName | ChainId,
    token: string,
  ): Promise<BigNumber> {
    return BigNumber.from(0);
  }

  async getForeignAsset(
    token: TokenId,
    chain: ChainName | ChainId,
  ): Promise<string | null> {
    // assumes USDC
    const addr = TOKENS_ARR.find(
      (t) =>
        t.symbol === CCTPTokenSymbol &&
        t.nativeChain === chain &&
        t.tokenId?.chain === chain,
    )?.tokenId?.address;
    if (!addr) throw new Error('USDC not found');
    return addr;
  }

  async getMessage(
    tx: string,
    chain: ChainName | ChainId,
  ): Promise<ManualCCTPMessage> {
    return this.getImplementation(chain).getMessage(tx, chain);
  }

  async getSignedMessage(
    unsigned: UnsignedCCTPMessage,
  ): Promise<SignedCCTPMessage> {
    const { message } = unsigned;

    const messageHash = utils.keccak256(message);
    const signedAttestation = await tryGetCircleAttestation(messageHash);
    if (!signedAttestation) throw new Error('Could not get attestation');

    return {
      ...unsigned,
      attestation: signedAttestation,
    };
  }

  async getTransferSourceInfo({
    txData,
  }: TransferInfoBaseParams): Promise<TransferDisplayData> {
    const formattedAmt = toNormalizedDecimals(
      txData.amount,
      txData.tokenDecimals,
      MAX_DECIMALS,
    );
    const { gasToken: sourceGasTokenKey } = CHAINS[txData.fromChain]!;
    const sourceGasToken = TOKENS[sourceGasTokenKey];
    const decimals = getTokenDecimals(
      toChainId(sourceGasToken.nativeChain),
      'native',
    );
    const formattedGas =
      txData.gasFee && toDecimals(txData.gasFee, decimals, MAX_DECIMALS);
    const token = TOKENS[txData.tokenKey];

    return [
      {
        title: 'Amount',
        value: `${formattedAmt} ${getDisplayName(token)}`,
      },
      {
        title: 'Gas fee',
        value: formattedGas
          ? `${formattedGas} ${getDisplayName(sourceGasToken)}`
          : NO_INPUT,
      },
    ];
  }

  async getTransferDestInfo({
    txData,
    receiveTx,
    gasEstimate,
  }: TransferDestInfoBaseParams): Promise<TransferDisplayData> {
    const token = TOKENS[txData.tokenKey];
    const { gasToken } = CHAINS[txData.toChain]!;

    let gas = gasEstimate;
    if (receiveTx) {
      const gasFee = await wh.getTxGasFee(txData.toChain, receiveTx);
      if (gasFee) {
        gas = formatGasFee(txData.toChain, gasFee);
      }
    }

    const formattedAmt = toNormalizedDecimals(
      txData.amount,
      txData.tokenDecimals,
      MAX_DECIMALS,
    );
    return [
      {
        title: 'Amount',
        value: `${formattedAmt} ${getDisplayName(token)}`,
      },
      {
        title: receiveTx ? 'Gas fee' : 'Gas estimate',
        value: gas ? `${gas} ${getDisplayName(TOKENS[gasToken])}` : NO_INPUT,
      },
    ];
  }

  async isTransferCompleted(
    destChain: ChainName | ChainId,
    messageInfo: SignedCCTPMessage,
  ): Promise<boolean> {
    return this.getImplementation(destChain).isTransferCompleted(
      destChain,
      messageInfo,
    );
  }

  async tryFetchRedeemTx(
    txData: UnsignedCCTPMessage,
  ): Promise<string | undefined> {
    return undefined; // only for automatic routes
  }

  private getImplementation(chain: ChainId | ChainName): ManualCCTP {
    if (isEvmChain(chain)) {
      return new ManualCCTPEvmImpl();
    } else if (wh.toChainName(chain) === 'solana') {
      return new ManualCCTPSolanaImpl();
    }
    throw new Error(`No CCTP implementation for chain ${chain}`);
  }
}
