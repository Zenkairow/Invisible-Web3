import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import { getAddresses } from '../config/addresses';
import { LedgerService } from './ledgerService';

const prisma = new PrismaClient();

const PlatformTreasuryABI = [
  "function executeExternalCryptoPayout(address destination, uint256 usdcAmount, bool convertToETH, address mockDex) external"
];

export class FiatDepositService {
  static async requestDeposit(userId: string, amountINR: number, expectedUSDC: number, utrNumber: string) {
    if (amountINR <= 0 || expectedUSDC <= 0) throw new Error("Amount must be positive");
    if (!utrNumber || utrNumber.length < 5) throw new Error("Invalid UTR number");

    // Check if UTR already exists
    const existing = await prisma.fiatDeposit.findUnique({ where: { utrNumber } });
    if (existing) throw new Error("A deposit with this UTR number already exists");

    const deposit = await prisma.fiatDeposit.create({
      data: {
        userId,
        amountINR,
        expectedUSDC,
        utrNumber,
        status: "PENDING"
      }
    });

    return deposit;
  }

  static async getPendingDeposits() {
    return prisma.fiatDeposit.findMany({
      where: { status: "PENDING" },
      include: {
        user: {
          select: { displayName: true, email: true, smartWalletAddress: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  static async approveDeposit(depositId: string) {
    const deposit = await prisma.fiatDeposit.findUnique({
      where: { id: depositId },
      include: { user: true }
    });

    if (!deposit) throw new Error("Deposit not found");
    if (deposit.status !== "PENDING") throw new Error(`Deposit already ${deposit.status}`);
    if (!deposit.user.smartWalletAddress) throw new Error("User has no smart wallet address configured");

    // Execute Smart Contract Dispension
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    // Must use DEPLOYER key — the deployer is the Ownable owner of PlatformTreasury
    const backendSignerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY!;
    if (!backendSignerPrivateKey) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");
    const backendSigner = new ethers.Wallet(backendSignerPrivateKey, provider);
    
    const addresses = getAddresses();
    const treasury = new ethers.Contract(addresses.PLATFORM_TREASURY, PlatformTreasuryABI, backendSigner);

    const amountUSDCWei = ethers.parseUnits(deposit.expectedUSDC.toFixed(6), 6);

    console.log(`[FiatDeposit] Initiating dispersion of ${deposit.expectedUSDC} USDC to ${deposit.user.smartWalletAddress}...`);

    const tx = await treasury.executeExternalCryptoPayout(
      deposit.user.smartWalletAddress,
      amountUSDCWei,
      false, // Do not convert to ETH
      ethers.ZeroAddress
    );
    
    const receipt = await tx.wait();
    console.log(`[FiatDeposit] ✅ Dispersion completed. TX: ${receipt.hash}`);

    // Update Status
    const updated = await prisma.fiatDeposit.update({
      where: { id: depositId },
      data: { status: "APPROVED" }
    });

    // Credit internal ledger so balance displays correctly in UI alongside Smart Wallet
    await LedgerService.creditBalance(deposit.userId, deposit.expectedUSDC, `P2P UPI Deposit (UTR: ${deposit.utrNumber})`);

    return { success: true, txHash: receipt.hash, deposit: updated };
  }
}
