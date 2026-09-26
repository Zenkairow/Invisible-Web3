import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import { getAddresses } from '../config/addresses';

const prisma = new PrismaClient();

export class LedgerService {
  /**
   * Retrieves the current USDC balance of a user by summing all their ledger entries.
   */
  static async getBalance(userId: string): Promise<number> {
    const aggregate = await prisma.ledger.aggregate({
      where: { userId },
      _sum: { amount: true }
    });
    return aggregate._sum.amount || 0;
  }

  /**
   * Credits a user's ledger (e.g. from invoice payout).
   */
  static async creditBalance(userId: string, amount: number, description: string) {
    if (amount <= 0) throw new Error("Amount must be positive");
    return prisma.ledger.create({
      data: { userId, amount, description }
    });
  }

  /**
   * Debits a user's ledger (e.g. for gas service fee or withdrawal).
   */
  static async debitBalance(userId: string, amount: number, description: string) {
    if (amount <= 0) throw new Error("Amount must be positive");
    const currentBalance = await this.getBalance(userId);
    if (currentBalance < amount) {
      throw new Error("Insufficient balance");
    }
    return prisma.ledger.create({
      data: { userId, amount: -amount, description }
    });
  }

  /**
   * Get user by ID (auth handles user creation now).
   */
  static async getUserById(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");
    return user;
  }

  /**
   * Ensure user has a smart wallet address computed.
   * Called lazily when a blockchain operation is needed.
   */
  static async ensureSmartWallet(userId: string): Promise<string> {
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    if (user.smartWalletAddress) return user.smartWalletAddress;

    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const addresses = getAddresses();
    const SimpleAccountFactoryABI = [
      "function getAddress(address owner, uint256 salt) view returns (address)"
    ];
    const factory = new ethers.Contract(addresses.SIMPLE_ACCOUNT_FACTORY, SimpleAccountFactoryABI, provider);
    const ownerAddress = new ethers.Wallet(
      process.env.VERIFYING_SIGNER_PRIVATE_KEY || "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
    ).address;
    const salt = BigInt(ethers.keccak256(ethers.toUtf8Bytes(user.id)));

    try {
      const computedAddress = await factory.getFunction("getAddress")(ownerAddress, salt);
      user = await prisma.user.update({
        where: { id: user.id },
        data: { smartWalletAddress: computedAddress }
      });
      return computedAddress;
    } catch (err: any) {
      console.error("Failed to pre-compute smart wallet address:", err.message);
      return "0x000000000000000000000000000000000000dEaD";
    }
  }
}
