import {
  ChainId,
  ChainName,
  Context,
  SendResult,
} from '@wormhole-foundation/wormhole-connect-sdk';
import { postVaaSolanaWithRetry } from '@certusone/wormhole-sdk';
import { ContractReceipt } from 'ethers';
import { NotSupported, Wallet } from '@xlabs-libs/wallet-aggregator-core';

import { wh } from 'utils/sdk';
import { CHAINS, CHAINS_ARR } from 'config';
import { getChainByChainId } from 'utils';

import { AssetInfo } from './evm';

export enum TransferWallet {
  SENDING = 'sending',
  RECEIVING = 'receiving',
}

let walletConnection = {
  sending: undefined as Wallet | undefined,
  receiving: undefined as Wallet | undefined,
};

export const walletAcceptedChains = (
  context: Context | undefined,
): ChainName[] => {
  if (!context) {
    return CHAINS_ARR.map((c) => c.key);
  }
  return CHAINS_ARR.filter((c) => c.context === context).map((c) => c.key);
};

export const setWalletConnection = (type: TransferWallet, wallet: Wallet) => {
  walletConnection[type] = wallet;
};

export const getWalletConnection = (type: TransferWallet) => {
  return walletConnection[type];
};

export const swapWalletConnections = () => {
  const temp = walletConnection.sending;
  walletConnection.sending = walletConnection.receiving;
  walletConnection.receiving = temp;
};

export const registerWalletSigner = (
  chain: ChainName | ChainId,
  type: TransferWallet,
) => {
  const w = walletConnection[type]! as any;
  if (!w) throw new Error('must connect wallet');
  const signer = w.getSigner();
  wh.registerSigner(chain, signer);
};

export const switchChain = async (
  chainId: number | string,
  type: TransferWallet,
): Promise<string | undefined> => {
  const w: Wallet = walletConnection[type]! as any;
  if (!w) throw new Error('must connect wallet');

  const config = getChainByChainId(chainId)!;
  const currentChain = w.getNetworkInfo().chainId;
  if (currentChain === chainId) return;
  if (config.context === Context.ETH) {
    try {
      // some wallets may not support chain switching
      let { switchChain } = await import('utils/wallet/evm');
      await switchChain(w, chainId as number);
    } catch (e) {
      if (e instanceof NotSupported) return;
      throw e;
    }
  }
  if (config.context === Context.COSMOS) {
    let { switchChain } = await import('utils/wallet/cosmos');
    await switchChain(w, chainId as string);
  }
  return w.getAddress();
};

export const disconnect = async (type: TransferWallet) => {
  const w = walletConnection[type]! as any;
  if (!w) return;
  await w.disconnect();
};

export const watchAsset = async (asset: AssetInfo, type: TransferWallet) => {
  const wallet = walletConnection[type]!;
  let { watchAsset } = await import('utils/wallet/evm');
  await watchAsset(asset, wallet);
};

export const signAndSendTransaction = async (
  chain: ChainName,
  transaction: SendResult,
  walletType: TransferWallet,
): Promise<string> => {
  const chainConfig = CHAINS[chain]!;

  const wallet = walletConnection[walletType];
  if (!wallet) {
    throw new Error('wallet is undefined');
  }

  switch (chainConfig.context) {
    case Context.ETH: {
      return (transaction as ContractReceipt).transactionHash;
    }
    case Context.SOLANA: {
      let { signAndSendTransaction } = await import('utils/wallet/solana');
      const tx = await signAndSendTransaction(transaction, wallet);
      return tx.id;
    }
    case Context.SUI: {
      let { signTransaction } = await import('utils/wallet/sui');
      const tx = await signTransaction(transaction, wallet);
      return tx.id;
    }
    case Context.APTOS: {
      let { signAndSendTransaction } = await import('utils/wallet/aptos');
      let tx = await signAndSendTransaction(transaction, wallet);
      return tx.id;
    }
    case Context.SEI: {
      let { signTransaction } = await import('utils/wallet/sei');
      const tx = await signTransaction(transaction, wallet);
      return tx.id;
    }
    case Context.COSMOS: {
      let { signAndSendTransaction } = await import('utils/wallet/cosmos');
      const tx = await signAndSendTransaction(transaction, wallet);
      return tx.id;
    }
    default:
      throw new Error(`Invalid context ${chainConfig.context}`);
  }
};

export const postVaa = async (
  connection: any,
  coreContract: string,
  signedVAA: Buffer,
) => {
  const wallet = walletConnection.receiving;
  if (!wallet) throw new Error('not connected');
  const pk = (wallet as any).adapter.publicKey;
  const MAX_VAA_UPLOAD_RETRIES_SOLANA = 5;

  await postVaaSolanaWithRetry(
    connection,
    wallet.signTransaction.bind(wallet), // Solana Wallet Signer
    coreContract,
    pk.toString(),
    Buffer.from(signedVAA),
    MAX_VAA_UPLOAD_RETRIES_SOLANA,
  );
};
