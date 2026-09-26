import { ethers } from 'ethers';
import { LedgerService } from './ledgerService';
import { getAddresses } from '../config/addresses';

// Assuming PlatformTreasury ABI includes executeExternalCryptoPayout
const PlatformTreasuryABI = [
  "function executeExternalCryptoPayout(address destination, uint256 usdcAmount, bool convertToETH, address mockDex) external"
];

export class CryptoPayoutService {
  static async processCryptoPayout(userId: string, destination: string, amountUSDC: number, targetCurrency: string) {
    if (amountUSDC <= 0) throw new Error("Amount must be positive");
    if (!ethers.isAddress(destination)) throw new Error("Invalid destination wallet address");

    // 1. Validate internal ledger solvency
    const currentBalance = await LedgerService.getBalance(userId);
    if (currentBalance < amountUSDC) {
      throw new Error(`Insufficient balance: Have $${currentBalance}, requested $${amountUSDC}`);
    }

    // 2. Apply hidden spread/profit margin (2%)
    const profitMargin = 0.02; // 2%
    const payoutAmountUSDC = amountUSDC * (1 - profitMargin);
    const feeUSDC = amountUSDC - payoutAmountUSDC;

    console.log(`[CryptoPayout] Original Request: ${amountUSDC} USDC. Payout: ${payoutAmountUSDC} USDC. Profit: ${feeUSDC} USDC.`);

    // 3. Prepare transaction on PlatformTreasury
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const backendSignerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const backendSigner = new ethers.Wallet(backendSignerPrivateKey, provider);
    
    const addresses = getAddresses();
    const treasury = new ethers.Contract(addresses.PLATFORM_TREASURY, PlatformTreasuryABI, backendSigner);

    const amountUSDCWei = ethers.parseUnits(payoutAmountUSDC.toFixed(6), 6);
    const convertToETH = targetCurrency !== 'USDC';

    console.log(`[CryptoPayout] Initiating payout of ${payoutAmountUSDC} USDC to ${destination} (Swap to ${targetCurrency}: ${convertToETH})...`);

    // 4. Trigger Treasury transaction
    const tx = await treasury.executeExternalCryptoPayout(
      destination,
      amountUSDCWei,
      convertToETH,
      ethers.ZeroAddress // MockDEX deprecated, we only do Pure USDC payouts now
    );
    
    const receipt = await tx.wait();
    console.log(`[CryptoPayout] ✅ Payout dispatched. TX: ${receipt.hash}`);

    // 5. Update database ledger state
    await LedgerService.debitBalance(userId, amountUSDC, `External ${targetCurrency} Payout to ${destination.substring(0,6)}...`);

    return {
      success: true,
      txHash: receipt.hash,
      amountUSDC,
      payoutAmountUSDC,
      platformProfitUSDC: feeUSDC,
      destination,
      currency: targetCurrency
    };
  }
}
