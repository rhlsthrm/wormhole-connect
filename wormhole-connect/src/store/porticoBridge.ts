import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  DataWrapper,
  errorDataWrapper,
  fetchDataWrapper,
  getEmptyDataWrapper,
  receiveDataWrapper,
} from './helpers';

export interface PorticoBridgeState {
  slippage: number;
  relayerFee: DataWrapper<string>;
  swapFailedInfo: PorticoSwapFailedInfo | undefined;
}

export interface PorticoSwapFailedInfo {
  message: string;
  swapUrl: string;
  swapUrlText: string;
}

const initialState: PorticoBridgeState = {
  slippage: 0.03,
  relayerFee: getEmptyDataWrapper(),
  swapFailedInfo: undefined,
};

export const porticoBridgeSlice = createSlice({
  name: 'porticoBridge',
  initialState,
  reducers: {
    setSlippage: (
      state: PorticoBridgeState,
      { payload }: PayloadAction<number>,
    ) => {
      state.slippage = payload;
    },
    setRelayerFee: (
      state: PorticoBridgeState,
      { payload }: PayloadAction<string>,
    ) => {
      state.relayerFee = receiveDataWrapper(payload);
    },
    setFetchingRelayerFee: (
      state: PorticoBridgeState,
      { payload }: PayloadAction<void>,
    ) => {
      state.relayerFee = fetchDataWrapper();
    },
    setRelayerFeeError: (
      state: PorticoBridgeState,
      { payload }: PayloadAction<string>,
    ) => {
      state.relayerFee = errorDataWrapper(payload);
    },
    setSwapFailedInfo: (
      state: PorticoBridgeState,
      { payload }: PayloadAction<PorticoSwapFailedInfo | undefined>,
    ) => {
      state.swapFailedInfo = payload;
    },
    clearPorticoBridgeState: () => initialState,
  },
});

export const {
  setSlippage,
  setRelayerFee,
  setFetchingRelayerFee,
  setRelayerFeeError,
  setSwapFailedInfo,
  clearPorticoBridgeState,
} = porticoBridgeSlice.actions;

export default porticoBridgeSlice.reducer;
