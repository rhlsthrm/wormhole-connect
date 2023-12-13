import { SendResult } from '@wormhole-foundation/wormhole-connect-sdk';

import { Wallet } from '@xlabs-libs/wallet-aggregator-core';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CloverWalletAdapter,
  Coin98WalletAdapter,
  SlopeWalletAdapter,
  SolongWalletAdapter,
  TorusWalletAdapter,
  ExodusWalletAdapter,
  BackpackWalletAdapter,
  NightlyWalletAdapter,
  BloctoWalletAdapter,
  BraveWalletAdapter,
} from '@solana/wallet-adapter-wallets';

import {
  clusterApiUrl,
  ConfirmOptions,
  Connection,
  Transaction,
} from '@solana/web3.js';

import { SolanaWallet } from '@xlabs-libs/wallet-aggregator-solana';

import { ENV, RPCS } from 'config';

const tag = ENV === 'MAINNET' ? 'mainnet-beta' : 'devnet';
const connection = new Connection(RPCS.solana || clusterApiUrl(tag));

const solanaWallets = {
  phantom: new SolanaWallet(new PhantomWalletAdapter(), connection),
  solflare: new SolanaWallet(new SolflareWalletAdapter(), connection),
  clover: new SolanaWallet(new CloverWalletAdapter(), connection),
  coin98: new SolanaWallet(new Coin98WalletAdapter(), connection),
  slope: new SolanaWallet(new SlopeWalletAdapter(), connection),
  solong: new SolanaWallet(new SolongWalletAdapter(), connection),
  torus: new SolanaWallet(new TorusWalletAdapter(), connection),
  exodus: new SolanaWallet(new ExodusWalletAdapter(), connection),
  backpack: new SolanaWallet(new BackpackWalletAdapter(), connection),
  nightly: new SolanaWallet(new NightlyWalletAdapter(), connection),
  blocto: new SolanaWallet(new BloctoWalletAdapter(), connection),
  brave: new SolanaWallet(new BraveWalletAdapter(), connection),
};

export function fetchOptions() {
  return solanaWallets;
}

export async function signAndSendTransaction(
  transaction: SendResult,
  wallet: Wallet | undefined,
  options?: ConfirmOptions,
) {
  if (!wallet || !wallet.signAndSendTransaction) {
    throw new Error('wallet.signAndSendTransaction is undefined');
  }

  return await (wallet as SolanaWallet).signAndSendTransaction({
    transaction: transaction as Transaction,
    options,
  });
}
