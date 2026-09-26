import { ethers } from 'ethers';
import { LedgerService } from './ledgerService';
import { SigningService } from './signingService';
import { PrismaClient } from '@prisma/client';
import { getAddresses } from '../config/addresses';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const EntryPointABI = [
  "function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary) external",
  "function getNonce(address sender, uint192 key) view returns (uint256)",
  "function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)"
];

const SimpleAccountFactoryABI = [
  "function getAddress(address owner, uint256 salt) view returns (address)",
  "function createAccount(address owner, uint256 salt) returns (address)"
];

const SimpleAccountABI = [
  "function execute(address dest, uint256 value, bytes func)"
];

export class TransactionOrchestrator {
  private provider: ethers.JsonRpcProvider;
  private bundlerSigner: ethers.Wallet;
  private signingService: SigningService;

  public entryPointAddress: string;
  public factoryAddress: string;
  public dummyTargetAddress: string;

  constructor() {
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const bundlerKey = process.env.BUNDLER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
    const rawSigner = new ethers.Wallet(bundlerKey, this.provider);
    this.bundlerSigner = new ethers.NonceManager(rawSigner) as unknown as ethers.Wallet;
    
    this.signingService = new SigningService();

    const addresses = getAddresses();
    this.entryPointAddress = addresses.ENTRY_POINT_ADDRESS;
    this.factoryAddress = addresses.SIMPLE_ACCOUNT_FACTORY;
    this.dummyTargetAddress = addresses.DUMMY_TARGET_ADDRESS;
  }

  async processIncomingPayment(userId: string, amount: number, targetActionMessage: string): Promise<string> {
    const startTime = Date.now();
    logger.info(`Starting processIncomingPayment for ${userId}`);

    const GAS_FEE_INR = 1.0;

    const user = await LedgerService.getUserById(userId);
    
    const balance = await LedgerService.getBalance(user.id);
    if (balance < GAS_FEE_INR) {
      logger.warn(`Insufficient balance for ${userId}: ${balance}`);
      throw new Error(`Insufficient INR balance. Required: ${GAS_FEE_INR}, Available: ${balance}`);
    }

    await LedgerService.debitBalance(user.id, GAS_FEE_INR, "Gas Sponsorship for Target Action");

    const factory = new ethers.Contract(this.factoryAddress, SimpleAccountFactoryABI, this.provider);
    const ownerAddress = new ethers.Wallet(process.env.VERIFYING_SIGNER_PRIVATE_KEY!).address;
    const salt = BigInt(ethers.keccak256(ethers.toUtf8Bytes(user.id)));
    const smartWalletAddress = await factory.getFunction("getAddress")(ownerAddress, salt);

    if (!user.smartWalletAddress) {
      await prisma.user.update({
        where: { id: user.id },
        data: { smartWalletAddress }
      });
    }

    const entryPoint = new ethers.Contract(this.entryPointAddress, EntryPointABI, this.provider);
    
    let nonce = 0n;
    try {
      nonce = await entryPoint.getFunction("getNonce")(smartWalletAddress, 0);
    } catch (e) {
      // Ignore
    }

    const code = await this.provider.getCode(smartWalletAddress);
    if (code === "0x") {
       logger.info(`Deploying Smart Wallet for ${userId} at ${smartWalletAddress}`);
       const factoryWithSigner = factory.connect(this.bundlerSigner) as ethers.Contract;
       const tx = await factoryWithSigner.getFunction("createAccount")(ownerAddress, salt);
       await tx.wait();
    }

    const dummyAbi = ["function setMessage(string memory message)"];
    const dummyInterface = new ethers.Interface(dummyAbi);
    const targetCallData = dummyInterface.encodeFunctionData("setMessage", [targetActionMessage]);

    const accountInterface = new ethers.Interface(SimpleAccountABI);
    const executeCallData = accountInterface.encodeFunctionData("execute", [
      this.dummyTargetAddress,
      0, // 0 ETH value
      targetCallData
    ]);

    const userOp = {
      sender: smartWalletAddress,
      nonce: nonce,
      initCode: "0x",
      callData: executeCallData,
      callGasLimit: 200000n,
      verificationGasLimit: 200000n,
      preVerificationGas: 50000n,
      maxFeePerGas: ethers.parseUnits("10", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
      paymasterAndData: "0x",
      signature: "0x"
    };

    logger.info("Requesting Paymaster Sponsorship...");
    userOp.paymasterAndData = await this.signingService.authorizeUserOp(userOp);

    const userOpHash = await entryPoint.getFunction("getUserOpHash")(userOp);
    const ownerWallet = new ethers.Wallet(process.env.VERIFYING_SIGNER_PRIVATE_KEY!);
    userOp.signature = await ownerWallet.signMessage(ethers.getBytes(userOpHash));

    logger.info(`Broadcasting UserOp for ${userId}...`);
    const entryPointWithSigner = entryPoint.connect(this.bundlerSigner) as ethers.Contract;
    // @ts-ignore
    const tx = await entryPointWithSigner.getFunction("handleOps")([userOp], await this.bundlerSigner.getAddress());
    const receipt = await tx.wait();

    const latency = Date.now() - startTime;
    logger.info(`Transaction finalized. Hash: ${receipt.hash} | Latency: ${latency}ms`);

    const upiTransactionId = "UPI-" + Date.now().toString(); 
    await prisma.transaction.create({
      data: {
        userId: user.id,
        upiTransactionId,
        blockchainTxHash: receipt.hash,
        status: "SUCCESS"
      }
    });

    return receipt.hash;
  }

  async executeAdminTransaction(userId: string, dest: string, value: number, funcData: string): Promise<string> {
    const user = await LedgerService.getUserById(userId);
    const factory = new ethers.Contract(this.factoryAddress, SimpleAccountFactoryABI, this.provider);
    const ownerAddress = new ethers.Wallet(process.env.VERIFYING_SIGNER_PRIVATE_KEY!).address;
    const salt = BigInt(ethers.keccak256(ethers.toUtf8Bytes(user.id)));
    const smartWalletAddress = await factory.getFunction("getAddress")(ownerAddress, salt);

    const entryPoint = new ethers.Contract(this.entryPointAddress, EntryPointABI, this.provider);
    
    let nonce = 0n;
    try {
      nonce = await entryPoint.getFunction("getNonce")(smartWalletAddress, 0);
    } catch (e) {}

    const code = await this.provider.getCode(smartWalletAddress);
    if (code === "0x") {
       logger.info(`Deploying Smart Wallet for ${userId} at ${smartWalletAddress}`);
       const factoryWithSigner = factory.connect(this.bundlerSigner) as ethers.Contract;
       const tx = await factoryWithSigner.getFunction("createAccount")(ownerAddress, salt);
       await tx.wait();
    }

    const accountInterface = new ethers.Interface(SimpleAccountABI);
    const executeCallData = accountInterface.encodeFunctionData("execute", [
      dest,
      value,
      funcData
    ]);

    const userOp = {
      sender: smartWalletAddress,
      nonce: nonce,
      initCode: "0x",
      callData: executeCallData,
      callGasLimit: 200000n,
      verificationGasLimit: 200000n,
      preVerificationGas: 50000n,
      maxFeePerGas: ethers.parseUnits("10", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
      paymasterAndData: "0x",
      signature: "0x"
    };

    userOp.paymasterAndData = await this.signingService.authorizeUserOp(userOp);
    const userOpHash = await entryPoint.getFunction("getUserOpHash")(userOp);
    const ownerWallet = new ethers.Wallet(process.env.VERIFYING_SIGNER_PRIVATE_KEY!);
    userOp.signature = await ownerWallet.signMessage(ethers.getBytes(userOpHash));

    const entryPointWithSigner = entryPoint.connect(this.bundlerSigner) as ethers.Contract;
    // @ts-ignore
    const tx = await entryPointWithSigner.getFunction("handleOps")([userOp], await this.bundlerSigner.getAddress());
    const receipt = await tx.wait();
    return receipt.hash;
  }
}
