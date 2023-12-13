import CircularProgress from '@mui/material/CircularProgress';
import { Context } from '@wormhole-foundation/wormhole-connect-sdk';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { CHAINS } from 'config';
import { RootState } from 'store';
import { setRedeemTx, setTransferComplete } from 'store/redeem';
import { displayAddress } from 'utils';
import { TransferDestInfo } from 'routes';
import RouteOperator from 'routes/operator';
import {
  TransferWallet,
  registerWalletSigner,
  switchChain,
} from 'utils/wallet';

import AlertBanner from 'components/AlertBanner';
import Button from 'components/Button';
import InputContainer from 'components/InputContainer';
import { RenderRows } from 'components/RenderRows';
import Spacer from 'components/Spacer';
import WalletsModal from '../WalletModal';
import Header from './Header';
import { estimateClaimGas } from 'utils/gas';
import { isGatewayChain } from '../../utils/cosmos';
import { Route } from 'config/types';
import Switch from 'components/Switch';
import { isPorticoRoute } from 'routes/porticoBridge/utils';
import Tooltip from '@mui/material/Tooltip';
import InfoIcon from 'icons/Info';
import { makeStyles } from 'tss-react/mui';
import { setSwapFailedInfo as setPorticoSwapFailedInfo } from 'store/porticoBridge';

const useStyles = makeStyles()((theme: any) => ({
  flex: {
    display: 'flex',
    alignItems: 'center',
  },
  icon: {
    height: '14px',
    cursor: 'pointer',
  },
  switch: {
    marginRight: '8px',
  },
}));

function SwitchToManualClaim({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
}) {
  const { classes } = useStyles();
  return (
    <div className={classes.flex}>
      {!checked && <span>Waiting for relayer. . .</span>}
      <div className={classes.flex} style={{ marginLeft: 'auto' }}>
        <Switch
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
          className={classes.switch}
        />
        <span>Switch to manual claim</span>
        <Tooltip
          title="Claim your tokens manually. This avoids the relayer fee but requires you to pay the gas fee."
          arrow
        >
          <InfoIcon className={classes.icon} />
        </Tooltip>
      </div>
    </div>
  );
}

function SendTo() {
  const dispatch = useDispatch();
  const {
    redeemTx,
    transferComplete,
    route: routeName,
    signedMessage,
  } = useSelector((state: RootState) => state.redeem);
  const txData = useSelector((state: RootState) => state.redeem.txData)!;
  const wallet = useSelector((state: RootState) => state.wallet.receiving);
  const [claimError, setClaimError] = useState('');
  const [manualClaim, setManualClaim] = useState(false);

  const connect = () => {
    setWalletModal(true);
  };

  const checkConnection = useCallback(() => {
    if (!txData) return;
    const addr = wallet.address.toLowerCase();
    const curAddr = wallet.currentAddress.toLowerCase();
    const reqAddr = txData.recipient.toLowerCase();
    return addr === curAddr && addr === reqAddr;
  }, [wallet, txData]);

  const [inProgress, setInProgress] = useState(false);
  const [isConnected, setIsConnected] = useState(checkConnection());
  const [transferDestInfo, setTransferDestInfo] = useState<TransferDestInfo>();
  const [openWalletModal, setWalletModal] = useState(false);

  // get the redeem tx, for automatic transfers only
  const getRedeemTx = useCallback(async () => {
    if (!routeName) return;
    if (redeemTx) return redeemTx;
    if (signedMessage && routeName) {
      const redeemedTransactionHash = await RouteOperator.tryFetchRedeemTx(
        routeName,
        signedMessage,
      );
      if (redeemedTransactionHash) {
        dispatch(setRedeemTx(redeemedTransactionHash));
        return redeemedTransactionHash;
      }
    }
  }, [redeemTx, routeName, signedMessage, dispatch]);

  useEffect(() => {
    if (!txData || !routeName) return;
    const populate = async () => {
      let receiveTx: string | undefined;
      try {
        receiveTx = await getRedeemTx();
      } catch (e) {
        console.error(`could not fetch redeem event:\n${e}`);
      }
      let gasEstimate;
      if (!receiveTx) {
        gasEstimate = await estimateClaimGas(
          routeName,
          txData.toChain,
          signedMessage,
        );
      }
      await RouteOperator.getTransferDestInfo(routeName, {
        txData,
        receiveTx,
        transferComplete,
        gasEstimate,
      })
        .then((destInfo) => {
          setTransferDestInfo(destInfo);
          if (isPorticoRoute(routeName as Route) && !!destInfo.extraData) {
            dispatch(setPorticoSwapFailedInfo(destInfo.extraData));
          }
        })
        .catch((e) => console.error(e));
    };
    populate();
  }, [
    transferComplete,
    getRedeemTx,
    txData,
    routeName,
    signedMessage,
    dispatch,
  ]);

  useEffect(() => {
    setIsConnected(checkConnection());
  }, [wallet, checkConnection]);

  const isRelayerRoute = useMemo(() => {
    if (!routeName) return false;
    const route = RouteOperator.getRoute(routeName);
    return (
      route.AUTOMATIC_DEPOSIT ||
      isGatewayChain(txData.toChain) ||
      txData.toChain === 'sei' ||
      isPorticoRoute(route.TYPE)
    );
  }, [routeName, txData]);

  const claim = async () => {
    setInProgress(true);
    setClaimError('');
    if (!routeName) {
      throw new Error('Unknown route, cannot claim');
    }
    if (!wallet || !isConnected) {
      setClaimError('Connect to receiving wallet');
      throw new Error('Connect to receiving wallet');
    }
    const chainConfig = CHAINS[txData.toChain]!;
    if (!chainConfig) {
      setClaimError('Your claim has failed, please try again');
      throw new Error('invalid destination chain');
    }
    try {
      if (
        chainConfig!.context === Context.ETH &&
        typeof chainConfig.chainId === 'number'
      ) {
        registerWalletSigner(txData.toChain, TransferWallet.RECEIVING);
        await switchChain(chainConfig.chainId, TransferWallet.RECEIVING);
      }
      if (!signedMessage) {
        throw new Error('failed to get vaa, cannot redeem');
      }
      const txId = await RouteOperator.redeem(
        routeName,
        txData.toChain,
        signedMessage,
        wallet.address,
      );
      dispatch(setRedeemTx(txId));
      dispatch(setTransferComplete(true));
      setInProgress(false);
      setClaimError('');
    } catch (e) {
      setInProgress(false);
      setClaimError('Your claim has failed, please try again');
      console.error(e);
    }
  };

  const showSwitchToManualClaim =
    !transferComplete && isPorticoRoute(routeName as Route);
  const onSwitchToManualClaim = (checked: boolean) => setManualClaim(checked);

  const loading = !isRelayerRoute
    ? inProgress && !transferComplete
    : !transferComplete;
  const manualClaimText =
    transferComplete || isRelayerRoute // todo: should be the other enum, should be named better than payload id
      ? ''
      : claimError
      ? 'Error please retry . . .'
      : 'Claim below';
  return (
    <div>
      <InputContainer>
        <Header
          chain={txData.toChain}
          address={txData.recipient}
          loading={loading}
          txHash={redeemTx}
          text={manualClaimText}
        />
        <>
          {showSwitchToManualClaim && (
            <SwitchToManualClaim
              checked={manualClaim}
              onChange={onSwitchToManualClaim}
              disabled={inProgress}
            />
          )}
        </>
        <RenderRows rows={transferDestInfo?.displayData || []} />
      </InputContainer>

      {/* Claim button for manual transfers */}
      {!transferComplete && (!isRelayerRoute || manualClaim) && (
        <>
          <Spacer height={8} />
          <AlertBanner
            show={!!claimError}
            content={claimError}
            error
            margin="0 0 12px 0"
          />
          {wallet.address ? (
            isConnected ? (
              <Button onClick={claim} action disabled={inProgress}>
                {inProgress ? <CircularProgress size={22} /> : 'Claim'}
              </Button>
            ) : (
              <Button onClick={connect} elevated>
                Connect to {displayAddress(txData.toChain, txData.recipient)}
              </Button>
            )
          ) : (
            <Button onClick={connect} action>
              Connect wallet
            </Button>
          )}
        </>
      )}
      {openWalletModal && (
        <WalletsModal
          type={TransferWallet.RECEIVING}
          chain={txData.toChain}
          onClose={() => setWalletModal(false)}
        />
      )}
      {/* {pending && <Confirmations confirmations={vaa.guardianSignatures} />} */}
    </div>
  );
}

export default SendTo;
