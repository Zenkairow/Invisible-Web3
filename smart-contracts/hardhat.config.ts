import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
let BUNDLER_PRIVATE_KEY = process.env.BUNDLER_PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000000";
if (!BUNDLER_PRIVATE_KEY.startsWith("0x")) {
  BUNDLER_PRIVATE_KEY = "0x" + BUNDLER_PRIVATE_KEY;
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  networks: {
    hardhat: {
      // Local development network
    },
    amoy: {
      url: ALCHEMY_API_KEY ? `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : "https://rpc-amoy.polygon.technology",
      accounts: [BUNDLER_PRIVATE_KEY],
      gasPrice: 26000000000
    },
    sepolia: {
      url: ALCHEMY_API_KEY ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: [BUNDLER_PRIVATE_KEY]
    },
    polygon: {
      url: ALCHEMY_API_KEY ? `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : "https://rpc.ankr.com/polygon",
      accounts: [BUNDLER_PRIVATE_KEY]
    }
  }
};

export default config;
