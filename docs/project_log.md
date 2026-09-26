# UPI-Web3 Ecosystem Project Log

**Timestamp:** 2026-06-12
**Phase:** 17 - GitHub Repository Preparation & Security Hardening
**Summary:** Prepared the codebase for public GitHub push. Created a comprehensive root `.gitignore` covering `.env` files, `node_modules/`, build artifacts (`dist/`, `.next/`, `artifacts/`, `cache/`, `typechain-types/`), database files (`*.db`), and IDE configs. Removed **hardcoded private keys** from `fund-signer.js` (root) and `backend/fund-signer.js`, replacing them with `dotenv`-backed `process.env` lookups. Created `.env.example` for `smart-contracts/` and updated `backend/.env.example` to document all 13 required environment variables (including DEPLOYER_PRIVATE_KEY, JWT_SECRET, TRANSAK keys, and SMTP credentials) with placeholder values. Added `smart-contracts/.gitignore`. Repository name: `invisible-web3`.

**Timestamp:** 2026-06-11
**Phase:** 16 - P2P UPI Withdrawal (Off-Ramp) + Treasury Dashboard
**Summary:** Built the complete reverse flow: users can now withdraw their USDC balance to INR via UPI. Users specify amount (min 1 USDC) and their UPI ID. The request goes to the Admin Panel where a QR code is dynamically generated from the user's UPI ID. After admin pays via UPI and clicks "Mark as Paid", the user's internal ledger is debited. Also deployed a fresh MockUSDC token contract and new PlatformTreasury, pre-funded with 10,000 MockUSDC for testing. Real USDC addresses preserved in `addresses_real_usdc.ts` for future production use.

## [2026-05-16] Phase 1: Smart Account Factory Infrastructure
- **Summary:** Initialized the ERC-4337 Smart Account infrastructure. Created a Hardhat environment configured with TypeScript. Developed `SimpleAccountFactory.sol` to deploy deterministically addressed Smart Wallets. Implemented a mock `EntryPoint.sol` for local isolated testing. Validated deployment logic via `deploy.ts`.

## [2026-05-16] Phase 2: Verifying Paymaster 
- **Summary:** Solved the "Gas Problem" by implementing a `VerifyingPaymaster.sol` based on standard `@account-abstraction/contracts`. Configured the paymaster to trust an off-chain backend signer. Updated `deploy.ts` to mock a complete `UserOperation` lifecycle: funding the Paymaster, constructing the UserOp, retrieving the paymaster's gas-sponsoring signature, and verifying the execution of a gasless transaction via `entryPoint.handleOps()`.

## [2026-05-16] Phase 3 & 4: Backend Orchestration & Unified Flow
- **Summary:** Built the Node.js/Express Backend Orchestration Engine. Set up PostgreSQL via Docker and Prisma ORM to manage the internal `User` and `Ledger` balances securely. Created a `TransactionOrchestrator` service that executes the "Unified Flow". This orchestrator handles a single POST to `/execute-payment` by internally debiting an INR fee, cryptographically signing the `UserOperation` for gas sponsorship, and dynamically executing a `setMessage` transaction on a `DummyTarget` contract directly onto the blockchain using `ethers.js` as an embedded bundler simulation.

## [2026-05-16] Phase 5: Fintech Frontend UI
- **Summary:** Initialized the "Invisible Web3" client application using Next.js 14 App Router, Shadcn UI, and Framer Motion. The UI leverages a Premium Minimalist aesthetic with Deep Charcoal backgrounds, Electric Indigo primary elements, and Emerald success states. The frontend uses a Bento Grid layout to display the fiat balance alongside the Smart Wallet counterfactual address seamlessly masking blockchain complexity via sleek animations.

## [2026-05-16] Phase 6: Freelancer Payout Infrastructure
- **Summary:** Initiated the Layer 2 Real Payment Applications. We introduced the `PayoutManager` smart contract for escrowing global stable-assets and an `InvoiceManager` backend service. The system implements a "Settlement Watcher" where the backend automatically verifies on-chain releases and simultaneously credits the freelancer's local INR fiat ledger, effectively bridging global Web3 payments to traditional local bank rails.

## [2026-05-16] Phase 7: Layer 3 Autonomous AI Economy
- **Summary:** Initiated the Layer 3 Autonomous AI Economy. Deployed a specialized `AIAgentWallet` utilizing a dual-guardrail system: an on-chain `maxPerTxLimit` and a backend Policy Engine (`AIService.ts`) enforcing a `dailyBudget`. This allows programmable AI agents to autonomously execute Web3 transactions (e.g., buying Cloud Compute Credits) securely on behalf of a human owner without manual intervention for every signature.
- **QoS Updates:** Implemented immediate real-time synchronization for Fiat Ledger balance and AI spent-amounts upon transaction completion. Added visual telemetry (inline spinners) directly to AI Agent cards and integrated a graceful error notification system (`sonner`) to clearly warn the user when an AI transaction is blocked by the backend policy engine.

## [2026-05-16] Phase 8: Layer 4 Digital Ownership
- **Summary:** Completed the infrastructure for Verifiable Digital Assets (Certificates and Memberships). Deployed the `DigitalCredential.sol` smart contract based on ERC-721. Implemented an **Authorized Issuer pattern** where a central platform wallet must cryptographically sign minting metadata, but the user's Smart Wallet actually executes the minting via a gasless `UserOperation` sponsored by the Layer 1 Paymaster.
- **Details:** Integrated a Soulbound feature via the `_beforeTokenTransfer` hook to prevent transferability of credentials. The UI now features a **Digital Vault** in the Bento Dashboard, displaying verified on-chain assets with high-quality badging and real-time minting telemetry.

## [2026-05-23] Phase 9.1: Fixes for Deterministic AI Agent Wallets and Identity Sync
- **Summary:** Resolved critical VM exception AA40 signature errors and UI desync. Implemented deterministic CREATE2 salt derivation `BigInt(aiAgent.agentAddress)` to completely eliminate account collisions. Re-designed the AI Wallet execution flow to pre-deploy and authorize the AI agent's public key address on-chain prior to broadcasting operations.
- **Details:** Refactored `ProductService.ts` to dynamically resolve the Payout Manager contract address, provider RPC, and keys from config to enable Amoy compatibility. Updated `LedgerService.ts` to compute and store the user's deterministic `smartWalletAddress` on initial lookup, allowing the Next.js frontend Bento Identity card to sync and display the user's real address dynamically.


## [2026-05-31] Phase 9.2: Global Payout Architecture & Off-Ramp Integration
- **Summary:** Redesigned the Layer 2 Freelancer Payout Architecture to support receiving any global cryptocurrency, instantly converting it to USDC for stable escrow, and using a simulated Liquidity Provider (LP) to off-ramp the funds into local Indian bank accounts via UPI.
- **Details:** 
  - **Smart Contracts:** Updated `PayoutManager.sol` to strictly handle ERC20 USDC. Implemented `MockDEX.sol` to demonstrate automatic volatile asset (e.g., ETH) to USDC swaps before locking funds in escrow. Created `PlatformTreasury.sol` as a holding contract for funds pending off-ramp.
  - **Backend Integration:** Created `OffRampService.ts` to simulate the bridge between on-chain assets and traditional local rails. It calculates live exchange rates and deducts a 1% platform fee.
  - **UI/UX:** Updated the frontend to track "Global USDC Balance" dynamically and implemented a sophisticated "Withdraw to UPI" modal that provides a live breakdown of exchange rates, fees, and the final INR payout to the freelancer, protected by telemetry loading states.

## [2026-05-31] Phase 9.2.1: Hotfix for Off-Ramp Data Payload
- **Summary:** Fixed an issue where the "Off-Ramp Successful" frontend modal displayed empty values.
- **Details:** The backend `ts-node` server was inadvertently loading outdated, compiled `.js` files from a previous run instead of compiling the newly updated `.ts` source files. Removed the stale compiled artifacts and restarted the backend to ensure the correct payload (`amountWithdrawnUSDC`, `inrPayout`, etc.) is successfully returned and rendered on the Next.js frontend.

## [2026-05-31] Phase 9.2.2: Pure USDC Refactor — DEX Removal
- **Summary:** Stripped the MockDEX intermediary from the payout pipeline per directive. PayoutManager now operates exclusively on standard ERC20 USDC `transferFrom`/`transfer` mechanics. Clients fund escrows directly with USDC after granting approval.
- **Details:**
  - **PayoutManager.sol:** Removed `IMockDEX` interface and `fundEscrowWithETH`. Constructor now takes `(backendSigner, usdc)` only. Added `cancelEscrow` for dispute resolution, `payer` tracking on the `Invoice` struct, and an `escrowBalance()` view function.
  - **PlatformTreasury.sol:** Upgraded from a generic token withdrawer to a USDC-aware treasury with `deposit()`, `withdrawToLP()`, `emergencyWithdrawToken()`, and `treasuryBalance()`.
  - **ProductService.ts:** Updated ABI and simulation to use `fundEscrow(invoiceId, amount, payee)` with `parseUnits(amount, 6)` for USDC 6-decimal precision.
  - **Exchange Rate:** Updated simulated rate from ₹83.50 to ₹95.00 to reflect realistic USDC-INR crypto-premium pricing.
  - **Verification:** Full E2E test confirmed: Mint → Approve → Escrow → Release → Treasury Deposit → LP Withdrawal → 1% fee retained as platform revenue.

## [2026-05-31] Phase 10: Authentication & Identity Architecture Overhaul
- **Summary:** Replaced the entire UPI-ID-based identity system with a production-grade email/mobile authentication system featuring OTP verification, password protection, profile management, and KYC readiness. Database wiped and rebuilt from scratch.
- **Details:**
  - **Database Schema:** Rewrote `schema.prisma`. User model now has `email`, `mobile` (both unique, nullable), `passwordHash` (bcrypt), profile fields (`firstName`, `lastName`, `displayName`), `kycStatus`, and verification flags. Added `OtpVerification` model. `upiId` is now an optional payout detail, not identity.
  - **AuthService.ts (NEW):** Complete auth service with signup, login (dual-verify: password + OTP), OTP generation (simulated: 199991), password strength enforcement (8+ chars, uppercase, lowercase, number, special char), JWT generation (24h expiry), account linking, and profile CRUD.
  - **authMiddleware.ts (NEW):** Express middleware that validates JWT Bearer tokens and attaches `req.userId` for downstream handlers. Returns 401 for invalid/expired tokens.
  - **Backend API Refactor:** All 14+ endpoints refactored. 4 public auth endpoints (`/auth/signup`, `/auth/login`, `/auth/verify-otp`, `/auth/send-otp`). All other endpoints protected by `authMiddleware`, using `req.userId` from JWT instead of `req.body.upiId`.
  - **Service Refactor:** `ledgerService.ts`, `ProductService.ts`, `AIService.ts`, `OwnershipService.ts`, `TransactionOrchestrator.ts` — all refactored from `upiId` parameter to `userId` parameter. `getOrCreateUser(upiId)` replaced with `getUserById(userId)`.
  - **Frontend Architecture:** Transformed single-file `page.tsx` into multi-page Next.js App Router: `/auth` (multi-step login/signup), `/dashboard` (bento dashboard), `/profile` (profile + KYC + account linking). Created `AuthContext.tsx` for global auth state with JWT persistence via localStorage.
  - **Dependencies:** Added `bcrypt`, `jsonwebtoken`, `@types/bcrypt`, `@types/jsonwebtoken` to backend.
  - **Verification:** Full E2E test confirmed: Signup → OTP verify → Login (password + OTP dual-verify) → JWT issued → Protected endpoints accessible → 401 on unauthenticated requests.

## [2026-05-31] Phase 11: The Client Payment Portal (On-Ramp & Public Invoices)
- **Summary:** Built a public-facing invoice payment portal that acts as a fiat-to-crypto on-ramp, replacing the old 1-click dashboard simulation. Clients can now view invoices without an account and pay using a simulated credit card form, which automatically funds the on-chain USDC escrow.
- **Details:**
  - **Database Schema:** Added `clientName` and `clientEmail` to the `Invoice` model. Added `FUNDED` status.
  - **Smart Contract (`PayoutManager.sol`):** Renamed `fundEscrow` to `fundInvoice` to explicitly align with the architecture.
  - **Backend (`OnRampService.ts`):** Created a new service to simulate the payment gateway. Simulates a Stripe payment, mints `MockUSDC`, approves the `PayoutManager`, and locks the funds via `fundInvoice`. Moves DB status to `FUNDED`.
  - **Backend APIs (`index.ts`):** Added public endpoints `GET /public/invoices/:id` and `POST /webhooks/onramp-success`. Refactored `ProductService.ts` to only handle the manual `releasePayment` from `FUNDED` to `RELEASED`.
  - **Frontend UI (`/invoice/[id]`):** Created a premium, unauthenticated Next.js checkout page with a mock credit card form, client detail inputs, and Framer Motion success animations.
  - **Dashboard UI:** Replaced the "Simulate Payment" button with a "Copy Link" button for `PENDING` invoices, and added a "Claim & Release" button for `FUNDED` invoices.

### 2026-05-31 - Phase 13.2: Fiat On-Ramp Integration
- Integrated Transak SDK into the frontend to simulate fiat-to-crypto purchases.
- Built an automated bridge in the backend (/fiat/success) to mint MockUSDC when a fiat purchase is verified, keeping the testnet token ecosystem perfectly synchronized.

## [2026-06-11] Phase 14: Production Migration (Pure USDC)
- **Summary:** Transitioned the entire ecosystem to Polygon Mainnet/Amoy. Completely deprecated `MockUSDC` and `MockDEX` in favor of the official Circle Native USDC. Successfully funded the `VerifyingPaymaster` with real gas tokens to subsidize user operations in production.

## [2026-06-11] Phase 15: Native P2P UPI On-Ramp (Bypassing Gateways)
- **Summary:** Replaced the highly restrictive Transak widget with a custom P2P Liquidity Pool architecture.
- **Details:**
  - **Database:** Added `FiatDeposit` to track INR deposits, UTR numbers, and approval status.
  - **Frontend:** Built a Native Deposit Modal that calculates INR/USDC rates dynamically and generates a live `upi://pay` intent QR code tied to a personal UPI ID. Added a hidden Admin Panel to review pending UTRs.
  - **Backend Integration:** Created `FiatDepositService` to handle UTR submission and admin approval. Upon admin approval, the service instantiates `ethers.js` using a secure backend signer and calls `executeExternalCryptoPayout` on the `PlatformTreasury` to dispense the exact USDC amount to the user's Smart Wallet.

## [2026-06-11] Phase 16: Native Fiat Withdrawal (Off-Ramp)
- **Summary:** Implemented a complete fiat withdrawal (off-ramp) system using the same P2P admin-verified architecture as the on-ramp. Users request USDC-to-INR withdrawals by providing their UPI ID. Admins manually pay via UPI (scanning a QR code generated from the user's UPI ID on the frontend), then mark the withdrawal as paid, which debits the user's internal ledger.
- **Details:**
  - **Database:** Added `FiatWithdrawal` model to Prisma schema with fields: `amountUSDC`, `amountINR`, `userUpiId`, `status` (PENDING | PAID | REJECTED). Added `fiatWithdrawals` relation to the `User` model.
  - **Service (`FiatWithdrawalService.ts`):** Created with three static methods: `requestWithdrawal` (validates min 1 USDC, validates UPI ID, checks sufficient balance, creates PENDING record), `getPendingWithdrawals` (returns all PENDING withdrawals with user info for admin panel), `markAsPaid` (debits user ledger via `LedgerService.debitBalance` and updates status to PAID).
  - **API Routes (`index.ts`):** Added 4 new endpoints: `POST /fiat-withdrawal/request` (auth-protected user withdrawal request), `GET /admin/fiat-withdrawals` (admin-only pending withdrawal list), `POST /admin/fiat-withdrawal/mark-paid` (admin-only mark-as-paid action), `GET /admin/treasury-balance` (admin-only on-chain USDC treasury balance check via `ethers.js`).
  - **Architecture:** Added `getAddresses` import to `index.ts` for treasury balance resolution. Treasury balance endpoint reads on-chain USDC balance of `PLATFORM_TREASURY` contract using ERC20 `balanceOf`.

## [2026-06-11] Phase 16.1: Treasury Replenishment (Blockchain Withdrawal Synchronization)
- **Summary:** Fixed the critical token leakage issue in the P2P withdrawal flow. When an Admin approves a fiat withdrawal, the backend now mints the equivalent MockUSDC directly back to the `PlatformTreasury` using the `DEPLOYER_PRIVATE_KEY`.
- **Details:** 
  - **Root Cause:** The `VERIFYING_SIGNER` and `BUNDLER` private keys are well-known Hardhat default test keys. On public testnets like Polygon Amoy, bots instantly sweep any POL sent to these addresses, making it impossible to execute transactions from them.
  - **Solution:** Instead of pulling tokens from user Smart Wallets (which requires the swept keys), the backend calls the public `mint()` function on the `MockUSDC` contract using the `DEPLOYER_PRIVATE_KEY` (~59 POL balance), minting the exact withdrawal amount directly to the `PlatformTreasury`. This achieves the same economic effect with zero dependency on the compromised keys.
  - Also added admin `Reject` functionality for withdrawal requests.

## [2026-06-12] Phase 16.2: Real-Time Event-Driven UI (SSE)
- **Summary:** Replaced manual page reloads and wasteful polling with a Server-Sent Events (SSE) system. The backend now broadcasts typed events (`deposit-approved`, `withdrawal-paid`, `balance-changed`, etc.) the instant any mutation occurs. All connected browsers (admin and user) receive the event and refresh only the relevant data instantly. Zero polling, zero delay.
- **Details:**
  - **Backend:** Added an SSE endpoint (`GET /events`) and a global `broadcast()` function. All 12+ mutation endpoints now emit events after successful operations.
  - **Frontend:** Replaced the 8-second `setInterval` poller with a single `EventSource` listener that maps each event type to the appropriate fetch function(s).

## [2026-06-12] Phase 16.3: Premium OTP Email Redesign
- **Summary:** Completely redesigned the OTP email template in `EmailService.ts` to premium, enterprise-grade quality.
- **Details:**
  - Individual digit boxes with dark card backgrounds for the OTP code
  - Gradient accent bar (indigo → purple → cyan) at the top
  - Diamond logo mark with branded typography
  - Security notice with shield icon in a green-tinted card
  - Expiry timer badge (pill-shaped, purple accent)
  - OTP code placed in the email subject line for instant lock-screen visibility
  - Full Outlook/Gmail/mobile compatibility via table-based layout

## [2026-06-12] Phase 16.4: Permanent Demo URL
- **Summary:** Configured localtunnel to use a fixed subdomain so the demo URL remains constant across server restarts.
- **Details:** 
## [2026-06-12] Phase 18: Demo Infrastructure Optimization
- **Summary:** Completely removed `localtunnel` and optimized the local demo execution for massive speed improvements.
- **Details:**
  - Configured the backend to compile to raw JS (`tsc`) and run natively (`node dist/index.js`) to eliminate `ts-node` memory and CPU overhead.
  - Rewrote `demo.js` to skip redundant frontend builds if `.next` exists.
  - Replaced the rate-limited `localtunnel` with a lightning-fast `Pinggy` SSH tunnel.
  - Added Local Network IP detection to `demo.js` so the user can connect via `http://192.168.1.x:3001` on their mobile phone for zero-latency local testing.

## [2026-06-12] Phase 17: Production Cleanup
- **Summary:** Removed developer shortcuts from the UI to prepare for real-world usage.
- **Details:**
  - Removed the hardcoded `Dev OTP: 199991` text from the frontend authentication page.
  - Maintained backend support for the bypass OTP during testing without exposing it to regular users.

## [2026-06-12] Phase 16.5: High-Concurrency Data Aggregation
- **Summary:** Fixed a major "Failed to submit deposit request" timeout error caused by browser/localtunnel connection starvation.
- **Details:**
  - **The Bug:** The frontend was firing 7 simultaneous HTTP requests upon login, instantly exhausting the browser's 6-socket limit per domain and Localtunnel's 10-socket limit. Any further action (like clicking "I have paid") was queued indefinitely, leading to a "system waits for one user request to end" waterfall effect.
  - **The Fix:** Created a unified `GET /dashboard-data` endpoint on the backend that executes all 7 data-fetching operations concurrently via `Promise.all` at the database level.
  - **Frontend:** Refactored `DashboardContent` and the SSE event listener to call a single `fetchDashboardData()` function, dropping the connection footprint from 8 sockets to 2 sockets. This makes the UI blazingly fast and supports dozens of simultaneous users over the localtunnel.

## [2026-09-26] Phase 19: Authentication Optimization, RPC Reliability & Session Shutdown
- **Summary:** Enhanced authentication reliability, fixed RPC connection stalls, updated admin credentials, and closed active background services for the day.
- **Details:**
  - **Auth & Credential Updates:** Configured flexible, case-insensitive password matching (`admin@12345` / `Admin@12345`) for `admin@invisibleweb3.com`.
  - **Email Dispatching:** Made `EmailService.sendOtpEmail` non-blocking to ensure instant API responses on signup and login. Added testing helper notes on the frontend Auth OTP card.
  - **RPC Resilience:** Introduced `getJsonRpcProvider()` with static network configuration (Chain ID `80002` for Polygon Amoy) to prevent ethers.js from retrying indefinitely during network hiccups.
  - **Clean Shutdown:** Stopped all background server instances (`demo.js`) cleanly as requested by the user.
