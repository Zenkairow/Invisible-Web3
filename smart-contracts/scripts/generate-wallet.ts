import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Generating a new secure deployment wallet...");
  
  // Generate random wallet
  const wallet = ethers.Wallet.createRandom();
  
  console.log("=========================================");
  console.log("🚀 NEW DEPLOYMENT WALLET GENERATED 🚀");
  console.log("=========================================");
  console.log("Public Address:", wallet.address);
  console.log("Mnemonic Phrase:", wallet.mnemonic?.phrase);
  console.log("Private Key:", wallet.privateKey);
  console.log("=========================================");
  console.log("Please fund this address via a Polygon Amoy Faucet before deploying.");
  console.log("=========================================");

  const envPath = path.join(__dirname, "..", ".env");
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  // Append securely to .env
  let newEnvContent = envContent;
  if (!newEnvContent.includes("BUNDLER_PRIVATE_KEY")) {
    newEnvContent += `\n# Generated Deployment & Bundler Wallet\nBUNDLER_PRIVATE_KEY=${wallet.privateKey.replace("0x", "")}\n`;
    newEnvContent += `DEPLOYER_ADDRESS=${wallet.address}\n`;
    fs.writeFileSync(envPath, newEnvContent.trim() + "\n");
    console.log("✅ Successfully securely saved to smart-contracts/.env");
  } else {
    console.log("⚠️ BUNDLER_PRIVATE_KEY already exists in .env. Skipping save to avoid overwrite.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
