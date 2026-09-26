"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { Toaster, toast } from "sonner";
import {
  User, Mail, Phone, Shield, ArrowLeft, Save, Loader2,
  CheckCircle, AlertCircle, Link2, CreditCard
} from "lucide-react";
import axios from "axios";

const API = "/api";

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading: authLoading, updateUser, apiClient } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [upiId, setUpiId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Link account
  const [linkIdentifier, setLinkIdentifier] = useState("");
  const [linkOtp, setLinkOtp] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/auth");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setDisplayName(user.displayName || "");
      setUpiId(user.upiId || "");
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const res = await apiClient.put("/profile", { firstName, lastName, displayName, upiId });
      updateUser({ ...user!, ...res.data, upiId });
      toast.success("Profile updated!");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to save");
    } finally { setIsSaving(false); }
  };

  const handleSendLinkOtp = async () => {
    if (!linkIdentifier.trim()) return;
    setIsLinking(true);
    try {
      await axios.post(`${API}/auth/send-otp`, { target: linkIdentifier, purpose: "LINK_ACCOUNT" });
      setOtpSent(true);
      toast.success("OTP sent!");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to send OTP");
    } finally { setIsLinking(false); }
  };

  const handleLinkAccount = async () => {
    if (!linkOtp.trim()) return;
    setIsLinking(true);
    try {
      await apiClient.post("/profile/link-account", { identifier: linkIdentifier, otp: linkOtp });
      // Refresh profile
      const profileRes = await apiClient.get("/profile");
      updateUser(profileRes.data);
      toast.success("Account linked successfully!");
      setShowLinkForm(false);
      setLinkIdentifier("");
      setLinkOtp("");
      setOtpSent(false);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to link account");
    } finally { setIsLinking(false); }
  };

  if (authLoading || !isAuthenticated || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;
  }

  const missingLink = !user.email ? "email" : !user.mobile ? "mobile" : null;

  return (
    <main className="min-h-screen pb-10">
      <Toaster theme="dark" position="top-center" richColors />

      <header className="sticky top-0 z-30 backdrop-blur-xl bg-black/50 border-b border-white/10">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </button>
          <h1 className="text-lg font-bold">Profile</h1>
          <div className="w-20" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 mt-8 space-y-6">
        {/* Personal Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glassmorphism rounded-xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><User className="w-5 h-5 text-primary" /> Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">First Name</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Last Name</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs text-gray-400 mb-1 block">Display Name</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <button onClick={handleSaveProfile} disabled={isSaving}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />} Save Changes
          </button>
        </motion.div>

        {/* Contact Details */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glassmorphism rounded-xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Mail className="w-5 h-5 text-primary" /> Contact Details</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-white/10">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm">{user.email || <span className="text-gray-500 italic">Not linked</span>}</p>
                  <p className="text-xs text-gray-500">Email</p>
                </div>
              </div>
              {user.email && user.isEmailVerified && <CheckCircle className="w-5 h-5 text-emerald-400" />}
              {user.email && !user.isEmailVerified && <AlertCircle className="w-5 h-5 text-yellow-400" />}
            </div>
            <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-white/10">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm">{user.mobile || <span className="text-gray-500 italic">Not linked</span>}</p>
                  <p className="text-xs text-gray-500">Mobile</p>
                </div>
              </div>
              {user.mobile && user.isMobileVerified && <CheckCircle className="w-5 h-5 text-emerald-400" />}
              {user.mobile && !user.isMobileVerified && <AlertCircle className="w-5 h-5 text-yellow-400" />}
            </div>
          </div>

          {missingLink && !showLinkForm && (
            <button onClick={() => setShowLinkForm(true)}
              className="mt-4 flex items-center gap-2 bg-white/10 text-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-white/20 transition-colors">
              <Link2 className="w-4 h-4" /> Link {missingLink === "email" ? "Email" : "Mobile Number"}
            </button>
          )}

          {showLinkForm && (
            <div className="mt-4 p-4 bg-black/30 rounded-lg border border-white/10 space-y-3">
              <input
                type={missingLink === "email" ? "email" : "tel"}
                placeholder={missingLink === "email" ? "you@example.com" : "+91 98765 43210"}
                value={linkIdentifier} onChange={(e) => setLinkIdentifier(e.target.value)}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {!otpSent ? (
                <button onClick={handleSendLinkOtp} disabled={isLinking}
                  className="w-full bg-primary hover:bg-primary/90 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                  {isLinking ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : "Send OTP"}
                </button>
              ) : (
                <>
                  <input type="text" placeholder="Enter OTP (199991)" value={linkOtp} onChange={(e) => setLinkOtp(e.target.value)}
                    className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  <button onClick={handleLinkAccount} disabled={isLinking}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                    {isLinking ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : "Verify & Link"}
                  </button>
                </>
              )}
            </div>
          )}
        </motion.div>

        {/* UPI Details */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glassmorphism rounded-xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" /> UPI Payout Details</h3>
          <p className="text-xs text-gray-400 mb-3">Your UPI ID is used for bank withdrawals (Off-Ramp).</p>
          <input type="text" placeholder="yourname@upi" value={upiId} onChange={(e) => setUpiId(e.target.value)}
            className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 mb-3" />
          <button onClick={handleSaveProfile} disabled={isSaving}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />} Save UPI
          </button>
        </motion.div>

        {/* KYC Status */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glassmorphism rounded-xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> KYC Verification</h3>
          <div className="flex items-center gap-4 p-4 bg-black/30 rounded-lg border border-white/10">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              user.kycStatus === "VERIFIED" ? "bg-emerald-500/20" : user.kycStatus === "SUBMITTED" ? "bg-yellow-500/20" : "bg-gray-500/20"
            }`}>
              {user.kycStatus === "VERIFIED" ? <CheckCircle className="w-6 h-6 text-emerald-400" /> :
               user.kycStatus === "SUBMITTED" ? <Loader2 className="w-6 h-6 text-yellow-400" /> :
               <AlertCircle className="w-6 h-6 text-gray-400" />}
            </div>
            <div>
              <p className="font-medium">{
                user.kycStatus === "VERIFIED" ? "KYC Verified" :
                user.kycStatus === "SUBMITTED" ? "KYC Under Review" :
                "KYC Pending"
              }</p>
              <p className="text-xs text-gray-400">{
                user.kycStatus === "VERIFIED" ? "Your identity has been verified." :
                user.kycStatus === "SUBMITTED" ? "We're reviewing your documents." :
                "Complete KYC to unlock full features."
              }</p>
            </div>
          </div>
          {user.kycStatus === "PENDING" && (
            <button className="mt-4 bg-white/10 text-gray-300 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-white/20 transition-colors w-full">
              Start KYC Verification →
            </button>
          )}
        </motion.div>
      </div>
    </main>
  );
}
