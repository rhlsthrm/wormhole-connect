import { CHAIN_ID_SOLANA } from '@certusone/wormhole-sdk';
import { BN, EventParser, Program, utils } from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import {
  PublicKey,
  Transaction,
  SystemProgram,
  AccountMeta,
} from '@solana/web3.js';
import {
  ChainId,
  ChainName,
  SolanaContext,
  TokenId,
  WormholeContext,
} from '@wormhole-foundation/wormhole-connect-sdk';
import { utils as ethUtils } from 'ethers';
import { PayloadType, wh } from 'utils/sdk';
import { getTokenById, getTokenDecimals } from '../../../utils';
import {
  SignedMessage,
  UnsignedCCTPMessage,
  isSignedCCTPMessage,
} from '../../types';
import {
  MessageTransmitter,
  MessageTransmitterIdl,
} from '../idl/MessageTransmitter';
import { TokenMessenger, TokenMessengerIdl } from '../idl/TokenMessenger';
import { getChainNameCCTP, getDomainCCTP } from './chains';
import { getNativeVersionOfToken } from '../../../store/transferInput';
import { TOKENS } from '../../../config';

const CCTP_NONCE_OFFSET = 12;

interface FindProgramAddressResponse {
  publicKey: PublicKey;
  bump: number;
}

interface DepositForBurnLogData {
  nonce: BN;
  burnToken: PublicKey;
  amount: BN;
  depositor: PublicKey;
  mintRecipient: PublicKey;
  destinationDomain: number;
  destinationTokenMessenger: PublicKey;
  destinationCaller: PublicKey;
}

const findProgramAddress = (
  label: string,
  programId: PublicKey,
  extraSeeds?: (string | number[] | Buffer | PublicKey)[],
): FindProgramAddressResponse => {
  const seeds = [Buffer.from(utils.bytes.utf8.encode(label))];
  if (extraSeeds) {
    for (const extraSeed of extraSeeds) {
      if (typeof extraSeed === 'string') {
        seeds.push(Buffer.from(utils.bytes.utf8.encode(extraSeed)));
      } else if (Array.isArray(extraSeed)) {
        seeds.push(Buffer.from(extraSeed as number[]));
      } else if (Buffer.isBuffer(extraSeed)) {
        seeds.push(extraSeed);
      } else {
        seeds.push(extraSeed.toBuffer());
      }
    }
  }
  const res = PublicKey.findProgramAddressSync(seeds, programId);
  return { publicKey: res[0], bump: res[1] };
};

function getMessageTransmitter(): Program<MessageTransmitter> {
  const context = wh.getContext(
    CHAIN_ID_SOLANA,
  ) as SolanaContext<WormholeContext>;
  const connection = context.connection;
  const contracts =
    context.contracts.mustGetContracts(CHAIN_ID_SOLANA).cctpContracts;
  if (!contracts?.cctpMessageTransmitter || !contracts?.cctpTokenMessenger) {
    throw new Error('No CCTP on Solana');
  }
  return new Program<MessageTransmitter>(
    MessageTransmitterIdl,
    contracts.cctpMessageTransmitter,
    connection ? { connection } : undefined,
  );
}

function getTokenMessenger(): Program<TokenMessenger> {
  const context = wh.getContext(
    CHAIN_ID_SOLANA,
  ) as SolanaContext<WormholeContext>;
  const connection = context.connection;
  const contracts =
    context.contracts.mustGetContracts(CHAIN_ID_SOLANA).cctpContracts;
  if (!contracts?.cctpMessageTransmitter || !contracts?.cctpTokenMessenger) {
    throw new Error('No CCTP on Solana');
  }
  return new Program<TokenMessenger>(
    TokenMessengerIdl,
    contracts.cctpTokenMessenger,
    connection ? { connection } : undefined,
  );
}

export async function sendFromSolana(
  token: TokenId | 'native',
  amount: string,
  sendingChain: ChainName | ChainId,
  senderAddress: string,
  recipientChain: ChainName | ChainId,
  recipientAddress: string,
): Promise<Transaction> {
  const fromChainId = wh.toChainId(sendingChain);
  const decimals = getTokenDecimals(fromChainId, token);
  const parsedAmt = ethUtils.parseUnits(amount, decimals);

  if (token === 'native')
    throw new Error('Native not supported by cctp routes');

  const recipientChainName = wh.toChainName(recipientChain);
  const destinationDomain = wh.conf.chains[recipientChainName]?.cctpDomain;
  if (destinationDomain === undefined)
    throw new Error(`No CCTP on ${recipientChainName}`);

  const messageTransmitterProgram = getMessageTransmitter();
  const tokenMessengerMinterProgram = getTokenMessenger();

  const tokenMint = new PublicKey(token.address);

  // Find pdas
  const messageTransmitterAccount = findProgramAddress(
    'message_transmitter',
    messageTransmitterProgram.programId,
  );
  const tokenMessenger = findProgramAddress(
    'token_messenger',
    tokenMessengerMinterProgram.programId,
  );
  const tokenMinter = findProgramAddress(
    'token_minter',
    tokenMessengerMinterProgram.programId,
  );
  const localToken = findProgramAddress(
    'local_token',
    tokenMessengerMinterProgram.programId,
    [tokenMint],
  );
  const remoteTokenMessengerKey = findProgramAddress(
    'remote_token_messenger',
    tokenMessengerMinterProgram.programId,
    [destinationDomain.toString()],
  );
  const authorityPda = findProgramAddress(
    'sender_authority',
    tokenMessengerMinterProgram.programId,
  );

  const associatedTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    new PublicKey(senderAddress),
  );

  const destContext = wh.getContext(recipientChain);
  const recipient = destContext.formatAddress(recipientAddress);

  return tokenMessengerMinterProgram.methods
    .depositForBurn({
      amount: new BN(parsedAmt.toString()),
      destinationDomain,
      mintRecipient: new PublicKey(recipient),
    })
    .accounts({
      owner: senderAddress,
      senderAuthorityPda: authorityPda.publicKey,
      burnTokenAccount: associatedTokenAccount,
      messageTransmitter: messageTransmitterAccount.publicKey,
      tokenMessenger: tokenMessenger.publicKey,
      remoteTokenMessenger: remoteTokenMessengerKey.publicKey,
      tokenMinter: tokenMinter.publicKey,
      localToken: localToken.publicKey,
      burnTokenMint: tokenMint,
      messageTransmitterProgram: messageTransmitterProgram.programId,
      tokenMessengerMinterProgram: tokenMessengerMinterProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();
}

export async function getMessageFromSolana(
  id: string,
): Promise<UnsignedCCTPMessage> {
  const context = wh.getContext(
    CHAIN_ID_SOLANA,
  ) as SolanaContext<WormholeContext>;
  const connection = context.connection;

  const tx = await connection?.getTransaction(id);
  if (!tx || !tx.meta) throw new Error('Transaction not found');

  const accounts = tx.transaction.message.accountKeys;

  const messageTransmitter = getMessageTransmitter();
  const tokenMessenger = getTokenMessenger();

  // this log contains the cctp message information
  const messageTransmitterParser = new EventParser(
    messageTransmitter.programId,
    messageTransmitter.coder,
  );
  const messageLogs = [
    ...messageTransmitterParser.parseLogs(tx.meta.logMessages || []),
  ];
  const messageBytes = messageLogs[0].data.message as Buffer;
  const message = ethUtils.hexlify(messageBytes);

  // this log contains the transfer information
  const tokenMessengerParser = new EventParser(
    tokenMessenger.programId,
    tokenMessenger.coder,
  );
  const tokenLogs = [
    ...tokenMessengerParser.parseLogs(tx.meta.logMessages || []),
  ];
  const parsedCCTPLog = tokenLogs.find((l) => l.name === 'DepositForBurn');
  if (!parsedCCTPLog) {
    throw new Error('DepositForBurn log not found');
  }
  const data = parsedCCTPLog.data as any as DepositForBurnLogData;

  const toChain: ChainName = getChainNameCCTP(data.destinationDomain);
  const destContext = wh.getContext(toChain);
  const recipient = destContext.parseAddress(
    ethUtils.hexlify(data.mintRecipient.toBuffer()),
  );
  const tokenAddress = data.burnToken.toString();
  const tokenId: TokenId = { address: tokenAddress, chain: 'solana' };
  const token = getTokenById(tokenId);
  const decimals = await wh.fetchTokenDecimals(tokenId, 'solana');

  return {
    sendTx: id,
    sender: accounts[0].toString(),
    amount: data.amount.toString(),
    payloadID: PayloadType.Manual,
    recipient,
    toChain,
    fromChain: 'solana',
    tokenAddress,
    tokenChain: 'solana',
    tokenId,
    tokenDecimals: decimals,
    tokenKey: token?.key || '',
    receivedTokenKey: getNativeVersionOfToken('USDC', toChain),
    gasFee: tx.meta.fee.toString(),
    block: tx.slot, //receipt.blockNumber,
    message,

    // manual CCTP does not use wormhole
    emitterAddress: '',
    sequence: '',
  };
}

export async function redeemOnSolana(
  message: SignedMessage,
  payer: string,
): Promise<Transaction> {
  if (!isSignedCCTPMessage(message)) {
    throw new Error('Signed message is not for CCTP');
  }
  const messageTransmitterProgram = getMessageTransmitter();
  const tokenMessengerMinterProgram = getTokenMessenger();

  const fromContext = wh.getContext(message.fromChain);

  const messageBytes = Buffer.from(message.message.replace('0x', ''), 'hex');
  const attestationBytes = Buffer.from(
    message.attestation.replace('0x', ''),
    'hex',
  );
  const nonce = messageBytes.readBigInt64BE(CCTP_NONCE_OFFSET);

  const remoteDomain = getDomainCCTP(message.fromChain);
  const tokenKey = getNativeVersionOfToken('USDC', 'solana');
  const tokenConfig = TOKENS[tokenKey];
  if (!tokenConfig || !tokenConfig.tokenId)
    throw new Error('Invalid USDC token');
  const solanaUsdcAddress = new PublicKey(tokenConfig.tokenId.address);
  const sourceUsdcAddress = new PublicKey(
    fromContext.formatAddress(message.tokenId.address),
  );

  const payerPubkey = new PublicKey(payer || message.recipient);
  const userTokenAccount = await getAssociatedTokenAddress(
    solanaUsdcAddress,
    new PublicKey(message.recipient),
  );

  // Find pdas
  const messageTransmitterAccount = findProgramAddress(
    'message_transmitter',
    messageTransmitterProgram.programId,
  );
  const tokenMessenger = findProgramAddress(
    'token_messenger',
    tokenMessengerMinterProgram.programId,
  );
  const tokenMinter = findProgramAddress(
    'token_minter',
    tokenMessengerMinterProgram.programId,
  );
  const localToken = findProgramAddress(
    'local_token',
    tokenMessengerMinterProgram.programId,
    [solanaUsdcAddress],
  );
  const remoteTokenMessengerKey = findProgramAddress(
    'remote_token_messenger',
    tokenMessengerMinterProgram.programId,
    [remoteDomain.toString()],
  );
  const tokenPair = findProgramAddress(
    'token_pair',
    tokenMessengerMinterProgram.programId,
    [remoteDomain.toString(), sourceUsdcAddress],
  );
  const custodyTokenAccount = findProgramAddress(
    'custody',
    tokenMessengerMinterProgram.programId,
    [solanaUsdcAddress],
  );
  const authorityPda = findProgramAddress(
    'message_transmitter_authority',
    messageTransmitterProgram.programId,
  ).publicKey;

  // Calculate the nonce PDA.
  const maxNoncesPerAccount = 6400;
  const firstNonce =
    ((nonce - BigInt(1)) / BigInt(maxNoncesPerAccount)) *
      BigInt(maxNoncesPerAccount) +
    BigInt(1);
  const usedNonces = findProgramAddress(
    'used_nonces',
    messageTransmitterProgram.programId,
    [remoteDomain.toString(), firstNonce.toString()],
  ).publicKey;

  // Build the accountMetas list. These are passed as remainingAccounts for the TokenMessengerMinter CPI
  const accountMetas: AccountMeta[] = [];
  accountMetas.push({
    isSigner: false,
    isWritable: false,
    pubkey: tokenMessenger.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: false,
    pubkey: remoteTokenMessengerKey.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: true,
    pubkey: tokenMinter.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: true,
    pubkey: localToken.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: false,
    pubkey: tokenPair.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: true,
    pubkey: userTokenAccount,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: true,
    pubkey: custodyTokenAccount.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: false,
    pubkey: TOKEN_PROGRAM_ID,
  });

  return (
    messageTransmitterProgram.methods
      .receiveMessage({
        message: messageBytes,
        attestation: attestationBytes,
      })
      .accounts({
        payer: payerPubkey,
        caller: payerPubkey,
        authorityPda,
        messageTransmitter: messageTransmitterAccount.publicKey,
        usedNonces,
        receiver: tokenMessengerMinterProgram.programId,
        systemProgram: SystemProgram.programId,
      })
      // Add remainingAccounts needed for TokenMessengerMinter CPI
      .remainingAccounts(accountMetas)
      .transaction()
  );
}
