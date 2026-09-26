import express, { Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import { AuthService } from './services/AuthService';
import { LedgerService } from './services/ledgerService';
import { authMiddleware } from './middleware/authMiddleware';
import { logger } from './utils/logger';
import { getJsonRpcProvider } from './utils/provider';

const app = express();
app.use(cors());
app.use(express.json());

// --- Real-Time SSE Event Bus ---
const sseClients: Set<Response> = new Set();

function broadcast(event: string) {
  const data = `data: ${JSON.stringify({ type: event, ts: Date.now() })}\n\n`;
  for (const client of sseClients) {
    try { client.write(data); } catch { sseClients.delete(client); }
  }
}

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  res.write('data: {"type":"connected"}\n\n');
  sseClients.add(res);

  // Keepalive heartbeat every 15s to prevent proxy/browser timeout
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 15000);

  req.on('close', () => {
    sseClients.delete(res);
    clearInterval(heartbeat);
  });
});

// ============================================================
// PUBLIC AUTH ENDPOINTS (no middleware required)
// ============================================================

app.post('/auth/signup', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: "Missing identifier or password" });
    }
    const result = await AuthService.signup(identifier, password);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/auth/send-otp', async (req, res) => {
  try {
    const { target, purpose } = req.body;
    if (!target || !purpose) {
      return res.status(400).json({ error: "Missing target or purpose" });
    }
    const result = await AuthService.sendOtp(target, purpose);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/auth/verify-otp', async (req, res) => {
  try {
    const { target, otp, purpose } = req.body;
    if (!target || !otp || !purpose) {
      return res.status(400).json({ error: "Missing target, otp, or purpose" });
    }
    const valid = await AuthService.verifyOtp(target, otp, purpose);
    if (!valid) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    if (purpose === "SIGNUP") {
      const type = target.includes('@') ? 'email' : 'mobile';
      const user = type === 'email'
        ? await prisma.user.findUnique({ where: { email: target } })
        : await prisma.user.findUnique({ where: { mobile: target } });
      
      if (user) {
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
          { userId: user.id, email: user.email, mobile: user.mobile },
          process.env.JWT_SECRET || 'fallback-dev-secret',
          { expiresIn: '24h' }
        );
        return res.json({ 
          valid: true, 
          token, 
          user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, displayName: user.displayName } 
        });
      }
    }

    res.json({ valid: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/auth/login-step1', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: "Missing identifier or password" });
    }
    const result = await AuthService.verifyPasswordAndSendOtp(identifier, password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { identifier, password, otp } = req.body;
    if (!identifier || !password || !otp) {
      return res.status(400).json({ error: "Missing identifier, password, or otp" });
    }
    const result = await AuthService.login(identifier, password, otp);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// ============================================================
// PROTECTED ENDPOINTS (require JWT via authMiddleware)
// ============================================================

// --- Profile ---
app.get('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const profile = await AuthService.getProfile(userId);
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { firstName, lastName, displayName, upiId } = req.body;
    const result = await AuthService.updateProfile(userId, { firstName, lastName, displayName, upiId });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/profile/link-account', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { identifier, otp } = req.body;
    if (!identifier || !otp) {
      return res.status(400).json({ error: "Missing identifier or otp" });
    }
    const result = await AuthService.linkAccount(userId, identifier, otp);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/profile/kyc', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const profile = await AuthService.getProfile(userId);
    res.json({ kycStatus: profile.kycStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Balance & Wallet ---
app.get('/balance', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const balance = await LedgerService.getBalance(userId);
    let smartWalletAddress: string | null = null;
    try {
      smartWalletAddress = await LedgerService.ensureSmartWallet(userId);
    } catch { /* ignore if chain not running */ }
    res.json({ balance, smartWalletAddress });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Dashboard Unified Data Endpoint ---
app.get('/dashboard-data', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const isAdmin = user.email === "admin@invisibleweb3.com";

    // Run all regular user queries concurrently
    const [
      balanceRaw,
      invoices,
      agents,
      credentials
    ] = await Promise.all([
      LedgerService.getBalance(userId),
      productService.getInvoices(userId),
      aiService.getAgents(userId),
      ownershipService.getCredentials(userId)
    ]);

    let smartWalletAddress: string | null = null;
    try {
      smartWalletAddress = await LedgerService.ensureSmartWallet(userId);
    } catch { /* ignore */ }

    // Prepare response object
    const data: any = {
      balance: balanceRaw,
      smartWalletAddress,
      invoices,
      agents,
      credentials
    };

    // If admin, fetch admin data concurrently
    if (isAdmin) {
      const [
        pendingDeposits,
        pendingWithdrawals,
      ] = await Promise.all([
        FiatDepositService.getPendingDeposits(),
        FiatWithdrawalService.getPendingWithdrawals()
      ]);

      let treasuryBalance = "0";
      try {
        const { ethers } = require('ethers');
        const addresses = getAddresses();
        const provider = getJsonRpcProvider();
        const erc20 = new ethers.Contract(addresses.USDC, ["function balanceOf(address) view returns (uint256)"], provider);
        const bal = await erc20.balanceOf(addresses.PLATFORM_TREASURY);
        treasuryBalance = ethers.formatUnits(bal, 6);
      } catch { /* ignore */ }

      data.adminData = {
        pendingDeposits,
        pendingWithdrawals,
        treasuryBalance
      };
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Invoices & Public Payment Portal ---
import { ProductService } from './services/ProductService';
import { OnRampService } from './services/OnRampService';
import { PrismaClient } from '@prisma/client';

const productService = new ProductService();
const onRampService = new OnRampService();
const prisma = new PrismaClient();

app.get('/public/invoices/:id', async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { displayName: true, email: true } } }
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    
    res.json({
      id: invoice.id,
      amount: invoice.amount,
      description: invoice.description,
      status: invoice.status,
      freelancerName: invoice.user.displayName || invoice.user.email
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/webhooks/onramp-success', async (req, res) => {
  try {
    const { invoiceId, clientName, clientEmail } = req.body;
    const result = await onRampService.processFiatPayment(invoiceId, clientName, clientEmail);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/create-invoice', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { amount, description } = req.body;
    const invoice = await productService.createInvoice(userId, amount, description);
    broadcast('invoice-created');
    res.json(invoice);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/release-invoice', authMiddleware, async (req, res) => {
  try {
    const { invoiceId } = req.body;
    const result = await productService.releasePayment(invoiceId);
    broadcast('invoice-released');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/withdraw', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const result = await productService.withdrawToBank(userId);
    broadcast('balance-changed');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

import { CryptoPayoutService } from './services/CryptoPayoutService';

app.post('/payout/crypto', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { destination, amount, targetCurrency } = req.body;
    const result = await CryptoPayoutService.processCryptoPayout(userId, destination, parseFloat(amount), targetCurrency);
    broadcast('balance-changed');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

import { FiatDepositService } from './services/FiatDepositService';
import { FiatWithdrawalService } from './services/FiatWithdrawalService';
import { getAddresses } from './config/addresses';

const adminMiddleware = async (req: any, res: any, next: any) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (user?.email !== "admin@invisibleweb3.com") {
      return res.status(403).json({ error: "Forbidden: Admin access required." });
    }
    next();
  } catch (err: any) {
    res.status(500).json({ error: "Server error during admin verification." });
  }
};

app.post('/fiat-deposit/request', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { amountINR, expectedUSDC, utrNumber } = req.body;
    const deposit = await FiatDepositService.requestDeposit(userId, parseFloat(amountINR), parseFloat(expectedUSDC), utrNumber);
    broadcast('deposit-requested');
    res.json(deposit);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/admin/fiat-deposits', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const deposits = await FiatDepositService.getPendingDeposits();
    res.json(deposits);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/admin/fiat-deposit/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { depositId } = req.body;
    const result = await FiatDepositService.approveDeposit(depositId);
    broadcast('deposit-approved');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Fiat Withdrawal (Off-Ramp) ---
app.post('/fiat-withdrawal/request', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { amountUSDC, amountINR, userUpiId } = req.body;
    const withdrawal = await FiatWithdrawalService.requestWithdrawal(userId, parseFloat(amountUSDC), parseFloat(amountINR), userUpiId);
    broadcast('withdrawal-requested');
    res.json(withdrawal);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/admin/fiat-withdrawals', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const withdrawals = await FiatWithdrawalService.getPendingWithdrawals();
    res.json(withdrawals);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/admin/fiat-withdrawal/mark-paid', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { withdrawalId } = req.body;
    const result = await FiatWithdrawalService.markAsPaid(withdrawalId);
    broadcast('withdrawal-paid');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/admin/fiat-withdrawal/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { withdrawalId } = req.body;
    const result = await FiatWithdrawalService.rejectWithdrawal(withdrawalId);
    broadcast('withdrawal-rejected');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Treasury Balance ---
app.get('/admin/treasury-balance', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { ethers } = require('ethers');
    const addresses = getAddresses();
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
    const erc20 = new ethers.Contract(addresses.USDC, ["function balanceOf(address) view returns (uint256)"], provider);
    const bal = await erc20.balanceOf(addresses.PLATFORM_TREASURY);
    const formatted = ethers.formatUnits(bal, 6);
    res.json({ treasuryBalance: formatted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/transak/widget-url', authMiddleware, async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ error: "Missing walletAddress" });

    // Construct the Staging URL directly
    const redirectUrl = encodeURIComponent("http://localhost:3001/dashboard?fiatSuccess=true");
    const widgetUrl = `https://global-stg.transak.com/?apiKey=${process.env.TRANSAK_API_KEY}&cryptoCurrencyCode=USDC&network=polygon&defaultFiatCurrency=INR&disableCryptoCurrencyList=true&walletAddress=${walletAddress}&redirectURL=${redirectUrl}`;

    res.json({ widgetUrl });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Transak Off-Ramp Endpoint
app.post('/transak/offramp-url', authMiddleware, async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ error: "Missing walletAddress" });

    const tokenRes = await fetch("https://api-stg.transak.com/partners/api/v2/refresh-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-secret": process.env.TRANSAK_API_SECRET as string
      },
      body: JSON.stringify({
        apiKey: process.env.TRANSAK_API_KEY
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.data || !tokenData.data.accessToken) {
      console.error("Transak Token Error:", tokenData);
      throw new Error("Failed to generate Transak partner access token");
    }

    const widgetRes = await fetch("https://api-gateway-stg.transak.com/api/v2/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access-token": tokenData.data.accessToken
      },
      body: JSON.stringify({
        widgetParams: {
          apiKey: process.env.TRANSAK_API_KEY,
          environment: "STAGING",
          productsAvailed: "SELL",
          cryptoCurrencyCode: "USDC",
          network: "polygon",
          referrerDomain: "http://localhost:3001",
          walletAddress: walletAddress,
          redirectURL: "http://localhost:3001/dashboard?offrampSuccess=true"
        }
      })
    });

    const widgetData = await widgetRes.json();
    if (!widgetData.data || !widgetData.data.widgetUrl) {
      console.error("Transak Off-Ramp Widget Error:", widgetData);
      throw new Error("Failed to generate Transak signed off-ramp URL");
    }

    res.json({ widgetUrl: widgetData.data.widgetUrl });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/fiat/success', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { amount, txId } = req.body;
    
    // In a real production app, we would cryptographically verify the Transak Webhook signature here.
    // For Sandbox, we trust the authenticated user's frontend signal to bridge the tokens.
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.smartWalletAddress) throw new Error("Wallet not found");
    
    // In Production, Transak directly transfers USDC to the Smart Wallet on Polygon.
    // We no longer mint MockUSDC. We just sync the Ledger database to record the fiat deposit!
    
    // Also update our internal DB ledger
    await prisma.ledger.create({
      data: {
        userId: userId,
        amount: amount,
        description: "Fiat On-Ramp Deposit (Transak Polygon)"
      }
    });
    
    res.json({ success: true, message: "On-Ramp ledger sync successful" });
  } catch (err: any) {
    console.error("Fiat On-Ramp Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/invoices', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const invoices = await productService.getInvoices(userId);
    res.json(invoices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Execute Payment (Blockchain) ---
import { TransactionOrchestrator } from './services/TransactionOrchestrator';

app.post('/execute-payment', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { targetAction } = req.body;
    if (!targetAction) {
      return res.status(400).json({ error: 'Missing targetAction' });
    }
    const orchestrator = new TransactionOrchestrator();
    const txHash = await orchestrator.processIncomingPayment(userId, 5.0, targetAction);
    broadcast('balance-changed');
    res.json({ success: true, txHash });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- AI Agents ---
import { AIService } from './services/AIService';
const aiService = new AIService();

app.post('/create-ai-agent', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { dailyBudget } = req.body;
    const agent = await aiService.createAIAgent(userId, dailyBudget);
    broadcast('agent-created');
    res.json(agent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/simulate-ai-action', authMiddleware, async (req, res) => {
  try {
    const { agentId, costInINR } = req.body;
    const result = await aiService.simulateAIAction(agentId, costInINR);
    broadcast('agent-action');
    res.json(result);
  } catch (err: any) {
    if (err.message.includes("Transaction Rejected by Policy Engine")) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.get('/ai-agents', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const agents = await aiService.getAgents(userId);
    res.json(agents);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Digital Credentials ---
import { OwnershipService } from './services/OwnershipService';
import { GatewayService } from './services/GatewayService';

const ownershipService = new OwnershipService();

app.post('/issue-credential', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { title } = req.body;
    const credential = await ownershipService.issueCredential(userId, title);
    broadcast('credential-issued');
    res.json(credential);
  } catch (err: any) {
    logger.error(`Error issuing credential: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.get('/credentials', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const credentials = await ownershipService.getCredentials(userId);
    res.json(credentials);
  } catch (err: any) {
    logger.error(`Error fetching credentials: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// --- Webhooks (public, but with future signature verification) ---
const gatewayService = new GatewayService();

app.post('/webhooks/upi-success', async (req, res) => {
  try {
    const result = await gatewayService.handleUpiSuccessWebhook(req.body);
    res.json(result);
  } catch (err: any) {
    logger.error(`Webhook Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Backend Orchestration Engine running on port ${PORT}`);
});
