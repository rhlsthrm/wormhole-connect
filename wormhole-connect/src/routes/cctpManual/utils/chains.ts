import { ChainName } from '@wormhole-foundation/wormhole-connect-sdk';
import { isMainnet } from 'config';

export const CCTPManual_CHAINS: ChainName[] = [
  'ethereum',
  'avalanche',
  'fuji',
  'goerli',
  'base',
  'optimism',
  'arbitrum',
  'optimismgoerli',
  'arbitrumgoerli',
  'basegoerli',
  'solana',
];

export const CCTPDomains: Partial<Record<ChainName, number>> = {
  ethereum: 0,
  avalanche: 1,
  fuji: 1,
  goerli: 0,
  base: 6,
  optimism: 2,
  arbitrum: 3,
  optimismgoerli: 2,
  arbitrumgoerli: 3,
  basegoerli: 6,
  solana: 5,
};

export function getChainNameCCTP(domain: number): ChainName {
  switch (domain) {
    case 0:
      return isMainnet ? 'ethereum' : 'goerli';
    case 1:
      return isMainnet ? 'avalanche' : 'fuji';
    case 2:
      return isMainnet ? 'optimism' : 'optimismgoerli';
    case 3:
      return isMainnet ? 'arbitrum' : 'arbitrumgoerli';
    case 5:
      return 'solana';
    case 6:
      return isMainnet ? 'base' : 'basegoerli';
  }
  throw new Error('Invalid CCTP domain');
}

export function getDomainCCTP(chain: ChainName): number {
  const domain = CCTPDomains[chain];
  if (domain === undefined) throw new Error('Invalid CCTP chain');
  return domain;
}
