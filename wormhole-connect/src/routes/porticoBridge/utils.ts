import { hexStripZeros } from 'ethers/lib/utils.js';
import {
  CreateOrderRequest,
  CreateOrderResponse,
  PorticoFlagSet,
  PorticoPayload,
} from './types';
import { BigNumber } from 'ethers';
import { Route, TokenConfig } from 'config/types';
import { porticoAbi } from './abis';
import {
  getChainByChainId,
  getWrappedToken,
  isEqualCaseInsensitive,
} from 'utils';
import { TOKENS } from 'config';
import { CHAIN_ID_ETH } from '@certusone/wormhole-sdk/lib/esm/utils/consts';
import { toChainId, wh } from 'utils/sdk';

export const parsePorticoPayload = (buffer: Buffer): PorticoPayload => {
  return {
    flagSet: parseFlagSet(buffer),
    finalTokenAddress: hexStripZeros(buffer.slice(32, 64)),
    recipientAddress: hexStripZeros(buffer.slice(64, 96)),
    canonAssetAmount: hexStripZeros(buffer.slice(96, 128)),
    relayerFee: BigNumber.from(buffer.slice(128, 160)),
  };
};

export const parseFlagSet = (buffer: Buffer): PorticoFlagSet => {
  return {
    recipientChain: buffer.readUInt16LE(0),
    bridgeNonce: buffer.readUInt32LE(2),
    feeTierStart: buffer.readUintLE(6, 3),
    feeTierEnd: buffer.readUintLE(9, 3),
    maxSlippageStart: buffer.readInt16LE(12),
    maxSlippageEnd: buffer.readInt16LE(14),
    shouldWrapNative: !!(buffer.readUInt8(31) & (1 << 0)),
    shouldUnwrapNative: !!(buffer.readUInt8(31) & (1 << 1)),
  };
};

/**
 * Validates that the response from the order creation API matches the request
 * throws an error if there is a mismatch
 */
export const validateCreateOrderResponse = async (
  response: CreateOrderResponse,
  request: CreateOrderRequest,
  startToken: TokenConfig,
): Promise<void> => {
  if (
    !isEqualCaseInsensitive(
      request.porticoAddress || '',
      response.transactionTarget,
    )
  ) {
    throw new Error('portico address mismatch');
  }

  const decoded = porticoAbi.decodeFunctionData(
    'start',
    response.transactionData,
  );
  if (decoded.length !== 1 || decoded[0].length !== 8) {
    throw new Error('decoded length mismatch');
  }

  const flagSetBuffer = Buffer.from(decoded[0][0].slice(2), 'hex');
  if (flagSetBuffer.length !== 32) {
    throw new Error('flag set length mismatch');
  }
  const {
    recipientChain,
    feeTierStart,
    feeTierEnd,
    maxSlippageStart,
    maxSlippageEnd,
    shouldWrapNative,
    shouldUnwrapNative,
  } = parseFlagSet(flagSetBuffer);

  if (recipientChain !== getChainByChainId(request.destinationChainId)?.id) {
    throw new Error('recipient chain mismatch');
  }

  if (feeTierStart !== request.feeTierStart) {
    throw new Error('fee tier start mismatch');
  }

  if (feeTierEnd !== request.feeTierEnd) {
    throw new Error('fee tier end mismatch');
  }

  if (maxSlippageStart !== request.slippageStart) {
    throw new Error('max slippage start mismatch');
  }

  if (maxSlippageEnd !== request.slippageEnd) {
    throw new Error('max slippage end mismatch');
  }

  if (shouldWrapNative !== request.shouldWrapNative) {
    throw new Error('should wrap native mismatch');
  }

  if (shouldUnwrapNative !== request.shouldUnwrapNative) {
    throw new Error('should unwrap native mismatch');
  }

  const startTokenAddress: string = decoded[0][1];
  if (!isEqualCaseInsensitive(startTokenAddress, request.startingToken)) {
    throw new Error('start token address mismatch');
  }

  const canonTokenAddress: string = decoded[0][2];
  if (
    !isEqualCaseInsensitive(
      canonTokenAddress,
      await getCanonicalTokenAddress(startToken),
    )
  ) {
    throw new Error('canon token address mismatch');
  }

  const finalTokenAddress: string = decoded[0][3];
  if (!isEqualCaseInsensitive(finalTokenAddress, request.destinationToken)) {
    throw new Error('final token address mismatch');
  }

  const recipientAddress: string = decoded[0][4];
  if (!isEqualCaseInsensitive(recipientAddress, request.destinationAddress)) {
    throw new Error('recipient address mismatch');
  }

  const destinationPorticoAddress = decoded[0][5];
  if (
    !isEqualCaseInsensitive(
      destinationPorticoAddress,
      request.destinationPorticoAddress || '',
    )
  ) {
    throw new Error('destination portico address mismatch');
  }

  const amountSpecified: BigNumber = decoded[0][6];
  if (amountSpecified.toString() !== request.startingTokenAmount) {
    throw new Error('amount mismatch');
  }

  const relayerFee: BigNumber = decoded[0][7];
  if (relayerFee.toString() !== request.relayerFee) {
    throw new Error('relayer fee mismatch');
  }
};

/**
 * The canonical token address is the foreign asset of the token bridged from Ethereum
 * AKA the "highway" token for the bridge
 */
export const getCanonicalTokenAddress = async (
  token: TokenConfig,
): Promise<string> => {
  const tokenOnEthereum = Object.values(TOKENS).find(
    (t) =>
      t.symbol === token.symbol && toChainId(t.nativeChain) === CHAIN_ID_ETH,
  );
  if (!tokenOnEthereum) {
    throw new Error(`${token.symbol} not found on Ethereum`);
  }
  const { tokenId } = getWrappedToken(tokenOnEthereum);
  if (!tokenId) {
    throw new Error('Canonical token not found');
  }
  const canonicalAddress = await wh.mustGetForeignAsset(
    tokenId,
    token.nativeChain,
  );
  return canonicalAddress;
};

export const isPorticoRoute = (route: Route): boolean => {
  switch (route) {
    case Route.ETHBridge:
    case Route.wstETHBridge:
      return true;
    default:
      return false;
  }
};
