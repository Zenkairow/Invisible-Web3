import axios from 'axios';

async function runE2E() {
  const upiId = `user_${Date.now()}@upi`;
  const amount = 5.0; // 5 INR
  const targetAction = "Hello Web3 from UPI";

  console.log("=== UPI-Web3 End-to-End Flow ===");
  console.log(`1. Simulating UPI top-up for ${upiId}...`);

  try {
    const topUpRes = await axios.post('http://localhost:3000/simulate-upi-payment', {
      upiId,
      amount
    });
    console.log(`   Success! Current Balance: ${topUpRes.data.balance} INR`);

    console.log(`\n2. Triggering Unified Execution Flow...`);
    console.log(`   Target Action: "${targetAction}"`);
    
    const execRes = await axios.post('http://localhost:3000/execute-payment', {
      upiId,
      targetAction
    });

    console.log(`   Success! Target action executed gaslessly.`);
    console.log(`   Blockchain Transaction Hash: ${execRes.data.txHash}`);
    console.log(`\n=== Flow Complete! Welcome to Invisible Web3! ===`);
  } catch (error: any) {
    console.error("E2E Test Failed:");
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

runE2E();
