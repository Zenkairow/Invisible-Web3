import { ethers } from "hardhat";

async function main() {
  const [deployer, client, freelancer] = await ethers.getSigners();

  console.log("=== Phase 9.2 Refined: Pure ERC20 USDC Payout Flow ===\n");

  // 1. Deploy MockUSDC
  console.log("1. Deploying MockUSDC...");
  const USDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await USDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log(`   MockUSDC deployed at: ${usdcAddress}`);

  // 2. Deploy PayoutManager (no DEX dependency)
  console.log("2. Deploying PayoutManager (pure USDC)...");
  const PayoutManager = await ethers.getContractFactory("PayoutManager");
  const payoutManager = await PayoutManager.deploy(deployer.address, usdcAddress);
  await payoutManager.waitForDeployment();
  const payoutManagerAddress = await payoutManager.getAddress();
  console.log(`   PayoutManager deployed at: ${payoutManagerAddress}`);

  // 3. Deploy PlatformTreasury
  console.log("3. Deploying PlatformTreasury...");
  const Treasury = await ethers.getContractFactory("PlatformTreasury");
  const treasury = await Treasury.deploy(usdcAddress);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log(`   PlatformTreasury deployed at: ${treasuryAddress}`);

  console.log("\n--- Simulating Full Payout Lifecycle ---\n");

  const invoiceId = "INV-USDC-001";
  const invoiceAmount = ethers.parseUnits("500", 6); // 500 USDC

  // 4. Mint USDC to the client (simulating client having USDC)
  console.log("4. Minting 500 USDC to client...");
  await usdc.mint(client.address, invoiceAmount);
  const clientBal = await usdc.balanceOf(client.address);
  console.log(`   Client USDC balance: ${ethers.formatUnits(clientBal, 6)} USDC`);

  // 5. Client approves PayoutManager to spend their USDC
  console.log("5. Client approving PayoutManager for 500 USDC...");
  await usdc.connect(client).approve(payoutManagerAddress, invoiceAmount);

  // 6. Client funds the escrow
  console.log("6. Client funding escrow...");
  await payoutManager.connect(client).fundEscrow(invoiceId, invoiceAmount, freelancer.address);
  
  const escrowBal = await payoutManager.escrowBalance();
  console.log(`   Escrow holds: ${ethers.formatUnits(escrowBal, 6)} USDC`);

  // 7. Backend releases payment to freelancer
  console.log("7. Backend releasing payment to freelancer...");
  await payoutManager.connect(deployer).releasePayment(invoiceId);

  const freelancerBal = await usdc.balanceOf(freelancer.address);
  console.log(`   Freelancer received: ${ethers.formatUnits(freelancerBal, 6)} USDC`);

  // 8. Simulate Off-Ramp: Freelancer sends USDC to PlatformTreasury for INR conversion
  console.log("\n--- Simulating Off-Ramp via PlatformTreasury ---\n");
  
  const feeAmount = invoiceAmount * BigInt(1) / BigInt(100); // 1% fee
  const netAmount = invoiceAmount - feeAmount;
  
  console.log(`8. Off-Ramp Breakdown:`);
  console.log(`   Gross:        ${ethers.formatUnits(invoiceAmount, 6)} USDC`);
  console.log(`   Platform Fee: ${ethers.formatUnits(feeAmount, 6)} USDC (1%)`);
  console.log(`   Net Payout:   ${ethers.formatUnits(netAmount, 6)} USDC`);
  console.log(`   INR Payout:   ₹${(parseFloat(ethers.formatUnits(netAmount, 6)) * 95.00).toFixed(2)} @ ₹95.00/USDC`);

  // Freelancer deposits into treasury
  await usdc.connect(freelancer).approve(treasuryAddress, invoiceAmount);
  await treasury.connect(freelancer).deposit(invoiceAmount);
  
  const treasuryBal = await treasury.treasuryBalance();
  console.log(`   Treasury Balance: ${ethers.formatUnits(treasuryBal, 6)} USDC`);

  // Owner withdraws net amount to LP (simulated)
  await treasury.connect(deployer).withdrawToLP(deployer.address, netAmount);
  console.log(`   LP received: ${ethers.formatUnits(netAmount, 6)} USDC for fiat conversion`);

  const remainingTreasury = await treasury.treasuryBalance();
  console.log(`   Treasury retains: ${ethers.formatUnits(remainingTreasury, 6)} USDC (platform revenue)`);

  console.log("\n✅ End-to-end Pure USDC Escrow → Release → Off-Ramp Verified!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
