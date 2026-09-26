import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const backendSigner = signers[1] || deployer;

  console.log("Deploying contracts with the account:", deployer.address);

  const network = await ethers.provider.getNetwork();
  const isPolygon = network.chainId === 137n; // Polygon Mainnet
  const isSepolia = network.chainId === 11155111n; // Ethereum Sepolia
  const isAmoy = network.chainId === 80002n; // Polygon Amoy

  let entryPointAddress: string;
  let factoryAddress: string;
  let paymasterAddress: string;
  let factory: any;
  let paymaster: any;

  // Variables to hold addresses so they are in scope
  let dummyTargetAddress: string;
  let usdcAddress: string;
  let treasuryAddress: string;
  let mockDexAddress: string;

  if (isPolygon) {
    console.log(`Detected Polygon Mainnet! Using Official Production Infrastructure...`);
    // Mainnet global EntryPoint (ERC-4337 v0.6)
    entryPointAddress = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
    
    // Official Circle Native USDC on Polygon POS
    usdcAddress = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
    
    console.log("Using Official USDC at:", usdcAddress);

    // We still need to deploy our Factory, Paymaster, Treasury, PayoutManager, etc.
  } else if (isAmoy) {
    console.log(`Detected Amoy Testnet. Using global EntryPoint...`);
    entryPointAddress = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
    usdcAddress = "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582"; // Circle USDC Amoy (fake or real doesn't matter, we deploy mock if needed, but we deleted mock)
    // Actually, wait, since we deleted MockUSDC, let's just use the official Amoy USDC or dummy
    usdcAddress = "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582"; 
  } else if (isSepolia) {
    console.log(`Detected Sepolia Testnet. Using previously deployed infra...`);
    entryPointAddress = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
    factoryAddress = "0x9406Cc6185a346906296840746125a0E44976454";
    factory = await ethers.getContractAt("SimpleAccountFactory", factoryAddress);
    paymasterAddress = "0xfe6ed88d738558a200eaf82E393C0758742E55B5";
    paymaster = await ethers.getContractAt("VerifyingPaymaster", paymasterAddress);
    dummyTargetAddress = "0xDd0B59F0b8c6989aDFBf5d1515Ea4C022b34FeB0";
    usdcAddress = "0x3AAaf445a45674239F360Af3214739Bd6572392a";
    treasuryAddress = "0x03f07E08C5A3148436EbA152a3EDd50f04BCa063";
  } else {
    // 1. Deploy EntryPoint (Localhost only, Mainnet uses global)
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    const entryPoint = await EntryPoint.deploy();
    await entryPoint.waitForDeployment();
    entryPointAddress = await entryPoint.getAddress();
    console.log("EntryPoint deployed to:", entryPointAddress);
    
    usdcAddress = "0x0000000000000000000000000000000000000001"; // Localhost Mock
  }

  if (isPolygon || isAmoy || !isSepolia) {
    // 2. Deploy SimpleAccountFactory
    const SimpleAccountFactory = await ethers.getContractFactory("SimpleAccountFactory");
    factory = await SimpleAccountFactory.deploy(entryPointAddress);
    await factory.waitForDeployment();
    factoryAddress = await factory.getAddress();
    console.log("SimpleAccountFactory deployed to:", factoryAddress);

    // 3. Deploy VerifyingPaymaster
    const VerifyingPaymaster = await ethers.getContractFactory("VerifyingPaymaster");
    paymaster = await VerifyingPaymaster.deploy(entryPointAddress, backendSigner.address);
    await paymaster.waitForDeployment();
    paymasterAddress = await paymaster.getAddress();
    console.log("VerifyingPaymaster deployed to:", paymasterAddress);

    // 3.5 Deploy DummyTarget (nonce 3)
    const DummyTarget = await ethers.getContractFactory("DummyTarget");
    const dummyTarget = await DummyTarget.deploy();
    await dummyTarget.waitForDeployment();
    dummyTargetAddress = await dummyTarget.getAddress();
    console.log("DummyTarget deployed to:", dummyTargetAddress);

    // 3.7 Deploy PlatformTreasury
    const PlatformTreasury = await ethers.getContractFactory("PlatformTreasury");
    const treasury = await PlatformTreasury.deploy(usdcAddress);
    await treasury.waitForDeployment();
    treasuryAddress = await treasury.getAddress();
    console.log("PlatformTreasury deployed to:", treasuryAddress);
  }

  // 3.8 Deploy PayoutManager (nonce 4)
  const PayoutManager = await ethers.getContractFactory("PayoutManager");
  const payoutManager = await PayoutManager.deploy(backendSigner.address, usdcAddress);
  await payoutManager.waitForDeployment();
  const payoutManagerAddress = await payoutManager.getAddress();
  console.log("PayoutManager deployed to:", payoutManagerAddress);

  // 3.9 Deploy AIAgentWalletFactory (nonce 5)
  const AIAgentWalletFactory = await ethers.getContractFactory("AIAgentWalletFactory");
  const aiAgentWalletFactory = await AIAgentWalletFactory.deploy(entryPointAddress);
  await aiAgentWalletFactory.waitForDeployment();
  const aiAgentWalletFactoryAddress = await aiAgentWalletFactory.getAddress();
  console.log("AIAgentWalletFactory deployed to:", aiAgentWalletFactoryAddress);

  // 3.8 Deploy DigitalCredential (nonce 6)
  const DigitalCredential = await ethers.getContractFactory("DigitalCredential");
  // backendSigner will be the authorized issuer, and true for Soulbound
  const digitalCredential = await DigitalCredential.deploy(backendSigner.address, true);
  await digitalCredential.waitForDeployment();
  const digitalCredentialAddress = await digitalCredential.getAddress();
  console.log("DigitalCredential deployed to:", digitalCredentialAddress);

  // Write to a ts file for backend usage
  const tsContent = `import dotenv from 'dotenv';
dotenv.config();

export const getAddresses = () => {
  return {
    ENTRY_POINT_ADDRESS: "${entryPointAddress}",
    PAYMASTER_ADDRESS: "${paymasterAddress}",
    SIMPLE_ACCOUNT_FACTORY: "${factoryAddress}",
    DUMMY_TARGET_ADDRESS: "${dummyTargetAddress}",
    AI_WALLET_FACTORY: "${aiAgentWalletFactoryAddress}",
    DIGITAL_CREDENTIAL: "${digitalCredentialAddress}",
    PAYOUT_MANAGER: "${payoutManagerAddress}",
    USDC: "${usdcAddress}",
    PLATFORM_TREASURY: "${treasuryAddress}"
  };
};
`;
  fs.writeFileSync("addresses.ts", tsContent);

  // 4. Deposit ETH to the Paymaster
  const depositAmount = isPolygon ? ethers.parseEther("2.0") : ((isAmoy || isSepolia) ? ethers.parseEther("0.005") : ethers.parseEther("0.1"));
  console.log(`Depositing ${ethers.formatEther(depositAmount)} ETH to Paymaster...`);
  await paymaster.deposit({ value: depositAmount });
  
  // 5. Create a Smart Account
  const salt = 0n;
  await factory.createAccount(backendSigner.address, salt);
  const accountAddress = await factory.getFunction("getAddress")(backendSigner.address, salt);
  console.log("UPI Smart Wallet deployed at:", accountAddress);

  // 6. Demonstrate a sponsored transaction
  console.log("Simulating a sponsored transaction...");
  const SimpleAccount = await ethers.getContractFactory("SimpleAccount");
  const account = SimpleAccount.attach(accountAddress) as any;

  // Let's create a UserOp
  const nonce = await entryPoint.getNonce(accountAddress, 0);
  
  // We want the account to do something, e.g., send 0 ETH to itself.
  const callData = account.interface.encodeFunctionData("execute", [
    accountAddress,
    0,
    "0x"
  ]);

  const userOp = {
    sender: accountAddress,
    nonce: nonce,
    initCode: "0x",
    callData: callData,
    callGasLimit: 200000,
    verificationGasLimit: 200000,
    preVerificationGas: 50000,
    maxFeePerGas: ethers.parseUnits("10", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
    paymasterAndData: "0x",
    signature: "0x"
  };

  // Construct paymasterAndData: [paymaster address] [validUntil] [validAfter] [signature]
  const validUntil = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  const validAfter = 0;
  
  const abiCoder = new ethers.AbiCoder();
  const validityData = abiCoder.encode(["uint48", "uint48"], [validUntil, validAfter]);
  
  const paymasterAndDataWithoutSig = ethers.concat([
    paymasterAddress,
    validityData
  ]);
  
  // We MUST set the correct length for paymasterAndData before calling getHash, 
  // because its length affects the 'signature' offset in the ABI-encoded UserOperation.
  const dummySignature = "0x" + "00".repeat(65);
  userOp.paymasterAndData = ethers.concat([paymasterAndDataWithoutSig, dummySignature]);

  // Call getHash on paymaster to get the hash to sign
  const hashToSign = await paymaster.getHash(userOp, validUntil, validAfter);
  
  // Sign the hash with the verifyingSigner
  const paymasterSignature = await backendSigner.signMessage(ethers.getBytes(hashToSign));
  
  // Complete paymasterAndData
  userOp.paymasterAndData = ethers.concat([
    paymasterAndDataWithoutSig,
    paymasterSignature
  ]);

  // Now, get the userOp hash from the entryPoint to sign as the owner
  const userOpHash = await entryPoint.getUserOpHash(userOp);
  
  // Owner is the backendSigner
  const ownerSignature = await backendSigner.signMessage(ethers.getBytes(userOpHash));
  userOp.signature = ownerSignature;

  // Execute the transaction via EntryPoint
  console.log("Sending UserOperation to EntryPoint...");
  const tx = await entryPoint.handleOps([userOp], deployer.address);
  const receipt = await tx.wait();

  console.log("Transaction sponsored and executed successfully!");
  console.log("Gas Used:", receipt.gasUsed.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
