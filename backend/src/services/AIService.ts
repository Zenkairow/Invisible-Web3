import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import { LedgerService } from './ledgerService';
import { SigningService } from './signingService';
import { getAddresses } from '../config/addresses';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const EntryPointABI = [
  "function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary) external",
  "function getNonce(address sender, uint192 key) view returns (uint256)",
  "function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)"
];

const FactoryABI = [
  "function getAddress(address owner, uint256 salt) view returns (address)",
  "function createAccount(address owner, uint256 salt) returns (address)"
];

const DummyTargetABI = [
  "function setMessage(string memory message) external"
];

export class AIService {
  private provider: ethers.JsonRpcProvider;
  private backendSigner: ethers.Wallet;
  private signingService: SigningService;

  public entryPointAddress: string;
  public aiWalletFactoryAddress: string;
  public dummyTargetAddress: string;

  constructor() {
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    const bundlerKey = process.env.BUNDLER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
    const rawSigner = new ethers.Wallet(bundlerKey, this.provider);
    this.backendSigner = new ethers.NonceManager(rawSigner) as unknown as ethers.Wallet;
    
    this.signingService = new SigningService();

    const addresses = getAddresses();
    this.entryPointAddress = addresses.ENTRY_POINT_ADDRESS;
    this.aiWalletFactoryAddress = addresses.AI_WALLET_FACTORY;
    this.dummyTargetAddress = addresses.DUMMY_TARGET_ADDRESS;
  }

  async ensureAgentWalletConfigured(aiAgent: any): Promise<string> {
    const ownerPrivateKey = process.env.VERIFYING_SIGNER_PRIVATE_KEY;
    if (!ownerPrivateKey) throw new Error("VERIFYING_SIGNER_PRIVATE_KEY is missing");
    const ownerSigner = new ethers.Wallet(ownerPrivateKey, this.provider);

    const factory = new ethers.Contract(this.aiWalletFactoryAddress, FactoryABI, ownerSigner);
    
    // Deterministic salt derived directly from AI agent's public key address
    const salt = BigInt(aiAgent.agentAddress);
    const aiSmartWalletAddress = await factory.getFunction("getAddress")(ownerSigner.address, salt);

    const code = await this.provider.getCode(aiSmartWalletAddress);
    if (code === "0x") {
      logger.info(`Deploying AI Smart Wallet for ${aiAgent.id} at ${aiSmartWalletAddress}...`);
      const deployTx = await factory.getFunction("createAccount")(ownerSigner.address, salt);
      await deployTx.wait();
      logger.info("AI Smart Wallet proxy deployed successfully.");
    }

    const walletContract = new ethers.Contract(aiSmartWalletAddress, [
      "function aiAgentAddress() view returns (address)",
      "function setAIAgent(address agent, uint256 limit) external"
    ], ownerSigner);

    const currentAgentAddress = await walletContract.aiAgentAddress();
    if (currentAgentAddress.toLowerCase() !== aiAgent.agentAddress.toLowerCase()) {
      const limit = ethers.parseEther("1000"); // set default limit
      logger.info(`Configuring AI Agent signature permissions on-chain (Agent: ${aiAgent.agentAddress}, Limit: ${limit.toString()})...`);
      const configTx = await walletContract.setAIAgent(aiAgent.agentAddress, limit);
      await configTx.wait();
      logger.info("AI Smart Wallet signature permissions configured.");
    }

    return aiSmartWalletAddress;
  }

  async createAIAgent(userId: string, dailyBudget: number) {
    logger.info(`Creating AI Agent for ${userId} with budget ${dailyBudget}`);
    const user = await LedgerService.getUserById(userId);
    
    const aiWallet = ethers.Wallet.createRandom();

    const aiAgent = await prisma.aIAgent.create({
      data: {
        userId: user.id,
        agentAddress: aiWallet.address,
        agentPrivKey: aiWallet.privateKey,
        dailyBudget,
        spentToday: 0
      }
    });

    try {
      await this.ensureAgentWalletConfigured(aiAgent);
    } catch (err: any) {
      logger.error(`Failed to pre-configure AI Agent Wallet on-chain: ${err.message}`);
    }

    return {
      agentId: aiAgent.id,
      agentAddress: aiAgent.agentAddress,
      dailyBudget: aiAgent.dailyBudget
    };
  }

  async simulateAIAction(agentId: string, costInINR: number) {
    const startTime = Date.now();
    logger.info(`AI Agent ${agentId} requesting action costing ${costInINR}`);
    
    const aiAgent = await prisma.aIAgent.findUnique({
      where: { id: agentId },
      include: { user: true }
    });

    if (!aiAgent) throw new Error("AI Agent not found");

    if (aiAgent.spentToday + costInINR > aiAgent.dailyBudget) {
      logger.warn(`AI Agent ${agentId} rejected: Budget Exceeded`);
      throw new Error(`Transaction Rejected by Policy Engine: Exceeds daily budget. Available: ${aiAgent.dailyBudget - aiAgent.spentToday} INR`);
    }

    const userBalance = await LedgerService.getBalance(aiAgent.userId);
    if (userBalance < costInINR) {
      logger.warn(`AI Agent ${agentId} rejected: Insufficient Fiat Ledger balance`);
      throw new Error("Transaction Rejected by Policy Engine: Insufficient Fiat Ledger balance to sponsor compute.");
    }

    await LedgerService.debitBalance(aiAgent.userId, costInINR, `AI Agent Compute Purchase`);
    
    await prisma.aIAgent.update({
      where: { id: aiAgent.id },
      data: { spentToday: aiAgent.spentToday + costInINR }
    });

    // Deploy/Configure wallet on-chain if not already done, and get address
    const aiSmartWalletAddress = await this.ensureAgentWalletConfigured(aiAgent);

    const targetInterface = new ethers.Interface(DummyTargetABI);
    const callData = targetInterface.encodeFunctionData("setMessage", ["Cloud Compute Allocated by AI"]);
    
    const accountInterface = new ethers.Interface([
      "function execute(address dest, uint256 value, bytes calldata func) external"
    ]);
    const executeCallData = accountInterface.encodeFunctionData("execute", [
      this.dummyTargetAddress,
      0, 
      callData
    ]);

    // Since ensureAgentWalletConfigured guarantees the wallet is already deployed, initCode is always "0x"
    let userOp = {
      sender: aiSmartWalletAddress,
      nonce: await this.getNonce(aiSmartWalletAddress),
      initCode: "0x",
      callData: executeCallData,
      callGasLimit: 200000n,
      verificationGasLimit: 200000n,
      preVerificationGas: 50000n,
      maxFeePerGas: ethers.parseUnits("10", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("10", "gwei"),
      paymasterAndData: "0x",
      signature: "0x"
    };

    logger.info("Requesting Paymaster Sponsorship for AI Agent...");
    userOp.paymasterAndData = await this.signingService.authorizeUserOp(userOp);

    const aiWallet = new ethers.Wallet(aiAgent.agentPrivKey);
    const entryPoint = new ethers.Contract(this.entryPointAddress, EntryPointABI, this.provider);
    const userOpHash = await entryPoint.getFunction("getUserOpHash")(userOp);
    
    const aiSignature = await aiWallet.signMessage(ethers.getBytes(userOpHash));
    userOp.signature = aiSignature;

    logger.info(`Broadcasting UserOp for AI Agent ${agentId}...`);
    const bundlerEntryPoint = new ethers.Contract(this.entryPointAddress, [
      "function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary) external"
    ], this.backendSigner);

    // @ts-ignore
    const tx = await bundlerEntryPoint.getFunction("handleOps")([userOp], await this.backendSigner.getAddress());
    const receipt = await tx.wait();

    const latency = Date.now() - startTime;
    logger.info(`AI Agent Transaction finalized. Hash: ${receipt.hash} | Latency: ${latency}ms`);

    return { success: true, txHash: receipt.hash, computePurchased: true };
  }

  async getAgents(userId: string) {
    return prisma.aIAgent.findMany({ where: { userId } });
  }

  private async getNonce(accountAddress: string): Promise<bigint> {
    const ep = new ethers.Contract(this.entryPointAddress, [
      "function getNonce(address sender, uint192 key) view returns (uint256 nonce)"
    ], this.provider);
    try {
      const nonce = await ep.getFunction("getNonce")(accountAddress, 0);
      return nonce;
    } catch {
      return 0n;
    }
  }
}

