import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface PorticoBridgeState {
  slippage: number;
  relayerFee: string;
  swapFailedInfo: PorticoSwapFailedInfo | undefined;
}

export interface PorticoSwapFailedInfo {
  message: string;
  swapUrl: string;
  swapUrlText: string;
}

const initialState: PorticoBridgeState = {
  slippage: 0.03,
  relayerFee: '',
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
      state.relayerFee = payload;
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
  setSwapFailedInfo,
  clearPorticoBridgeState,
} = porticoBridgeSlice.actions;

export default porticoBridgeSlice.reducer;
