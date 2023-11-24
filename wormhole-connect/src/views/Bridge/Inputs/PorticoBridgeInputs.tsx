import React from 'react';
import { ButtonGroup, Button } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import Tooltip from '@mui/material/Tooltip';
import { makeStyles } from 'tss-react/mui';
import { useSelector } from 'react-redux';
import { RootState } from 'store';
import { useDispatch } from 'react-redux';
import { setSlippage } from 'store/porticoBridge';
import { joinClass } from 'utils/style';
import InfoIcon from 'icons/Info';

const useStyles = makeStyles()((theme: any) => ({
  title: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
  },
  slippage: {
    fontSize: '14px',
    fontWeight: 500,
    marginLeft: '8px',
  },
  text: {
    fontSize: '14px',
    fontWeight: 500,
  },
  icon: {
    height: '14px',
    cursor: 'pointer',
    position: 'relative',
  },
  inputs: {
    display: 'flex',
    alignItems: 'center',
    height: '40px',
    gap: '8px',
  },
  input: {
    width: '56px',
    height: '36.5px',
    padding: '0px',
    outline: 'none',
    borderRadius: '4px',
    border: 'none',
    opacity: '0.5',
    marginRight: '4px',
    backgroundColor: 'transparent',
    '::placeholder': {
      color: '#bdbdbd',
    },
  },
  percentSign: {
    height: '36.5px',
    padding: '0 8px',
    borderRadius: '4px',
    border: '1px solid #bdbdbd',
    color: '#bdbdbd',
  },
  warningText: {
    color: theme.palette.warning[500],
    fontSize: '14px',
  },
  warningIcon: {
    color: theme.palette.warning[500],
    height: '14px',
  },
  warningReason: {
    color: theme.palette.warning[500],
    fontSize: '12px',
  },
  warningBorder: {
    border: `1px solid ${theme.palette.warning[500]}`,
  },
}));

const minSlippage = 0.01;
const maxSlippage = 100;
const highSlippage = 1;
const lowSlippage = 0.01;
const predefinedValues = ['0.03', '0.05', '0.15'];

const PorticoBridgeInputs = () => {
  const { classes } = useStyles();
  const { slippage } = useSelector((state: RootState) => state.porticoBridge);
  const [customSlippage, setCustomSlippage] = React.useState<string>('');
  const dispatch = useDispatch();

  const handleCustomSlippageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const { value } = event.target;
    if (!value || value.match(/^\d+(\.\d{0,2})?$/)) {
      setCustomSlippage(value);
      const parsedValue = parseFloat(value);
      if (
        !isNaN(parsedValue) &&
        parsedValue >= minSlippage &&
        parsedValue <= maxSlippage
      ) {
        dispatch(setSlippage(parsedValue));
      }
    }
  };

  const warningMessage =
    slippage >= highSlippage
      ? 'High slippage tolerance may result in an unfavorable trade.'
      : slippage <= lowSlippage
      ? 'Low slippage tolerance may result in a failed trade.'
      : undefined;

  return (
    <>
      <div className={classes.title}>
        <div className={classes.text}>Slippage Tolerance</div>
        <Tooltip
          title="Your transaction will revert on the source or destination chain if the actual output amount deviates from the expected amount by more than this percentage."
          arrow
          placement="top"
        >
          <InfoIcon className={classes.icon} />
        </Tooltip>
        <div
          className={joinClass([
            classes.slippage,
            !!warningMessage && classes.warningText,
          ])}
        >
          {slippage}%
        </div>
        {!!warningMessage ? (
          <>
            <WarningIcon className={classes.warningIcon} />
            <div className={classes.warningReason}>{warningMessage}</div>
          </>
        ) : null}
      </div>
      <div className={classes.inputs}>
        <ButtonGroup color="secondary">
          {predefinedValues.map((value) => (
            <Button
              key={value}
              variant={
                Number(slippage) === Number(value) ? 'contained' : 'outlined'
              }
              onClick={() => {
                dispatch(setSlippage(Number(value)));
                setCustomSlippage('');
              }}
            >
              {`${value}%`}
            </Button>
          ))}
        </ButtonGroup>
        <span
          className={joinClass([
            classes.percentSign,
            !!warningMessage && classes.warningBorder,
          ])}
        >
          <input
            value={customSlippage}
            onChange={handleCustomSlippageChange}
            placeholder="Custom"
            className={classes.input}
          />
          %
        </span>
      </div>
    </>
  );
};

export default PorticoBridgeInputs;
