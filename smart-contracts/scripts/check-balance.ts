import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

async function checkBalance() {
  const alchemyUrl = process.env.AMOY_RPC_URL || `https://polygon-amoy.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
  
  if (!process.env.ALCHEMY_API_KEY && !process.env.AMOY_RPC_URL) {
    console.log("No Alchemy API Key found. Using public Amoy RPC...");
  }
  
  const providerUrl = process.env.AMOY_RPC_URL || `https://polygon-amoy.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || 'demo'}`;
  
  try {
    // If ALCHEMY_API_KEY is missing/empty, this might fail, so fallback to a public RPC if needed
    const PUBLIC_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
    const provider = new ethers.JsonRpcProvider(PUBLIC_RPC);
    const address = "0x9f4e1425010C383A1818d9daBf55f0Aa2FaF6811";
    
    console.log(`Checking balance for ${address}...`);
    const balance = await provider.getBalance(address);
    console.log(`Balance: ${ethers.formatEther(balance)} POL (MATIC)`);
  } catch (err) {
    console.error("Error checking balance:", err);
  }
}

checkBalance();
