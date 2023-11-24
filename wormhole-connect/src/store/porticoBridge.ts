import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface PorticoBridgeState {
  slippage: number;
  relayerFee: string;
}

const initialState: PorticoBridgeState = {
  slippage: 0.03,
  relayerFee: '',
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
  },
});

export const { setSlippage, setRelayerFee } = porticoBridgeSlice.actions;

export default porticoBridgeSlice.reducer;
