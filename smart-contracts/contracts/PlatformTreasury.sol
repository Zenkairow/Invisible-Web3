// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PlatformTreasury
 * @notice Holds platform revenue (fees collected during off-ramp) and provides
 *         controlled withdrawal for the Liquidity Provider integration.
 *         Only the platform owner can initiate withdrawals.
 */
contract PlatformTreasury is Ownable {
    IERC20 public usdc;

    event FundsDeposited(address indexed from, uint256 amount);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);

    constructor(address _usdc) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20(_usdc);
    }

    /**
     * @notice Deposit USDC into the treasury. Called by the backend after
     *         collecting funds from the freelancer's Smart Wallet during off-ramp.
     * @dev Caller must approve this contract for the amount first.
     * @param amount The USDC amount to deposit (6 decimals)
     */
    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");
        require(usdc.transferFrom(msg.sender, address(this), amount), "USDC deposit failed");
        emit FundsDeposited(msg.sender, amount);
    }

    /**
     * @notice Withdraw USDC to a Liquidity Provider for fiat conversion.
     *         Only callable by the platform owner.
     * @param to The LP's address
     * @param amount The USDC amount to send
     */
    function withdrawToLP(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than zero");
        require(usdc.transfer(to, amount), "USDC withdrawal failed");
        emit FundsWithdrawn(to, amount);
    }

    /**
     * @notice Execute external crypto payout. 
     *         If convertToETH is true, uses DEX (MockDEX must be provided as to).
     *         Otherwise, just sends USDC.
     */
    function executeExternalCryptoPayout(address destination, uint256 usdcAmount, bool convertToETH, address mockDex) external onlyOwner {
        require(destination != address(0), "Invalid destination");
        require(usdcAmount > 0, "Amount must be > 0");

        if (convertToETH) {
            require(mockDex != address(0), "MockDEX address required");
            require(usdc.approve(mockDex, usdcAmount), "USDC approve failed");
            // Call MockDEX to swap and transfer
            (bool success, ) = mockDex.call(
                abi.encodeWithSignature("swapUSDCForETHAndTransfer(uint256,address)", usdcAmount, destination)
            );
            require(success, "DEX Swap & Transfer failed");
        } else {
            require(usdc.transfer(destination, usdcAmount), "USDC transfer failed");
        }
        emit FundsWithdrawn(destination, usdcAmount);
    }

    /**
     * @notice Emergency function to recover any ERC20 token sent to this contract.
     * @param token The ERC20 token address
     * @param to The recovery address
     * @param amount The amount to recover
     */
    function emergencyWithdrawToken(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(IERC20(token).transfer(to, amount), "Emergency transfer failed");
        emit EmergencyWithdraw(token, to, amount);
    }

    /**
     * @notice View the USDC balance currently held by the treasury.
     */
    function treasuryBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
