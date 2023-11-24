import React from 'react';
import { makeStyles } from 'tss-react/mui';
import { PorticoSwapFailedInfo } from 'routes/porticoBridge/types';
import WarningIcon from '@mui/icons-material/Warning';

const useStyles = makeStyles()((theme: any) => ({
  link: {
    color: theme.palette.text.primary,
    textDecoration: 'underline',
    cursor: 'pointer',
  },
  root: {
    display: 'flex',
    gap: '8px',
  },
  warningIcon: {
    color: theme.palette.warning[500],
  },
}));

const PorticoSwapFailed = ({
  info: { message, swapUrl, swapUrlText },
}: {
  info: PorticoSwapFailedInfo;
}) => {
  const { classes } = useStyles();
  return (
    <div className={classes.root}>
      <WarningIcon className={classes.warningIcon} />
      <div>
        {message}{' '}
        <a
          href={swapUrl}
          target="_blank"
          rel="noreferrer"
          className={classes.link}
        >
          {swapUrlText}
        </a>
      </div>
    </div>
  );
};

export default PorticoSwapFailed;
