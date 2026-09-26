# Technical Dossier

**Architecture State:** Development (Phase 16 — MockUSDC + P2P UPI On/Off-Ramp)
**Network:** Polygon Amoy Testnet (real on-chain transactions with test POL)
**Stablecoin:** MockUSDC (ERC-20 deployed by us, 6 decimals). Real Circle USDC addresses preserved in `addresses_real_usdc.ts` for future production.
**Treasury Pool:** 50,000 MockUSDC (Contract: `0x7A972B5B25901Dd27F191937782AE431a115d099`)
**Deployer POL:** ~62.6 Amoy POL remaining for gas

**Key Upgrades:**
1. **Pure USDC Architecture:** The ecosystem has transitioned away from the MockDEX model. Freelancer payouts and AI agent escrows now settle entirely in native USDC, significantly reducing smart contract risk and gas overhead.
2. **Native P2P UPI On-Ramp:** Bypassing strict third-party FIU-compliant gateways, the platform utilizes an internal P2P Liquidity Pool. Users pay INR via personal UPI QR codes, and upon verification, the backend Orchestration Engine automatically dispenses USDC from the `PlatformTreasury` smart contract directly to their Smart Wallet via `ethers.js`.
3. **Live Gas Sponsorship:** The `VerifyingPaymaster` is fully funded with POL. The backend signs `UserOperations` for users and submits them to the global `EntryPoint`, completely abstracting away the concept of "gas" from the frontend UX.: Invisible Web3 Architecture

## Overview
This dossier outlines the architecture of the UPI-Web3 ecosystem. The system leverages the ERC-4337 Account Abstraction standard to abstract away gas fees and wallet generation, delivering an "Invisible Web3" experience that feels as seamless as traditional UPI payments.

## Core Components

### 1. Smart Account Factory (`SimpleAccountFactory.sol`)
- **Role**: Deploys BIP-compliant Smart Wallets deterministically using the `CREATE2` opcode.
- **Logic**: Maps a user's backend-managed signer (representing their UPI identity) to a unique smart contract address on-chain. This allows users to receive funds to their counterfactual address even before their wallet is deployed.

### 2. BIP-Compliant Smart Wallet (`SimpleAccount.sol`)
- **Role**: Acts as the user's on-chain identity and asset container.
- **Logic**: Accepts and executes `UserOperation` requests forwarded by the `EntryPoint`. Validates that the requests are signed by the user's authorized backend signer.

### 3. Verifying Paymaster (`VerifyingPaymaster.sol`)
- **Role**: Solves the "Gas Problem" by paying transaction fees (gas) on behalf of the user.
- **Logic**: 
  - Maintains a deposit balance in the `EntryPoint`.
  - Implements `validatePaymasterUserOp` to verify that a `UserOperation` contains a valid signature from the ecosystem's trusted backend authority (`verifyingSigner`).
  - If the signature is valid, the Paymaster subsidizes the gas for the Smart Wallet's execution.

### 4. EntryPoint (`EntryPoint.sol` - Standard ERC-4337)
- **Role**: The global singleton contract that orchestrates the execution and verification of all `UserOperations`.
- **Logic**: Validates both the Paymaster's willingness to sponsor the transaction and the Smart Wallet's signature before executing the actual call data.

## Data Flow: Sponsored Transaction
1. The user attempts an action (e.g., transferring tokens).
2. The frontend/client constructs a `UserOperation` lacking the `paymasterAndData` signature.
3. The client requests gas sponsorship from the Backend Orchestration Engine.
4. The Backend checks the user's internal INR ledger. If sufficient, it deducts an INR fee and signs the `UserOperation` hash with its `verifyingSigner` key.
5. The frontend attaches the Paymaster signature and the user's execution signature to the `UserOperation`.
6. The bundle is sent to the `EntryPoint`, which verifies the signatures, debits the Paymaster for gas, and triggers the Smart Wallet's execution.

## The Unified Flow (Phase 4 Orchestrator)
The Unified Flow collapses the above process into a single, seamless API call for the user, mimicking a traditional Web2 checkout experience. 

1. **UPI Simulation**: The user tops up their account using a traditional UPI gateway. The fiat gateway triggers our internal `LedgerService`, crediting the user's PostgreSQL ledger balance.
2. **One-Click Execution**: The user submits a single `POST /execute-payment` request specifying their UPI ID and target action.
3. **Automated Orchestration**:
   - The `TransactionOrchestrator` verifies the INR balance.
   - It debits the exact required fiat fee.
   - It constructs the `UserOperation` dynamically.
   - It securely double-signs the operation (acting as the Paymaster and the user's temporary execution signer).
   - It acts as the **Embedded Bundler**, calling `entryPoint.handleOps()` directly via `ethers.js` to dispatch the transaction onto the blockchain.
4. **Finality**: The user receives a finalized blockchain transaction hash immediately, having never seen a wallet address, private key, or gas fee.

## Layer 2: Neo-Banking Client

### The Invoice & Escrow Database Flow
1. **Creation (PENDING):** A freelancer creates an invoice. The database saves it with `status = "PENDING"`.
2. **On-Ramp Funding (FUNDED):** The client pays via the public portal (simulated fiat gateway). `OnRampService` mints USDC, approves the contract, and calls `fundInvoice()`. The database updates the invoice to `status = "FUNDED"`, and stores the `clientName` and `clientEmail`.
3. **Claim & Release (RELEASED):** The freelancer sees the `FUNDED` invoice and clicks "Claim & Release". The backend triggers `releasePayment()` on the smart contract, moving the USDC to the freelancer's smart wallet. The database updates the invoice to `status = "RELEASED"` and creates a `Ledger` entry (credit) reflecting the new global balance.
4. **Off-Ramp (Withdraw to Bank):** The freelancer withdraws to their bank. The backend transfers USDC to the `PlatformTreasury`, simulates fiat conversion, creates a negative `Ledger` entry (debit), and zeros out their dashboard balance.

The frontend is built using **Next.js 14 (App Router)** and serves as the visual abstraction layer that makes the Web3 interactions invisible.

### Design System & Visuals
- **Premium Minimalist Aesthetic**: A dark-mode default interface featuring a Deep Charcoal (`#0A0A0A`) background, Electric Indigo (`#6366F1`) primary accents, and Emerald (`#10B981`) success indicators.
- **Typography**: Uses the ultra-modern `Geist` font for clean, futuristic readability.
- **Micro-animations**: Leverages `Framer Motion` to smoothly transition users through multi-step auth and between dashboard sections.

### Component Structure (Multi-Page App Router)
1. **Auth Page (`/auth`)**: Multi-step flow — identifier input (email/mobile toggle) → password (with real-time strength indicator) → OTP verification (6-digit input) → profile setup (signup only).
2. **Dashboard (`/dashboard`)**: Tabbed bento layout with Overview, Invoices, AI Agents, and Digital Vault sections. Protected by JWT authentication.
3. **Profile (`/profile`)**: Personal info editing, contact details with verification badges, UPI payout details, account linking (email ↔ mobile), and KYC status card.

## Authentication & Identity Layer

This layer replaces the previous UPI-based identity system with a production-grade authentication architecture.

### 1. User Identity Model
Users are identified by `email` and/or `mobile` (both unique, nullable). At least one is required at the application level. Users can sign up with one and link the other later via OTP verification.

### 2. Password Security (`AuthService.ts`)
- Passwords are hashed with **bcrypt** (12 salt rounds) before storage.
- Password strength enforcement: minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number, 1 special character.
- Specific error messages returned for each missing criterion.

### 3. Dual-Factor Login
Login requires **both** password verification **and** OTP verification:
1. User submits `identifier` + `password` + `otp`
2. Backend verifies password via `bcrypt.compare()`
3. Backend verifies OTP against `OtpVerification` table (must be unused and not expired)
4. On success, issues a JWT token (`{ userId, email, mobile }`, 24-hour expiry)

### 4. OTP Lifecycle (`OtpVerification` model)
- OTPs are generated for 3 purposes: `SIGNUP`, `LOGIN`, `LINK_ACCOUNT`
- Each OTP has a 5-minute expiry window
- Old unused OTPs for the same target+purpose are automatically invalidated
- **Simulated**: All OTPs are hardcoded to `199991` for development

### 5. JWT Session Management
- Tokens are signed with `JWT_SECRET` from environment variables
- `authMiddleware.ts` validates Bearer tokens on all protected routes
- Frontend stores token in `localStorage` and auto-attaches it to every API call via an Axios interceptor
- 401 responses trigger automatic logout and redirect to `/auth`

### 6. Account Linking
Users who signed up with email can later link a mobile number (and vice versa) via OTP verification on the new identifier. Both become valid login credentials.

## Layer 2: Real Payment Applications (Global Payout Infrastructure)

This architecture bridges global Web3 liquidity into localized Fiat banking via a seamless Off-Ramp integration. It enables freelancers to receive borderless payments and withdraw them locally without dealing with crypto exchanges.

### 1. Pure ERC20 USDC Escrow (`PayoutManager.sol`)
Global clients deposit USDC directly into the `PayoutManager` smart contract via the standard ERC20 `approve` → `transferFrom` flow, keyed to a unique `invoiceId`. The contract tracks the `payer`, `payee`, and `amount` for each invoice. Only the backend orchestrator can authorize release or cancellation of escrowed funds.

**Key Functions:**
- `fundEscrow(invoiceId, amount, payee)` — Client locks USDC after granting approval
- `releasePayment(invoiceId)` — Backend releases USDC to the freelancer's Smart Wallet
- `cancelEscrow(invoiceId)` — Backend refunds USDC to the original payer (dispute resolution)

### 2. Settlement Watcher & Global Ledger (`ProductService.ts`)
The Backend Orchestration Engine monitors the state of freelancer invoices. When a client authorizes payment (simulated via a UI action), the Backend signs and executes the `releasePayment` function on the `PayoutManager`. 
Simultaneously, the watcher updates the user's internal `Ledger` within the database, marking the exact amount of global USDC as available for withdrawal.

### 3. Platform Treasury (`PlatformTreasury.sol`)
A USDC-aware holding contract for the off-ramp process. It provides:
- `deposit()` — Accepts USDC from freelancer wallets during withdrawal
- `withdrawToLP()` — Owner sends net USDC to the Liquidity Provider for fiat conversion
- `treasuryBalance()` — View of currently held platform revenue
- `emergencyWithdrawToken()` — Safety mechanism for recovering misrouted ERC20 tokens

### 4. The Last-Mile Bridge: Liquidity Provider Off-Ramp (`OffRampService.ts`)
Once the USDC balance is available, the user triggers a withdrawal to their local bank account via UPI.
1. The backend moves the USDC from the user's Smart Wallet into `PlatformTreasury.sol`.
2. The `OffRampService` acts as a Liquidity Provider (LP). It calculates a live USDC-to-INR exchange rate (currently ₹95.00), deducts a **structural 1% platform fee** in USDC, and simulates an API call to a localized banking provider (like Razorpay).
3. The platform executes a traditional IMPS/UPI transfer out of the ecosystem directly into the freelancer's bank account, completing the "Invisible Web3" loop.
4. The 1% fee remains in the `PlatformTreasury` as platform revenue.

## Layer 3: Autonomous AI Economy

This layer introduces programmable AI agents capable of initiating and signing Web3 transactions securely.

### 1. Dual-Guardrail Architecture
Because AI Agents are non-human programs holding their own private keys (stored in the backend), we employ strict financial guardrails to prevent catastrophic loss:
- **On-chain Guardrail (`AIAgentWallet.sol`)**: A customized Smart Wallet that enforces a hard `maxPerTxLimit`. The Smart Contract overrides standard signature validation to accept either the Human Owner or the AI Agent as a valid signer, provided the AI doesn't exceed its bounds.
- **Backend Policy Engine (`AIService.ts`)**: An off-chain monitor that checks the `dailyBudget` and `spentToday` records in the database *before* generating the Paymaster sponsorship signature. If the AI is over-budget, the transaction is rejected at the API level and is never broadcast.

### 2. The Identity and Signature Flow
1. **Creation**: A human user requests an AI Agent via the Dashboard. The Backend generates a secure Ethers Wallet for the AI and saves its identity in the SQLite database.
2. **Pre-Configuration**: To avoid `AA40` verification conflicts, the backend deploys the `AIAgentWallet` proxy immediately using a deterministic salt derived from `BigInt(aiAgent.agentAddress)` and sets the authorized AI Agent address on-chain using the human owner's (`VERIFYING_SIGNER_PRIVATE_KEY`) signature.
3. **Simulation**: The AI Agent signs a `UserOperation` locally.
4. **Authorization**: The Backend Policy Engine verifies the AI's signature and the requested budget/cost.
5. **Sponsorship**: If authorized, the Backend Paymaster signs the `paymasterAndData` field.
6. **Execution**: The transaction is dispatched via the Bundler to `handleOps`, autonomously executing the call.

## Layer 4: Digital Ownership & Trust

The Digital Ownership layer introduces Verifiable Digital Assets (Certificates and Memberships) to the ecosystem using the ERC-721 NFT standard. 

### Authorized Issuer Pattern
To ensure the integrity of the credentials without centralizing the minting execution, we utilize an **Authorized Issuer** pattern combined with **ERC-4337 Account Abstraction**:
1. **Metadata Generation & Signature**: The backend `OwnershipService` generates the credential metadata (e.g., Name, Date, Issuer) and creates a cryptographic signature (`issuerSignature`) over the user's Smart Wallet address and the metadata URI using the platform's trusted `backendIssuer` private key.
2. **Gasless User Execution**: Instead of the platform paying gas to mint the NFT to the user, the platform constructs a `UserOperation` where the *user's Smart Wallet* calls `mintCredential(to, uri, issuerSignature)`.
3. **Paymaster Sponsorship**: The platform's Paymaster sponsors this specific `UserOperation`. 
4. **On-Chain Verification**: The `DigitalCredential.sol` smart contract verifies the `issuerSignature` via ECDSA recovery. If the recovered signer matches the trusted `backendIssuer`, the NFT is minted directly to the user.

### Soulbound Credentials
Certain assets, like educational certificates or identity verification badges, must be non-transferable. This is enforced directly at the smart contract level by overriding the OpenZeppelin `_beforeTokenTransfer` hook:
```solidity
function _beforeTokenTransfer(address from, address to, uint256 firstTokenId, uint256 batchSize) internal override {
    super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    if (isSoulbound) {
        // Only allow minting (from == 0) or burning (to == 0)
        require(from == address(0) || to == address(0), "DigitalCredential: This asset is Soulbound");
    }
}
```
This guarantees that once a credential enters the user's Digital Vault, it remains permanently anchored to their on-chain identity.

---

## V2 Multi-Network Architecture (Phase 9+)
As the platform moves towards production, the infrastructure transitions from a strict localhost sandbox to a dynamic, multi-network environment.

### Dynamic Provider & Address Resolution
1. **RPC Gateway**: The backend uses an environment-driven `RPC_URL` to connect to providers like Alchemy, allowing seamless deployment to Polygon Amoy Testnet and Mainnet.
2. **Address Registry**: Hardcoded contract addresses are replaced by a central configuration registry (`addresses.ts`). Services dynamically resolve the `EntryPoint`, `Paymaster`, and `Factory` addresses based on the active `NETWORK` environment variable.

### Production Telemetry
The orchestration engine uses **Winston** for high-fidelity structured logging, replacing basic console output. This captures critical path latency metrics—specifically tracking the milliseconds elapsed between a "UPI Success" webhook reception and the final broadcast of a `UserOperation` to the blockchain.

## Phase 13.2 Architecture Update: Fiat On-Ramp Bridge
To simulate fiat purchases on a testnet, we integrated the Transak Staging SDK on the frontend. Because Transak issues official Sepolia tokens, we implemented an automated bridge. Upon receiving the ON_ORDER_SUCCESSFUL event, the backend signer dynamically mints our internal MockUSDC directly to the user's smart wallet. This guarantees that our isolated testnet stablecoin economy remains balanced and perfectly mimics a mainnet fiat settlement flow.

## Phase 16: Native Fiat Withdrawal (Off-Ramp)
The off-ramp mirrors the P2P on-ramp architecture, using admin-verified manual UPI payouts instead of third-party withdrawal gateways.

### Data Flow
1. **User Request**: User specifies an amount of USDC (min 1) and their UPI ID. The backend validates balance sufficiency and creates a `FiatWithdrawal` record with status `PENDING`.
2. **Admin Review**: The admin panel fetches all `PENDING` withdrawals via `GET /admin/fiat-withdrawals`, displaying the user's display name, email, wallet address, USDC amount, INR equivalent, and UPI ID.
3. **Manual UPI Payment**: The frontend generates a QR code from the user's UPI ID. The admin scans and pays via their UPI app externally.
4. **Ledger Debit**: Admin clicks "Mark as Paid" → `POST /admin/fiat-withdrawal/mark-paid`. The backend calls `LedgerService.debitBalance()` to create a negative ledger entry and updates the withdrawal status to `PAID`.

### Key Design Decisions
- **Pre-validation, Post-debit**: The user's balance is checked at request time to prevent over-commitment, but the actual ledger debit only occurs when the admin confirms payment. This avoids locking user funds during the admin review window.
- **On-Chain Treasury Replenishment via Mint**: The `VERIFYING_SIGNER` and `BUNDLER` keys are well-known Hardhat defaults that get bot-swept on public testnets. To avoid depending on them for gas, the withdrawal flow uses the `DEPLOYER_PRIVATE_KEY` (~59 POL) to call the public `mint()` function on `MockUSDC`, minting the exact withdrawal amount directly to `PlatformTreasury`. This achieves the same economic effect as pulling tokens from the user's wallet.
- **Treasury Balance Endpoint**: `GET /admin/treasury-balance` provides real-time on-chain USDC balance of the `PlatformTreasury` contract, giving the admin visibility into available liquidity for payouts.
