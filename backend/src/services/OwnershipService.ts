import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { LedgerService } from './ledgerService';
import { SigningService } from './signingService';
import { getAddresses } from '../config/addresses';
import { logger } from '../utils/logger';

dotenv.config();

const prisma = new PrismaClient();

const CredentialABI = [
  "function mintCredential(address to, string memory metadataURI, bytes memory issuerSignature) external returns (uint256)"
];

export class OwnershipService {
  private provider: ethers.JsonRpcProvider;
  private backendSigner: ethers.Wallet;
  private signingService: SigningService;

  public entryPointAddress: string;
  public paymasterAddress: string;
  public factoryAddress: string;
  public digitalCredentialAddress: string;

  constructor() {
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const bundlerKey = process.env.BUNDLER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
    const rawSigner = new ethers.Wallet(bundlerKey, this.provider);
    this.backendSigner = new ethers.NonceManager(rawSigner) as unknown as ethers.Wallet;
    
    this.signingService = new SigningService();

    const addresses = getAddresses();
    this.entryPointAddress = addresses.ENTRY_POINT_ADDRESS;
    this.paymasterAddress = addresses.PAYMASTER_ADDRESS;
    this.factoryAddress = addresses.SIMPLE_ACCOUNT_FACTORY;
    this.digitalCredentialAddress = addresses.DIGITAL_CREDENTIAL;
  }

  async issueCredential(userId: string, title: string) {
    const startTime = Date.now();
    logger.info(`Starting issueCredential for ${userId} - ${title}`);

    let user = await LedgerService.getUserById(userId);
    
    if (!user.smartWalletAddress) {
      const SimpleAccountFactoryABI = [
        "function getAddress(address owner, uint256 salt) view returns (address)",
        "function createAccount(address owner, uint256 salt) returns (address)"
      ];
      const factory = new ethers.Contract(this.factoryAddress, SimpleAccountFactoryABI, this.provider);
      
      const ownerAddress = new ethers.Wallet(process.env.VERIFYING_SIGNER_PRIVATE_KEY!).address;
      const salt = BigInt(ethers.keccak256(ethers.toUtf8Bytes(user.id)));
      const smartWalletAddress = await factory.getFunction("getAddress")(ownerAddress, salt);

      const code = await this.provider.getCode(smartWalletAddress);
      if (code === "0x") {
         logger.info(`Deploying Smart Wallet for ${userId} at ${smartWalletAddress}`);
         const factoryWithSigner = factory.connect(this.backendSigner) as ethers.Contract;
         const tx = await factoryWithSigner.getFunction("createAccount")(ownerAddress, salt);
         await tx.wait();
      }

      user = await prisma.user.update({
        where: { id: user.id },
        data: { smartWalletAddress }
      });
    }

    if (!user.smartWalletAddress) throw new Error("Failed to initialize Smart Wallet.");

    const metadata = {
      name: title,
      description: `Verifiable ${title} issued via Invisible Web3`,
      image: "ipfs://mock-image-hash",
      attributes: [
        { trait_type: "Issuer", value: "Platform Identity Service" },
        { trait_type: "Date", value: new Date().toISOString() }
      ]
    };
    
    const metadataURI = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString('base64')}`;

    const issuerPrivateKey = process.env.VERIFYING_SIGNER_PRIVATE_KEY!;
    const issuerWallet = new ethers.Wallet(issuerPrivateKey, this.provider);

    const hash = ethers.solidityPackedKeccak256(["address", "string"], [user.smartWalletAddress, metadataURI]);
    const issuerSignature = await issuerWallet.signMessage(ethers.getBytes(hash));

    const credentialInterface = new ethers.Interface(CredentialABI);
    const callData = credentialInterface.encodeFunctionData("mintCredential", [
      user.smartWalletAddress,
      metadataURI,
      issuerSignature
    ]);

    const accountInterface = new ethers.Interface([
      "function execute(address dest, uint256 value, bytes calldata func) external"
    ]);
    const executeCallData = accountInterface.encodeFunctionData("execute", [
      this.digitalCredentialAddress,
      0, 
      callData
    ]);

    let userOp = {
      sender: user.smartWalletAddress,
      nonce: await this.getNonce(user.smartWalletAddress),
      initCode: "0x",
      callData: executeCallData,
      callGasLimit: 300000n,
      verificationGasLimit: 200000n,
      preVerificationGas: 50000n,
      maxFeePerGas: ethers.parseUnits("10", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("10", "gwei"),
      paymasterAndData: "0x",
      signature: "0x"
    };

    logger.info("Requesting Paymaster Sponsorship for Credential Minting...");
    userOp.paymasterAndData = await this.signingService.authorizeUserOp(userOp);

    const userWallet = new ethers.Wallet(process.env.VERIFYING_SIGNER_PRIVATE_KEY!);
    const EntryPointABI = [
      "function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)"
    ];
    const entryPoint = new ethers.Contract(this.entryPointAddress, EntryPointABI, this.provider);
    const userOpHash = await entryPoint.getFunction("getUserOpHash")(userOp);
    userOp.signature = await userWallet.signMessage(ethers.getBytes(userOpHash));

    logger.info(`Broadcasting UserOp for Credential Minting for ${userId}...`);
    const bundlerEntryPoint = new ethers.Contract(this.entryPointAddress, [
      "function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary) external"
    ], this.backendSigner);

    // @ts-ignore
    const tx = await bundlerEntryPoint.getFunction("handleOps")([userOp], await this.backendSigner.getAddress());
    const receipt = await tx.wait();

    const latency = Date.now() - startTime;
    logger.info(`Credential Minting finalized. Hash: ${receipt.hash} | Latency: ${latency}ms`);

    const credentialCount = await prisma.credential.count();
    
    const credential = await prisma.credential.create({
      data: {
        userId: user.id,
        tokenId: credentialCount,
        title,
        metadataURI,
        isSoulbound: true
      }
    });

    return { success: true, txHash: receipt.hash, credential };
  }

  async getCredentials(userId: string) {
    return prisma.credential.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
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
