"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { Toaster, toast } from "sonner";
import {
  Wallet, FileText, Bot, Shield, Plus, Send, Zap, CreditCard,
  Loader2, LogOut, User, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Copy, Layers, DollarSign
} from "lucide-react";

type Tab = "overview" | "invoices" | "agents" | "vault" | "admin";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading: authLoading, logout, apiClient } = useAuth();

  // --- State ---
  const [balance, setBalance] = useState(0);
  const [smartWallet, setSmartWallet] = useState("");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Modals
  const [txHash, setTxHash] = useState<string | null>(null);
  const [telemetryState, setTelemetryState] = useState("");
  const [withdrawResult, setWithdrawResult] = useState<any>(null);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  
  const [isSendCryptoModalOpen, setIsSendCryptoModalOpen] = useState(false);
  const [cryptoDestination, setCryptoDestination] = useState("");
  const [cryptoAmount, setCryptoAmount] = useState("");
  const [targetCurrency, setTargetCurrency] = useState("ETH");
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  
  // P2P UPI State
  const [depositAmountUSDC, setDepositAmountUSDC] = useState("10");
  const [utrNumber, setUtrNumber] = useState("");
  const [isSubmittingUtr, setIsSubmittingUtr] = useState(false);
  const [inrRate, setInrRate] = useState(85); // Default fallback, updated live

  // Withdrawal State
  const [withdrawAmountUSDC, setWithdrawAmountUSDC] = useState("");
  const [withdrawUpiId, setWithdrawUpiId] = useState("");
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);

  // Admin State
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [treasuryBalance, setTreasuryBalance] = useState<string | null>(null);
  const [isAdminProcessing, setIsAdminProcessing] = useState<string | null>(null);

  const topCryptos = ["USDC", "ETH", "BTC", "SOL", "MATIC", "BNB", "XRP", "ADA", "DOGE", "DOT"];

  // Inputs
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDesc, setInvoiceDesc] = useState("");
  const [agentBudget, setAgentBudget] = useState("");
  const [credTitle, setCredTitle] = useState("");
  const [actionTarget, setActionTarget] = useState("");

  // Loading
  const [isCreating, setIsCreating] = useState(false);

  // --- Auth Guard ---
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/auth");
  }, [authLoading, isAuthenticated, router]);

  // --- Unified Data Fetching ---
  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await apiClient.get("/dashboard-data");
      const { balance, smartWalletAddress, invoices, agents, credentials, adminData } = res.data;
      
      setBalance(balance || 0);
      setSmartWallet(smartWalletAddress || "");
      setInvoices(invoices || []);
      setAgents(agents || []);
      setCredentials(credentials || []);
      
      if (adminData) {
        setPendingDeposits(adminData.pendingDeposits || []);
        setPendingWithdrawals(adminData.pendingWithdrawals || []);
        setTreasuryBalance(adminData.treasuryBalance || "0");
      }
    } catch (e) {
      console.error("Failed to fetch dashboard data", e);
    }
  }, [apiClient]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();

      // Fetch live USDC/INR rate
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=inr")
        .then(res => res.json())
        .then(data => {
          if (data && data["usd-coin"] && data["usd-coin"].inr) {
            setInrRate(data["usd-coin"].inr);
          }
        })
        .catch(err => console.error("Failed to fetch live rate", err));
    }
  }, [isAuthenticated, fetchDashboardData]);

  // --- Real-Time SSE Listener (instant updates, no polling) ---
  useEffect(() => {
    if (!isAuthenticated) return;

    let fallbackInterval: NodeJS.Timeout | null = null;

    const refreshAll = () => {
      fetchDashboardData();
    };

    // Connect SSE through the Next.js proxy to avoid cross-origin issues
    const eventSource = new EventSource("/api/events");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = data.type;
        if (type === "connected") return;

        // Since we aggregated endpoints, any event just triggers a unified refresh
        refreshAll();
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    eventSource.onerror = () => {
      // SSE connection failed — activate fallback polling
      if (!fallbackInterval) {
        fallbackInterval = setInterval(refreshAll, 4000);
      }
    };

    return () => {
      eventSource.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [isAuthenticated, fetchDashboardData]);

  // --- Fiat Success Handler ---
  useEffect(() => {
    const handleFiatSuccess = async () => {
      if (searchParams.get("fiatSuccess") === "true") {
        setTelemetryState("Bridging Fiat tokens to MockUSDC Ecosystem...");
        try {
          const amount = 100; // Simulated $100 for STAGING
          await apiClient.post("/fiat/success", { amount, txId: "sandbox_tx_redirect" });
          toast.success(`Fiat On-Ramp Successful: $${amount} deposited to Smart Wallet.`);
          fetchDashboardData();
        } catch (e: any) {
          toast.error("Bridge failed: " + (e.response?.data?.error || e.message));
        } finally {
          setTelemetryState("");
          router.replace("/dashboard");
        }
      }
    };
    handleFiatSuccess();
  }, [searchParams, apiClient, fetchDashboardData, router]);

  // --- Handlers ---
  const handleCreateInvoice = async () => {
    if (!invoiceAmount || !invoiceDesc) return toast.error("Fill in amount and description");
    setIsCreating(true);
    try {
      await apiClient.post("/create-invoice", { amount: parseFloat(invoiceAmount), description: invoiceDesc });
      toast.success("Invoice created!");
      setInvoiceAmount(""); setInvoiceDesc("");
      fetchDashboardData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed");
    } finally { setIsCreating(false); }
  };

  const handleReleaseInvoice = async (invoiceId: string) => {
    setTelemetryState("Claiming funds from Escrow...");
    try {
      const res = await apiClient.post("/release-invoice", { invoiceId });
      toast.success("Payment claimed and released!");
      fetchDashboardData();
} catch (e: any) {
      toast.error(e.response?.data?.error || "Failed");
    } finally { setTelemetryState(""); }
  };

  const handleCopyLink = (invoiceId: string) => {
    const link = `${window.location.origin}/invoice/${invoiceId}`;
    navigator.clipboard.writeText(link);
    toast.success("Payment link copied to clipboard!");
  };



  const handleSendCrypto = async () => {
    if (!cryptoDestination || !cryptoAmount) return toast.error("Fill in destination and amount");
    setTelemetryState(targetCurrency !== "USDC" ? "Routing via DEX Aggregator..." : "Verifying Internal Ledger...");
    setIsSendCryptoModalOpen(false);
    try {
      const res = await apiClient.post("/payout/crypto", { 
        destination: cryptoDestination, 
        amount: cryptoAmount, 
        targetCurrency 
      });
      setTelemetryState("Payout Dispatched!");
      setTimeout(() => {
        setTelemetryState("");
        toast.success(`Sent! TX: ${res.data.txHash.substring(0,10)}...`);
      }, 1000);
      setCryptoDestination("");
      setCryptoAmount("");
      fetchDashboardData();
    } catch (e: any) {
      setTelemetryState("");
      toast.error(e.response?.data?.error || "Payout failed");
    }
  };

  const handleFundWallet = async () => {
    if (!smartWallet) return toast.error("Smart wallet not initialized");
    setIsDepositModalOpen(true);
  };

  const handleCreateAgent = async () => {
    if (!agentBudget) return toast.error("Enter a budget");
    setIsCreating(true);
    try {
      await apiClient.post("/create-ai-agent", { dailyBudget: parseFloat(agentBudget) });
      toast.success("AI Agent created!");
      setAgentBudget("");
      fetchDashboardData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed");
    } finally { setIsCreating(false); }
  };

  const handleSimulateAI = async (agentId: string) => {
    try {
      const res = await apiClient.post("/simulate-ai-action", { agentId, costInINR: 2 });
      toast.success(`AI action completed! TX: ${res.data.txHash?.substring(0, 10)}...`);
      fetchDashboardData();
} catch (e: any) {
      toast.error(e.response?.data?.error || "Failed");
    }
  };

  const handleExecutePayment = async () => {
    if (!actionTarget) return toast.error("Enter target action");
    setTelemetryState("Broadcasting to blockchain...");
    try {
      const res = await apiClient.post("/execute-payment", { targetAction: actionTarget });
      setTxHash(res.data.txHash);
      toast.success("Payment executed!");
      setActionTarget("");
      fetchDashboardData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed");
    } finally { setTelemetryState(""); }
  };

  const handleIssueCredential = async () => {
    if (!credTitle) return toast.error("Enter a title");
    setIsCreating(true);
    try {
      const res = await apiClient.post("/issue-credential", { title: credTitle });
      toast.success(`Credential minted! TX: ${res.data.txHash?.substring(0, 10)}...`);
      setCredTitle("");
      fetchDashboardData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed");
    } finally { setIsCreating(false); }
  };

  const handleSubmitDeposit = async () => {
    if (!utrNumber || utrNumber.length < 5) return toast.error("Please enter a valid UTR number");
    if (!depositAmountUSDC || parseFloat(depositAmountUSDC) <= 0) return toast.error("Invalid amount");

    setIsSubmittingUtr(true);
    setTelemetryState("Securing P2P Deposit Request...");
    try {
      const amountINR = parseFloat(depositAmountUSDC) * inrRate;
      await apiClient.post("/fiat-deposit/request", {
        amountINR,
        expectedUSDC: parseFloat(depositAmountUSDC),
        utrNumber
      });
      toast.success("Deposit request submitted! Awaiting Admin Verification.");
      setIsDepositModalOpen(false);
      setUtrNumber("");
      fetchDashboardData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to submit deposit request");
    } finally {
      setIsSubmittingUtr(false);
      setTelemetryState("");
    }
  };

  const handleApproveDeposit = async (id: string) => {
    setIsAdminProcessing(id);
    setTelemetryState("Executing Smart Contract Dispersion...");
    try {
      await apiClient.post("/admin/fiat-deposit/approve", { depositId: id });
      toast.success("Deposit Approved! USDC dispersed via Smart Contract.");
      fetchDashboardData();
} catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to approve deposit");
    } finally {
      setIsAdminProcessing(null);
      setTelemetryState("");
    }
  };

  const handleSubmitWithdrawal = async () => {
    const amt = parseFloat(withdrawAmountUSDC);
    if (!amt || amt < 1) return toast.error("Minimum withdrawal is 1 USDC");
    if (amt > balance) return toast.error("Insufficient balance");
    if (!withdrawUpiId || withdrawUpiId.length < 3) return toast.error("Enter a valid UPI ID");

    setIsSubmittingWithdraw(true);
    setTelemetryState("Submitting Withdrawal Request...");
    try {
      const amountINR = amt * inrRate;
      await apiClient.post("/fiat-withdrawal/request", {
        amountUSDC: amt,
        amountINR,
        userUpiId: withdrawUpiId
      });
      toast.success("Withdrawal request submitted! Admin will pay you via UPI.");
      setIsWithdrawModalOpen(false);
      setWithdrawAmountUSDC("");
      setWithdrawUpiId("");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to submit withdrawal");
    } finally {
      setIsSubmittingWithdraw(false);
      setTelemetryState("");
    }
  };

  const handleMarkWithdrawalPaid = async (id: string) => {
    setIsAdminProcessing(id);
    setTelemetryState("Processing Withdrawal Payout...");
    try {
      await apiClient.post("/admin/fiat-withdrawal/mark-paid", { withdrawalId: id });
      toast.success("Withdrawal marked as paid! User balance debited.");
      fetchDashboardData();
} catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to process withdrawal");
    } finally {
      setIsAdminProcessing(null);
      setTelemetryState("");
    }
  };

  const handleRejectWithdrawal = async (id: string) => {
    if (!confirm("Are you sure you want to reject this withdrawal request?")) return;
    setIsAdminProcessing(id);
    setTelemetryState("Rejecting Withdrawal Request...");
    try {
      await apiClient.post("/admin/fiat-withdrawal/reject", { withdrawalId: id });
      toast.success("Withdrawal rejected.");
      fetchDashboardData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to reject withdrawal");
    } finally {
      setIsAdminProcessing(null);
      setTelemetryState("");
    }
  };

  if (authLoading || !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;
  }

  const displayName = user?.displayName || user?.email || user?.mobile || "User";

  const tabs = [
    { id: "overview", label: "Overview", icon: Layers },
    { id: "invoices", label: "Invoices", icon: FileText },
    { id: "agents", label: "AI Agents", icon: Bot },
    { id: "vault", label: "Digital Vault", icon: Shield }
  ];

  if (user?.email === "admin@invisibleweb3.com") {
    tabs.push({ id: "admin", label: "Admin Panel", icon: Shield });
  }

  return (
    <main className="min-h-screen pb-10">
      <Toaster theme="dark" position="top-center" richColors />

      {/* Telemetry Overlay */}
      <AnimatePresence>
        {telemetryState && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <div className="glassmorphism rounded-2xl p-8 text-center max-w-sm">
              <Loader2 className="animate-spin w-10 h-10 text-primary mx-auto mb-4" />
              <p className="text-lg font-medium">{telemetryState}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WITHDRAW USDC MODAL */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl"
          >
            <div className="p-6">
              <h2 className="text-xl font-bold mb-2 flex items-center gap-2"><ArrowUpFromLine className="w-5 h-5 text-orange-400" /> Withdraw USDC to Bank</h2>
              <p className="text-gray-400 text-sm mb-6">Convert your USDC to INR. Admin will pay you via UPI after verification.</p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold">Amount to Withdraw (USDC)</label>
                  <input
                    type="number"
                    min="1"
                    max={balance}
                    value={withdrawAmountUSDC}
                    onChange={(e) => setWithdrawAmountUSDC(e.target.value)}
                    placeholder={`Max: ${balance.toFixed(2)} USDC`}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <p className="text-xs text-orange-400 mt-1 flex items-center justify-between">
                    <span>You receive: ₹{(parseFloat(withdrawAmountUSDC || "0") * inrRate).toFixed(2)}</span>
                    <span className="text-gray-500">Live Rate: 1 USDC = ₹{inrRate}</span>
                  </p>
                </div>

                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold">Your UPI ID</label>
                  <input
                    type="text"
                    placeholder="e.g. yourname@upi"
                    value={withdrawUpiId}
                    onChange={(e) => setWithdrawUpiId(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">We will send ₹{(parseFloat(withdrawAmountUSDC || "0") * inrRate).toFixed(2)} to this UPI ID</p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white/5 border-t border-white/10 flex justify-end gap-2">
              <button onClick={() => setIsWithdrawModalOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmitWithdrawal} disabled={isSubmittingWithdraw} className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
                {isSubmittingWithdraw ? <Loader2 className="w-4 h-4 animate-spin" /> : "Request Withdrawal"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* DEPOSIT CRYPTO MODAL */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl"
          >
            <div className="p-6">
              <h2 className="text-xl font-bold mb-2">Buy USDC via UPI</h2>
              <p className="text-gray-400 text-sm mb-6">Internal P2P Network: Instantly fund your Smart Wallet with Indian Rupees (0% fee).</p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold">Amount to Buy (USDC)</label>
                  <input
                    type="number"
                    value={depositAmountUSDC}
                    onChange={(e) => setDepositAmountUSDC(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="text-xs text-emerald-400 mt-1 flex items-center justify-between">
                    <span>You pay: ₹{(parseFloat(depositAmountUSDC || "0") * inrRate).toFixed(2)}</span>
                    <span className="text-gray-500">Live Rate: 1 USDC = ₹{inrRate}</span>
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl flex items-center justify-center mx-auto w-48 h-48 relative overflow-hidden">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=7498304649@upi&pn=InvisibleWeb3&am=${(parseFloat(depositAmountUSDC || "0") * inrRate).toFixed(2)}&cu=INR`)}`} alt="UPI QR Code" className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/10 pointer-events-none"></div>
                </div>
                
                <p className="text-center text-xs text-gray-500">Scan via GPay, PhonePe, or Paytm</p>

                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold">Step 2: Enter 12-Digit UTR Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 123456789012"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 bg-white/5 border-t border-white/10 flex justify-end gap-2">
              <button onClick={() => setIsDepositModalOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmitDeposit} disabled={isSubmittingUtr} className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
                {isSubmittingUtr ? <Loader2 className="w-4 h-4 animate-spin" /> : "I have paid"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-black/50 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-primary">IW3</span> Dashboard
          </h1>
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/profile")} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
              <User className="w-4 h-4" /> Profile
            </button>
            <button onClick={() => { logout(); router.push("/auth"); }} className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 mt-8">
        {/* Welcome & Balance */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-1">Welcome back, <span className="text-primary">{displayName}</span></h2>
          <p className="text-sm text-gray-400">Your global financial dashboard</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <motion.div className="glassmorphism rounded-xl p-6 col-span-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Global USDC Balance</p>
            <p className="text-4xl font-bold font-mono text-white">${balance.toFixed(2)} <span className="text-lg text-gray-400">USDC</span></p>
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={() => setIsWithdrawModalOpen(true)} disabled={balance <= 0}
                className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-40">
                <ArrowDownToLine className="w-4 h-4" /> Withdraw to Bank
              </button>
              <button onClick={() => setIsSendCryptoModalOpen(true)} disabled={balance <= 0}
                className="flex items-center gap-2 bg-blue-500/20 text-blue-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-40">
                <Wallet className="w-4 h-4" /> Send Crypto
              </button>
              <button onClick={handleFundWallet}
                className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors">
                <ArrowDownToLine className="w-4 h-4" /> Deposit USDC
              </button>
              <button onClick={() => { fetchDashboardData();
}}
                className="flex items-center gap-2 bg-white/10 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/20 transition-colors">
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>
          </motion.div>
          <motion.div className="glassmorphism rounded-xl p-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Smart Wallet</p>
            {smartWallet ? (
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono text-gray-300 truncate">{smartWallet}</p>
                <button onClick={() => { navigator.clipboard.writeText(smartWallet); toast.success("Copied!"); }}>
                  <Copy className="w-4 h-4 text-gray-500 hover:text-white" />
                </button>
              </div>
            ) : <p className="text-sm text-gray-500">Computing...</p>}
            <p className="text-xs text-gray-500 mt-2">KYC: <span className={user?.kycStatus === "VERIFIED" ? "text-emerald-400" : "text-yellow-400"}>{user?.kycStatus}</span></p>
          </motion.div>
        </div>



        {/* Send Crypto Modal */}
        <AnimatePresence>
          {isSendCryptoModalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            >
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="glassmorphism rounded-2xl p-8 max-w-sm w-full">
                <h3 className="text-xl font-bold mb-4">Send Crypto</h3>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Destination Wallet Address</label>
                    <input 
                      type="text"
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-primary outline-none"
                      placeholder="0x..."
                      value={cryptoDestination}
                      onChange={(e) => setCryptoDestination(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Amount (USDC)</label>
                    <input 
                      type="number"
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-primary outline-none"
                      placeholder="e.g. 50"
                      value={cryptoAmount}
                      onChange={(e) => setCryptoAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Target Cryptocurrency</label>
                    <select 
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-primary outline-none appearance-none"
                      value={targetCurrency}
                      onChange={(e) => setTargetCurrency(e.target.value)}
                    >
                      {topCryptos.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  
                  {cryptoAmount && (
                    <div className="bg-black/40 border border-white/10 rounded-lg p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Est. Received ({targetCurrency})</span>
                        <span className="text-white font-mono">
                          {targetCurrency === "USDC" 
                            ? (parseFloat(cryptoAmount) * 0.98).toFixed(2) 
                            : `~${((parseFloat(cryptoAmount) * 0.98) / 3000).toFixed(4)}`}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Gas Fee</span>
                        <span className="text-emerald-400 font-mono text-xs bg-emerald-500/10 px-2 py-0.5 rounded">Sponsored</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Platform Spread (2%)</span>
                        <span className="text-red-400 font-mono">-${(parseFloat(cryptoAmount) * 0.02).toFixed(2)} USDC</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setIsSendCryptoModalOpen(false)} className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-lg font-medium transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSendCrypto} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition-colors">
                    Send
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom Tabs Navigation */}
        <div className="flex gap-1 bg-black/30 p-1 rounded-lg border border-white/10 mb-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

            {/* OVERVIEW */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                <div className="glassmorphism rounded-xl p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2"><Send className="w-5 h-5 text-primary" /> Execute Blockchain Transaction</h3>
                  <div className="flex flex-col md:flex-row gap-2">
                    <input type="text" placeholder="Target action message..." value={actionTarget} onChange={(e) => setActionTarget(e.target.value)}
                      className="flex-1 bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    <button onClick={handleExecutePayment} className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2">
                      <Zap className="w-4 h-4" /> Execute
                    </button>
                  </div>
                  {txHash && <p className="text-xs text-gray-400 mt-2">Last TX: <span className="font-mono text-emerald-400">{txHash.substring(0, 20)}...</span></p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="glassmorphism rounded-xl p-5">
                    <p className="text-xs text-gray-400 uppercase mb-1">Active Invoices</p>
                    <p className="text-2xl font-bold font-mono">{invoices.filter(i => i.status === "PENDING").length}</p>
                  </div>
                  <div className="glassmorphism rounded-xl p-5">
                    <p className="text-xs text-gray-400 uppercase mb-1">AI Agents</p>
                    <p className="text-2xl font-bold font-mono">{agents.length}</p>
                  </div>
                  <div className="glassmorphism rounded-xl p-5">
                    <p className="text-xs text-gray-400 uppercase mb-1">Credentials</p>
                    <p className="text-2xl font-bold font-mono">{credentials.length}</p>
                  </div>
                </div>
              </div>
            )}

            {/* INVOICES */}
            {activeTab === "invoices" && (
              <div className="space-y-4">
                <div className="glassmorphism rounded-xl p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-primary" /> Create Invoice</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input type="number" placeholder="Amount (USDC)" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)}
                      className="bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    <input type="text" placeholder="Description" value={invoiceDesc} onChange={(e) => setInvoiceDesc(e.target.value)}
                      className="bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    <button onClick={handleCreateInvoice} disabled={isCreating}
                      className="bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                      {isCreating ? <Loader2 className="animate-spin w-4 h-4" /> : <><Plus className="w-4 h-4" /> Create</>}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {invoices.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No invoices yet. Create one above.</p>}
                  {invoices.map((inv) => (
                    <div key={inv.id} className="glassmorphism rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{inv.description}</p>
                        <p className="text-sm text-gray-400">
                          ${inv.amount.toFixed(2)} USDC · <span className={
                            inv.status === "PENDING" ? "text-yellow-400" : 
                            inv.status === "FUNDED" ? "text-indigo-400" : 
                            "text-emerald-400"
                          }>{inv.status}</span>
                        </p>
                        {inv.clientName && <p className="text-xs text-gray-500 mt-1">Paid by {inv.clientName}</p>}
                      </div>
                      <div className="flex gap-2">
                        {inv.status === "PENDING" && (
                          <button onClick={() => handleCopyLink(inv.id)} className="bg-white/10 text-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-white/20 transition-colors">
                            Copy Link
                          </button>
                        )}
                        {inv.status === "FUNDED" && (
                          <button onClick={() => handleReleaseInvoice(inv.id)} className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm transition-colors shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                            Claim & Release
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI AGENTS */}
            {activeTab === "agents" && (
              <div className="space-y-4">
                <div className="glassmorphism rounded-xl p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2"><Bot className="w-5 h-5 text-primary" /> Deploy AI Agent</h3>
                  <div className="flex flex-col md:flex-row gap-2">
                    <input type="number" placeholder="Daily budget (INR)" value={agentBudget} onChange={(e) => setAgentBudget(e.target.value)}
                      className="flex-1 bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    <button onClick={handleCreateAgent} disabled={isCreating}
                      className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50">
                      {isCreating ? <Loader2 className="animate-spin w-4 h-4" /> : <><Plus className="w-4 h-4" /> Deploy</>}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {agents.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No agents yet. Deploy one above.</p>}
                  {agents.map((agent) => (
                    <div key={agent.id} className="glassmorphism rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p className="font-mono text-sm truncate max-w-xs">{agent.agentAddress}</p>
                        <p className="text-sm text-gray-400">Budget: ${agent.dailyBudget} · Spent: ${agent.spentToday}</p>
                      </div>
                      <button onClick={() => handleSimulateAI(agent.id)}
                        className="bg-purple-500/20 text-purple-400 px-4 py-2 rounded-lg text-sm hover:bg-purple-500/30 transition-colors">
                        Simulate Action
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DIGITAL VAULT */}
            {activeTab === "vault" && (
              <div className="space-y-4">
                <div className="glassmorphism rounded-xl p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Mint Soulbound Credential</h3>
                  <div className="flex flex-col md:flex-row gap-2">
                    <input type="text" placeholder="Credential title (e.g. 'Full Stack Developer')" value={credTitle} onChange={(e) => setCredTitle(e.target.value)}
                      className="flex-1 bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    <button onClick={handleIssueCredential} disabled={isCreating}
                      className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50">
                      {isCreating ? <Loader2 className="animate-spin w-4 h-4" /> : <><Plus className="w-4 h-4" /> Mint</>}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {credentials.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No credentials yet. Mint one above.</p>}
                  {credentials.map((cred) => (
                    <div key={cred.id} className="glassmorphism rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <Shield className="w-8 h-8 text-primary flex-shrink-0" />
                        <div>
                          <p className="font-medium">{cred.title}</p>
                          <p className="text-xs text-gray-400">Token #{cred.tokenId} · {cred.isSoulbound ? "Soulbound" : "Transferable"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* ADMIN PANEL */}
            {activeTab === "admin" && (
              <div className="space-y-6">
                {/* Treasury Balance Card */}
                <div className="glassmorphism rounded-xl p-6 border border-purple-500/20">
                  <h3 className="font-semibold mb-2 flex items-center gap-2 text-purple-400"><DollarSign className="w-5 h-5" /> MockUSDC Treasury Pool</h3>
                  <p className="text-3xl font-bold font-mono text-white">{treasuryBalance ? `${parseFloat(treasuryBalance).toLocaleString()} USDC` : <Loader2 className="w-6 h-6 animate-spin inline" />}</p>
                  <button onClick={fetchDashboardData} className="mt-2 text-xs text-gray-400 hover:text-white flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Refresh</button>
                </div>

                {/* Pending Deposits */}
                <div className="glassmorphism rounded-xl p-6 border border-emerald-500/20">
                  <h3 className="font-semibold mb-4 flex items-center gap-2 text-emerald-400"><ArrowDownToLine className="w-5 h-5" /> Pending P2P UPI Deposits ({pendingDeposits.length})</h3>
                  <p className="text-sm text-gray-400 mb-6">Verify these 12-digit UTRs against your real Bank SMS notifications before approving.</p>

                  <div className="space-y-3">
                    {pendingDeposits.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No pending deposits.</p>}
                    {pendingDeposits.map((dep) => (
                      <div key={dep.id} className="bg-black/40 border border-white/10 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                          <p className="font-medium">{dep.user?.displayName || dep.user?.email}</p>
                          <div className="flex flex-col sm:flex-row sm:gap-4 mt-1 text-sm">
                            <p className="text-gray-400">Amount: <span className="text-emerald-400 font-mono font-medium">₹{dep.amountINR}</span></p>
                            <p className="text-gray-400">Payout: <span className="text-white font-mono">${dep.expectedUSDC} USDC</span></p>
                            <p className="text-gray-400">UTR: <span className="font-mono text-yellow-400">{dep.utrNumber}</span></p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleApproveDeposit(dep.id)}
                          disabled={isAdminProcessing === dep.id}
                          className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isAdminProcessing === dep.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Approve"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pending Withdrawals */}
                <div className="glassmorphism rounded-xl p-6 border border-orange-500/20">
                  <h3 className="font-semibold mb-4 flex items-center gap-2 text-orange-400"><ArrowUpFromLine className="w-5 h-5" /> Pending UPI Withdrawals ({pendingWithdrawals.length})</h3>
                  <p className="text-sm text-gray-400 mb-6">Scan the user's UPI QR code, pay them the INR amount, then click "Mark as Paid".</p>

                  <div className="space-y-4">
                    {pendingWithdrawals.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No pending withdrawals.</p>}
                    {pendingWithdrawals.map((wd) => (
                      <div key={wd.id} className="bg-black/40 border border-orange-500/10 rounded-lg p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-medium text-lg">{wd.user?.displayName || wd.user?.email}</p>
                            <div className="flex flex-wrap gap-4 mt-2 text-sm">
                              <p className="text-gray-400">Withdraw: <span className="text-white font-mono font-bold">${wd.amountUSDC} USDC</span></p>
                              <p className="text-gray-400">Pay: <span className="text-orange-400 font-mono font-bold">₹{wd.amountINR?.toFixed(2)}</span></p>
                              <p className="text-gray-400">UPI: <span className="font-mono text-yellow-400">{wd.userUpiId}</span></p>
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-2">
                            <div className="bg-white p-2 rounded-lg w-32 h-32">
                              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`upi://pay?pa=${wd.userUpiId}&pn=${wd.user?.displayName || 'User'}&am=${wd.amountINR?.toFixed(2)}&cu=INR`)}`} alt="Pay User QR" className="w-full h-full object-contain" />
                            </div>
                            <p className="text-xs text-gray-500">Scan to pay user</p>
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                          <button 
                            onClick={() => handleRejectWithdrawal(wd.id)}
                            disabled={isAdminProcessing === wd.id}
                            className="bg-red-500/20 text-red-500 hover:bg-red-500/30 px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                            {isAdminProcessing === wd.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "✕ Reject"}
                          </button>
                          <button 
                            onClick={() => handleMarkWithdrawalPaid(wd.id)}
                            disabled={isAdminProcessing === wd.id}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                            {isAdminProcessing === wd.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "✓ I have Paid — Mark as Paid"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-gray-400">Loading Dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
