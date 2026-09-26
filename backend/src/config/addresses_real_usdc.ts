/**
 * PRESERVED REAL USDC / PRODUCTION ADDRESSES
 * ============================================
 * These addresses point to the real Native Circle USDC on Polygon Amoy
 * and the original PlatformTreasury deployed against it.
 * 
 * The deployer wallet (DEPLOYER_PRIVATE_KEY) holds real POL and
 * potentially real USDC at these contracts.
 * 
 * DO NOT DELETE — we will switch back to these when going public.
 */
export const REAL_ADDRESSES = {
  USDC: "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582",            // Circle Native USDC on Amoy
  PLATFORM_TREASURY: "0x18D67Fa4cdB2B5A86116C76543460fcDD3927B2F", // Treasury deployed with real USDC
  ENTRY_POINT_ADDRESS: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
  PAYMASTER_ADDRESS: "0x61D954EA69Ac7DB909529A3Ee3c965611ed59750",
  SIMPLE_ACCOUNT_FACTORY: "0x03f07E08C5A3148436EbA152a3EDd50f04BCa063",
};
