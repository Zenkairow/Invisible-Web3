import { ethers } from 'ethers';

export function getJsonRpcProvider(rpcUrl?: string): ethers.JsonRpcProvider {
  const url = rpcUrl || process.env.RPC_URL || 'https://polygon-amoy.drpc.org';
  return new ethers.JsonRpcProvider(url, 80002, { staticNetwork: true });
}
