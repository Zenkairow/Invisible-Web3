import { PrismaClient } from '@prisma/client';
import { LedgerService } from './ledgerService';
import { ethers } from 'ethers';
import { getAddresses } from '../config/addresses';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class FiatWithdrawalService {
  static async requestWithdrawal(userId: string, amountUSDC: number, amountINR: number, userUpiId: string) {
    if (amountUSDC < 1) throw new Error("Minimum withdrawal is 1 USDC");
    if (!userUpiId || userUpiId.length < 3) throw new Error("Invalid UPI ID");

    // Check user has sufficient balance
    const currentBalance = await LedgerService.getBalance(userId);
    if (currentBalance < amountUSDC) {
      throw new Error(`Insufficient balance: Have $${currentBalance.toFixed(2)}, requested $${amountUSDC}`);
    }

    const withdrawal = await prisma.fiatWithdrawal.create({
      data: {
        userId,
        amountUSDC,
        amountINR,
        userUpiId,
        status: "PENDING"
      }
    });

    return withdrawal;
  }

  static async getPendingWithdrawals() {
    return prisma.fiatWithdrawal.findMany({
      where: { status: "PENDING" },
      include: {
        user: {
          select: { displayName: true, email: true, smartWalletAddress: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  static async markAsPaid(withdrawalId: string) {
    const withdrawal = await prisma.fiatWithdrawal.findUnique({
      where: { id: withdrawalId },
      include: { user: true }
    });

    if (!withdrawal) throw new Error("Withdrawal not found");
    if (withdrawal.status !== "PENDING") throw new Error(`Withdrawal already ${withdrawal.status}`);

    // --- BLOCKCHAIN: REPLENISH TREASURY VIA MINT ---
    // The VERIFYING_SIGNER and BUNDLER keys are well-known Hardhat defaults
    // and get swept by bots on public testnets. Instead of pulling tokens
    // from the user's wallet (which requires those keys to have gas),
    // we mint the equivalent MockUSDC directly back to the Treasury
    // using the DEPLOYER key (which has real gas). Same economic effect.
    try {
      const addresses = getAddresses();
      const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const deployerWallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);

      const mockUsdcAbi = ["function mint(address to, uint256 amount)"];
      const mockUsdc = new ethers.Contract(addresses.USDC, mockUsdcAbi, deployerWallet);

      const amountWei = ethers.parseUnits(withdrawal.amountUSDC.toString(), 6);

      logger.info(`Minting ${withdrawal.amountUSDC} MockUSDC back to Treasury (${addresses.PLATFORM_TREASURY})`);
      const tx = await mockUsdc.mint(addresses.PLATFORM_TREASURY, amountWei);
      const receipt = await tx.wait();
      logger.info(`Treasury Replenished. TX: ${receipt.hash}`);
    } catch (err: any) {
      logger.error(`Treasury Replenishment Failed: ${err.message}`);
      throw new Error(`Failed to replenish Treasury: ${err.message}`);
    }
    // --- END BLOCKCHAIN ---

    // Debit the user's internal ledger
    await LedgerService.debitBalance(
      withdrawal.userId,
      withdrawal.amountUSDC,
      `Fiat Withdrawal to UPI: ${withdrawal.userUpiId}`
    );

    // Update status
    const updated = await prisma.fiatWithdrawal.update({
      where: { id: withdrawalId },
      data: { status: "PAID" }
    });

    return { success: true, withdrawal: updated };
  }

  static async rejectWithdrawal(withdrawalId: string) {
    const withdrawal = await prisma.fiatWithdrawal.findUnique({
      where: { id: withdrawalId }
    });

    if (!withdrawal) throw new Error("Withdrawal not found");
    if (withdrawal.status !== "PENDING") throw new Error(`Withdrawal already ${withdrawal.status}`);

    const updated = await prisma.fiatWithdrawal.update({
      where: { id: withdrawalId },
      data: { status: "REJECTED" }
    });

    return { success: true, withdrawal: updated };
  }
}
