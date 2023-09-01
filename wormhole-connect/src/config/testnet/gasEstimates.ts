import { GasEstimates } from '../types';

export const TESTNET_GAS_ESTIMATES: GasEstimates = {
  goerli: {
    sendNative: 100000,
    sendToken: 150000,
    sendNativeWithRelay: 200000,
    sendTokenWithRelay: 300000,
    sendCCTPWithRelay: 300000,
    sendCCTPManual: 150000,
    claim: 200000,
  },
  mumbai: {
    sendNative: 200000,
    sendToken: 150000,
    sendNativeWithRelay: 200000,
    sendTokenWithRelay: 250000,
    claim: 200000,
  },
  bsc: {
    sendNative: 100000,
    sendToken: 200000,
    sendNativeWithRelay: 200000,
    sendTokenWithRelay: 300000,
    claim: 175000,
  },
  fuji: {
    sendNative: 100000,
    sendToken: 150000,
    sendNativeWithRelay: 200000,
    sendTokenWithRelay: 300000,
    sendCCTPWithRelay: 300000,
    sendCCTPManual: 150000,
    claim: 200000,
  },
  fantom: {
    sendNative: 150000,
    sendToken: 150000,
    sendNativeWithRelay: 200000,
    sendTokenWithRelay: 300000,
    claim: 200000,
  },
  alfajores: {
    sendNative: 100000,
    sendToken: 100000,
    sendNativeWithRelay: 300000,
    sendTokenWithRelay: 300000,
    claim: 175000,
  },
  moonbasealpha: {
    sendNative: 100000,
    sendToken: 200000,
    sendNativeWithRelay: 200000,
    sendTokenWithRelay: 300000,
    claim: 200000,
  },
  solana: {
    sendNative: 15000,
    sendToken: 15000,
    claim: 25000,
  },
  sui: {
    sendNative: 20000000,
    sendToken: 20000000,
    sendNativeWithRelay: 20000000,
    sendTokenWithRelay: 20000000,
    claim: 20000000,
  },
  aptos: {
    sendNative: 34,
    sendToken: 34,
    claim: 615,
  },
  sei: {
    claim: 1000000,
    sendNative: 1000000,
    sendToken: 1000000,
  },
  basegoerli: {
    claim: 100000,
    sendNative: 1000000,
    sendToken: 1000000,
  },
  wormchain: {
    sendNative: 0,
    sendToken: 0,
    claim: 0,
  },
  osmosis: {
    sendNative: 0,
    sendToken: 0,
    claim: 0,
  },
};
