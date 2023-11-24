import { ethers } from 'ethers';

export const porticoAbi = new ethers.utils.Interface([
  'function start((bytes32,address,address,address,address,address,uint256,uint256)) returns (address,uint16,uint64)',
]);

export const porticoSwapFinishedEvent =
  '0xd16c4d153dc1a0d986ddbc890135e0dce2e0d72317e518d7ce66dfb5ec7b8643';

export const uniswapQuoterV2Abi = new ethers.utils.Interface([
  'function quoteExactInputSingle((address,address,uint256,uint24,uint160)) public view returns (uint256,uint160,uint32,uint256)',
]);
