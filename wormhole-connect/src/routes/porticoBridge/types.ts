import { BigNumber } from 'ethers';

export interface CreateOrderRequest {
  startingChainId: number;
  startingToken: string;
  startingTokenAmount: string;
  destinationToken: string;
  destinationAddress: string;
  destinationChainId: number;
  relayerFee: string;
  feeTierStart?: number;
  feeTierEnd?: number;
  slippageStart?: number;
  slippageEnd?: number;
  bridgeNonce?: number;
  shouldWrapNative?: boolean;
  shouldUnwrapNative?: boolean;
  porticoAddress?: string;
  destinationPorticoAddress?: string;
}

export interface CreateOrderResponse {
  transactionData: string;
  transactionTarget: string;
  transactionValue: string;
  startParameters: string[];
  estimatedAmountOut: string;
}

export interface PorticoFlagSet {
  recipientChain: number;
  bridgeNonce: number;
  feeTierStart: number;
  feeTierEnd: number;
  maxSlippageStart: number;
  maxSlippageEnd: number;
  shouldWrapNative: boolean;
  shouldUnwrapNative: boolean;
}

export interface PorticoPayload {
  flagSet: PorticoFlagSet;
  finalTokenAddress: string;
  recipientAddress: string;
  canonAssetAmount: string;
  relayerFee: BigNumber;
}

export interface RelayerQuoteRequest {
  targetChain: number;
  sourceToken: string;
  targetToken: string;
}

export interface RelayerQuoteResponse {
  fee: string;
  validUntil: string;
}
