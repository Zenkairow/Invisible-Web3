// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PayoutManager
 * @notice Manages USDC escrow for freelancer invoices. Clients fund escrows 
 *         directly with ERC20 USDC. The backend orchestrator authorizes release
 *         to the freelancer's Smart Wallet.
 */
contract PayoutManager {
    address public backendSigner;
    IERC20 public usdc;

    enum InvoiceStatus { PENDING, RELEASED, CANCELLED }

    struct Invoice {
        uint256 amount;       // in USDC (6 decimals)
        InvoiceStatus status;
        address payee;        // freelancer's Smart Wallet
        address payer;        // client who funded the escrow
    }

    mapping(string => Invoice) public invoices;

    event EscrowFunded(string indexed invoiceId, uint256 amountUSDC, address payer, address payee);
    event PaymentReleased(string indexed invoiceId, uint256 amountUSDC, address payee);
    event EscrowCancelled(string indexed invoiceId, uint256 amountUSDC, address refundedTo);

    modifier onlyBackend() {
        require(msg.sender == backendSigner, "Not authorized: Backend only");
        _;
    }

    constructor(address _backendSigner, address _usdc) {
        require(_backendSigner != address(0), "Invalid backend signer");
        require(_usdc != address(0), "Invalid USDC address");
        backendSigner = _backendSigner;
        usdc = IERC20(_usdc);
    }

    /**
     * @notice Client funds an escrow by depositing USDC for a specific invoice.
     * @dev Client must call usdc.approve(payoutManager, amount) before calling this.
     * @param invoiceId Unique invoice identifier from the backend
     * @param amount USDC amount in 6-decimal precision
     * @param payee The freelancer's Smart Wallet address that will receive payout
     */
    function fundInvoice(string memory invoiceId, uint256 amount, address payee) external {
        require(invoices[invoiceId].amount == 0, "Invoice already exists");
        require(amount > 0, "Amount must be greater than zero");
        require(payee != address(0), "Invalid payee address");
        require(usdc.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");

        invoices[invoiceId] = Invoice({
            amount: amount,
            status: InvoiceStatus.PENDING,
            payee: payee,
            payer: msg.sender
        });

        emit EscrowFunded(invoiceId, amount, msg.sender, payee);
    }

    /**
     * @notice Backend releases escrowed USDC to the freelancer after work verification.
     * @param invoiceId The invoice to release
     */
    function releasePayment(string memory invoiceId) external onlyBackend {
        Invoice storage inv = invoices[invoiceId];
        require(inv.amount > 0, "Invoice does not exist");
        require(inv.status == InvoiceStatus.PENDING, "Invoice not in PENDING state");

        inv.status = InvoiceStatus.RELEASED;
        require(usdc.transfer(inv.payee, inv.amount), "USDC transfer to payee failed");

        emit PaymentReleased(invoiceId, inv.amount, inv.payee);
    }

    /**
     * @notice Backend can cancel an escrow and refund the client if needed.
     * @param invoiceId The invoice to cancel
     */
    function cancelEscrow(string memory invoiceId) external onlyBackend {
        Invoice storage inv = invoices[invoiceId];
        require(inv.amount > 0, "Invoice does not exist");
        require(inv.status == InvoiceStatus.PENDING, "Invoice not in PENDING state");

        inv.status = InvoiceStatus.CANCELLED;
        require(usdc.transfer(inv.payer, inv.amount), "USDC refund failed");

        emit EscrowCancelled(invoiceId, inv.amount, inv.payer);
    }

    /**
     * @notice View function to check the USDC balance held by this contract.
     */
    function escrowBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
