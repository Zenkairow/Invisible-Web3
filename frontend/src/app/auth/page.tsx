"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { Loader2, ArrowRight, Mail, Phone, Eye, EyeOff, CheckCircle, XCircle, ShieldCheck } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const API = "/api";

type Step = "IDENTIFIER" | "PASSWORD" | "OTP" | "PROFILE_SETUP";
type Mode = "signup" | "login";
type IdType = "email" | "mobile";

const strengthChecks = [
  { label: "8+ characters", test: (p: string) => p.length >= 8 },
  { label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number", test: (p: string) => /[0-9]/.test(p) },
  { label: "Special character", test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

export default function AuthPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [mode, setMode] = useState<Mode>("signup");
  const [idType, setIdType] = useState<IdType>("email");
  const [step, setStep] = useState<Step>("IDENTIFIER");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [signupUserId, setSignupUserId] = useState("");

  const passedChecks = strengthChecks.filter((c) => c.test(password)).length;
  const strengthPct = (passedChecks / strengthChecks.length) * 100;
  const strengthColor = strengthPct <= 40 ? "bg-red-500" : strengthPct <= 80 ? "bg-yellow-500" : "bg-emerald-500";

  const handleIdentifierSubmit = async () => {
    if (!identifier.trim()) return;
    setIsLoading(true);
    try {
      if (mode === "signup") {
        setStep("PASSWORD");
      } else {
        // For login, we only move to the password step.
        // OTP is sent AFTER password verification.
        setStep("PASSWORD");
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (mode === "signup") {
      if (strengthPct < 100) return toast.error("Password doesn't meet all requirements");
      if (password !== confirmPassword) return toast.error("Passwords don't match");
      setIsLoading(true);
      try {
        const res = await axios.post(`${API}/auth/signup`, { identifier, password });
        setSignupUserId(res.data.userId);
        toast.success("Account created! Verify your OTP.");
        setStep("OTP");
      } catch (e: any) {
        toast.error(e.response?.data?.error || "Signup failed");
      } finally {
        setIsLoading(false);
      }
    } else {
      if (!password) return;
      setIsLoading(true);
      try {
        await axios.post(`${API}/auth/login-step1`, { identifier, password });
        toast.success("OTP sent to your email!");
        setStep("OTP");
      } catch (e: any) {
        toast.error(e.response?.data?.error || "Invalid credentials");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value[value.length - 1];
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);
    if (value && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`);
      next?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`);
      prev?.focus();
    }
  };

  const handleOtpSubmit = async () => {
    const otp = otpDigits.join("");
    if (otp.length !== 6) return toast.error("Enter all 6 digits");
    setIsLoading(true);
    try {
      if (mode === "signup") {
        const purpose = "SIGNUP";
        const res = await axios.post(`${API}/auth/verify-otp`, { target: identifier, otp, purpose });
        if (res.data.token) {
          login(res.data.token, res.data.user);
        }
        toast.success("Verified! Set up your profile.");
        setStep("PROFILE_SETUP");
      } else {
        const res = await axios.post(`${API}/auth/login`, { identifier, password, otp });
        login(res.data.token, res.data.user);
        toast.success("Welcome back!");
        router.push("/dashboard");
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileSetup = async () => {
    setIsLoading(true);
    try {
      const tk = localStorage.getItem('iw3_token');
      const usrStr = localStorage.getItem('iw3_user');
      const usr = usrStr ? JSON.parse(usrStr) : null;

      if (!tk || !usr) throw new Error("Not authenticated");

      // Update profile
      if (firstName || lastName || displayName) {
        await axios.put(`${API}/profile`, { firstName, lastName, displayName }, {
          headers: { Authorization: `Bearer ${tk}` }
        });
        usr.firstName = firstName;
        usr.lastName = lastName;
        usr.displayName = displayName;
      }
      
      login(tk, usr);
      toast.success("Profile created! Welcome to Invisible Web3.");
      router.push("/dashboard");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Profile setup failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <Toaster theme="dark" position="top-center" richColors />
      <div className="absolute inset-0 z-0 opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] mix-blend-screen animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="z-10 w-full max-w-md p-8"
        >
          {/* STEP 1: Identifier */}
          {step === "IDENTIFIER" && (
            <div className="glassmorphism rounded-2xl border border-white/10 p-8">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 mb-4 text-primary">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Invisible Web3</h1>
                <p className="text-sm text-gray-400">
                  {mode === "signup" ? "Create your secure account" : "Welcome back, sign in"}
                </p>
              </div>

              <div className="flex bg-black/30 p-1 rounded-lg border border-white/10 mb-6">
                <button
                  onClick={() => setIdType("email")}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${idType === "email" ? "bg-white/10 text-white" : "text-gray-400"}`}
                >
                  <Mail className="w-4 h-4" /> Email
                </button>
                <button
                  onClick={() => setIdType("mobile")}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${idType === "mobile" ? "bg-white/10 text-white" : "text-gray-400"}`}
                >
                  <Phone className="w-4 h-4" /> Mobile
                </button>
              </div>

              <input
                type={idType === "email" ? "email" : "tel"}
                placeholder={idType === "email" ? "you@example.com" : "+91 98765 43210"}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all mb-4"
                onKeyDown={(e) => e.key === "Enter" && handleIdentifierSubmit()}
              />

              <button
                onClick={handleIdentifierSubmit}
                disabled={isLoading || !identifier.trim()}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50 mb-4"
              >
                {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <>Continue <ArrowRight className="w-5 h-5" /></>}
              </button>

              <div className="text-center">
                <button
                  onClick={() => setMode(mode === "signup" ? "login" : "signup")}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {mode === "signup" ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Password */}
          {step === "PASSWORD" && (
            <div className="glassmorphism rounded-2xl border border-white/10 p-8">
              <h2 className="text-2xl font-bold mb-2">{mode === "signup" ? "Create Password" : "Enter Password"}</h2>
              <p className="text-sm text-gray-400 mb-6">{identifier}</p>

              <div className="relative mb-4">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 pr-12 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  onKeyDown={(e) => e.key === "Enter" && (mode === "login" ? handlePasswordSubmit() : null)}
                />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400 hover:text-white">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {mode === "signup" && (
                <>
                  <div className="w-full bg-gray-800 rounded-full h-1.5 mb-3 overflow-hidden">
                    <motion.div className={`h-1.5 rounded-full ${strengthColor}`} animate={{ width: `${strengthPct}%` }} transition={{ duration: 0.3 }} />
                  </div>
                  <div className="grid grid-cols-2 gap-1 mb-4">
                    {strengthChecks.map((check) => (
                      <div key={check.label} className={`flex items-center gap-1.5 text-xs ${check.test(password) ? "text-emerald-400" : "text-gray-500"}`}>
                        {check.test(password) ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {check.label}
                      </div>
                    ))}
                  </div>
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all mb-4"
                    onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                  />
                </>
              )}

              <button
                onClick={handlePasswordSubmit}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <>Continue <ArrowRight className="w-5 h-5" /></>}
              </button>

              <button onClick={() => setStep("IDENTIFIER")} className="w-full mt-3 text-sm text-gray-400 hover:text-white text-center">
                ← Back
              </button>
            </div>
          )}

          {/* STEP 3: OTP */}
          {step === "OTP" && (
            <div className="glassmorphism rounded-2xl border border-white/10 p-8 text-center">
              <h2 className="text-2xl font-bold mb-2">Verify OTP</h2>
              <p className="text-sm text-gray-400 mb-6">
                Enter the 6-digit code sent to <span className="text-white font-medium">{identifier}</span>
              </p>

              <div className="flex justify-center gap-2 mb-4">
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-12 h-14 bg-black/50 border border-white/20 rounded-lg text-center text-xl font-mono text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                ))}
              </div>

              <div className="mb-6 p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary-light flex items-center justify-center gap-1.5">
                <span>💡 Check your Inbox/Spam or use instant test code: <strong className="font-mono text-white underline">199991</strong></span>
              </div>


              <button
                onClick={handleOtpSubmit}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : "Verify"}
              </button>

              <button onClick={() => setStep("PASSWORD")} className="w-full mt-3 text-sm text-gray-400 hover:text-white text-center">
                ← Back
              </button>
            </div>
          )}

          {/* STEP 4: Profile Setup (Signup only) */}
          {step === "PROFILE_SETUP" && (
            <div className="glassmorphism rounded-2xl border border-white/10 p-8">
              <h2 className="text-2xl font-bold mb-2">Set Up Your Profile</h2>
              <p className="text-sm text-gray-400 mb-6">Tell us a bit about yourself</p>

              <div className="space-y-4 mb-6">
                <input
                  type="text" placeholder="First Name" value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                <input
                  type="text" placeholder="Last Name" value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                <input
                  type="text" placeholder="Display Name (shown on dashboard)" value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>

              <button
                onClick={handleProfileSetup}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <>Complete Setup <ArrowRight className="w-5 h-5" /></>}
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
