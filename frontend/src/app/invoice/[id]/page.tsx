"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "sonner";
import { CreditCard, ShieldCheck, CheckCircle2, Loader2, Lock } from "lucide-react";
import axios from "axios";

const API = "/api";

export default function PublicInvoicePage() {
  const { id: invoiceId } = useParams();
  
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await axios.get(`${API}/public/invoices/${invoiceId}`);
        setInvoice(res.data);
      } catch (e) {
        toast.error("Invoice not found");
      } finally {
        setLoading(false);
      }
    };
    if (invoiceId) fetchInvoice();
  }, [invoiceId]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !clientEmail || !cardNumber || !expiry || !cvc) {
      return toast.error("Please fill in all payment details");
    }

    setIsProcessing(true);
    
    // Simulate payment processing delay
    await new Promise(r => setTimeout(r, 2000));

    try {
      await axios.post(`${API}/webhooks/onramp-success`, {
        invoiceId,
        clientName,
        clientEmail
      });
      setPaymentSuccess(true);
      toast.success("Payment successful!");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Payment failed");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]"><Loader2 className="animate-spin w-8 h-8 text-indigo-500" /></div>;
  }

  if (!invoice) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] text-white">Invoice not found or invalid link.</div>;
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white py-12 px-4 flex flex-col items-center">
      <Toaster theme="dark" position="top-center" richColors />
      
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Invoice Summary */}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Invoice Payment</h1>
            <p className="text-gray-400">You are paying an invoice from <span className="text-white font-medium">{invoice.freelancerName}</span></p>
          </div>
          
          <div className="glassmorphism rounded-2xl p-6 border border-white/10">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-sm text-gray-400">Amount Due</p>
                <p className="text-4xl font-mono font-bold mt-1">${invoice.amount.toFixed(2)}</p>
                <p className="text-xs text-indigo-400 mt-1">USDC Stablecoin</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                invoice.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 
                'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {invoice.status}
              </div>
            </div>
            
            <div className="space-y-3 pt-6 border-t border-white/10">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Description</span>
                <span className="font-medium text-right max-w-[200px]">{invoice.description}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Invoice ID</span>
                <span className="font-mono text-gray-500">{invoice.id.split('-')[0]}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Network Fee</span>
                <span className="text-emerald-400">Covered</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-sm text-gray-400 bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20">
            <ShieldCheck className="w-5 h-5 text-indigo-400 flex-shrink-0" />
            <p>Your payment is secured in an on-chain smart contract escrow until the freelancer claims it.</p>
          </div>
        </div>

        {/* Payment Form */}
        <div>
          <AnimatePresence mode="wait">
            {!paymentSuccess ? (
              <motion.div 
                key="form"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="glassmorphism rounded-2xl p-8 border border-white/10 relative overflow-hidden"
              >
                {invoice.status !== 'PENDING' && (
                  <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-sm flex items-center justify-center flex-col">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
                    <h3 className="text-xl font-bold">Already Paid</h3>
                    <p className="text-gray-400 text-sm mt-2">This invoice has already been funded.</p>
                  </div>
                )}
                
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2"><CreditCard className="w-5 h-5" /> Payment Details</h3>
                
                <form onSubmit={handlePayment} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Your Name</label>
                      <input type="text" required value={clientName} onChange={e => setClientName(e.target.value)}
                        className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Your Email</label>
                      <input type="email" required value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                        className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none" />
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-white/10">
                    <label className="text-xs text-gray-400 mb-1 block">Card Number</label>
                    <div className="relative">
                      <input type="text" placeholder="4242 4242 4242 4242" required maxLength={19} value={cardNumber} onChange={e => setCardNumber(e.target.value)}
                        className="w-full bg-black/50 border border-white/20 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none font-mono" />
                      <CreditCard className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Expiry</label>
                      <input type="text" placeholder="MM/YY" required maxLength={5} value={expiry} onChange={e => setExpiry(e.target.value)}
                        className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none font-mono" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">CVC</label>
                      <input type="text" placeholder="123" required maxLength={4} value={cvc} onChange={e => setCvc(e.target.value)}
                        className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none font-mono" />
                    </div>
                  </div>

                  <button type="submit" disabled={isProcessing}
                    className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-70">
                    {isProcessing ? (
                      <><Loader2 className="animate-spin w-5 h-5" /> Processing secure payment...</>
                    ) : (
                      <><Lock className="w-4 h-4" /> Pay ${invoice.amount.toFixed(2)}</>
                    )}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="glassmorphism rounded-2xl p-10 border border-emerald-500/30 text-center flex flex-col items-center justify-center h-full"
              >
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Payment Successful</h3>
                <p className="text-gray-400 mb-6">Your payment has been securely locked in escrow.</p>
                
                <div className="w-full bg-black/40 rounded-xl p-4 text-left border border-white/5 space-y-2 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Receipt ID</span>
                    <span className="font-mono text-gray-300">TX-{Math.random().toString(36).substring(2, 10).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Paid To</span>
                    <span className="font-medium text-white">{invoice.freelancerName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Amount</span>
                    <span className="font-mono text-white">${invoice.amount.toFixed(2)}</span>
                  </div>
                </div>
                
                <button onClick={() => window.location.reload()} className="text-sm text-indigo-400 hover:text-indigo-300">
                  View updated invoice
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
