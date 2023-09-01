import { CONFIG } from '@wormhole-foundation/wormhole-connect-sdk';
import { ChainsConfig, Icon } from '../types';

const { chains } = CONFIG.TESTNET;

export const TESTNET_CHAINS: ChainsConfig = {
  goerli: {
    ...chains.goerli!,
    displayName: 'Goerli',
    explorerUrl: 'https://goerli.etherscan.io/',
    explorerName: 'Etherscan',
    gasToken: 'ETH',
    chainId: 5,
    icon: Icon.ETH,
    automaticRelayer: true,
    maxBlockSearch: 2000,
  },
  mumbai: {
    ...chains.mumbai!,
    displayName: 'Mumbai',
    explorerUrl: 'https://mumbai.polygonscan.com/',
    explorerName: 'Polygonscan',
    gasToken: 'MATIC',
    chainId: 80001,
    icon: Icon.POLYGON,
    automaticRelayer: true,
    maxBlockSearch: 1000,
  },
  bsc: {
    ...chains.bsc!,
    displayName: 'BSC',
    explorerUrl: 'https://testnet.bscscan.com/',
    explorerName: 'BscScan',
    gasToken: 'BNB',
    chainId: 97,
    icon: Icon.BSC,
    automaticRelayer: true,
    maxBlockSearch: 2000,
  },
  fuji: {
    ...chains.fuji!,
    displayName: 'Fuji',
    explorerUrl: 'https://testnet.snowtrace.io/',
    explorerName: 'Snowtrace',
    gasToken: 'AVAX',
    chainId: 43113,
    icon: Icon.AVAX,
    automaticRelayer: true,
    maxBlockSearch: 2000,
  },
  fantom: {
    ...chains.fantom!,
    displayName: 'Fantom',
    explorerUrl: 'https://testnet.ftmscan.com/',
    explorerName: 'FtmScan',
    gasToken: 'FTM',
    chainId: 4002,
    icon: Icon.FANTOM,
    automaticRelayer: true,
    maxBlockSearch: 2000,
  },
  alfajores: {
    ...chains.alfajores!,
    displayName: 'Alfajores',
    explorerUrl: 'https://explorer.celo.org/alfajores/',
    explorerName: 'Celo Explorer',
    gasToken: 'CELO',
    chainId: 44787,
    icon: Icon.CELO,
    automaticRelayer: true,
    maxBlockSearch: 2000,
  },
  moonbasealpha: {
    ...chains.moonbasealpha!,
    displayName: 'Moonbase',
    explorerUrl: 'https://moonbase.moonscan.io/',
    explorerName: 'Moonscan',
    gasToken: 'GLMR',
    chainId: 1287,
    icon: Icon.GLMR,
    automaticRelayer: true,
    maxBlockSearch: 2000,
  },
  solana: {
    ...chains.solana!,
    displayName: 'Solana',
    explorerUrl: 'https://explorer.solana.com/',
    explorerName: 'Solana Explorer',
    gasToken: 'SOL',
    chainId: 0,
    icon: Icon.SOLANA,
    automaticRelayer: false,
    maxBlockSearch: 2000,
  },
  sui: {
    ...chains.sui!,
    displayName: 'Sui',
    explorerUrl: 'https://explorer.sui.io/',
    explorerName: 'Sui Explorer',
    gasToken: 'SUI',
    chainId: 0,
    icon: Icon.SUI,
    automaticRelayer: true,
    maxBlockSearch: 0,
  },
  aptos: {
    ...chains.aptos!,
    displayName: 'Aptos',
    explorerUrl: 'https://explorer.aptoslabs.com/',
    explorerName: 'Aptos Explorer',
    gasToken: 'APT',
    chainId: 0,
    icon: Icon.APT,
    maxBlockSearch: 0,
  },
  basegoerli: {
    ...chains.basegoerli!,
    displayName: 'Base Goerli',
    explorerUrl: 'https://goerli.basescan.org/',
    explorerName: 'BaseScan',
    gasToken: 'ETHbase',
    chainId: 84531,
    icon: Icon.BASE,
    maxBlockSearch: 2000,
  },
  sei: {
    ...chains.sei!,
    displayName: 'Sei',
    explorerUrl: 'https://sei.explorers.guru/',
    explorerName: 'Sei Explorer',
    gasToken: 'SEI',
    chainId: 0,
    icon: Icon.SEI,
    automaticRelayer: false,
    maxBlockSearch: 0,
  },
  osmosis: {
    ...chains.osmosis!,
    displayName: 'Osmosis',
    explorerUrl: 'https://testnet.mintscan.io/osmosis-testnet/',
    explorerName: 'MintScan',
    gasToken: 'OSMO',
    chainId: 'osmo-test-5',
    icon: Icon.OSMO,
    automaticRelayer: false,
    maxBlockSearch: 0,
  },
  wormchain: {
    ...chains.wormchain!,
    displayName: 'Wormchain',
    explorerUrl: '',
    explorerName: '',
    gasToken: 'WORM',
    chainId: 'wormchain-testnet-0',
    icon: Icon.OSMO,
    automaticRelayer: false,
    maxBlockSearch: 0,
  },
};
