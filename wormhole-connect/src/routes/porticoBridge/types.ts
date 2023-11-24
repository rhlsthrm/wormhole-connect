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

export interface PorticoSwapFailedInfo {
  message: string;
  swapUrl: string;
  swapUrlText: string;
}

export interface RelayerQuoteRequest {
  target_chain: number; // wormhole chain ID
  source_token: string;
  target_token: string;
}

export interface RelayerQuoteResponse {
  fee: number; // TODO: how can this be a number
  valid_until: string;
}
