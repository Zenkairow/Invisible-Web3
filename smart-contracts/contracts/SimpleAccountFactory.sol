// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@account-abstraction/contracts/samples/SimpleAccount.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * A Factory for SimpleAccount.
 */
contract SimpleAccountFactory {
    SimpleAccount public immutable accountImplementation;

    constructor(IEntryPoint _entryPoint) {
        accountImplementation = new SimpleAccount(_entryPoint);
    }

    /**
     * create an account, and return its address.
     * returns the address even if the account is already deployed.
     * Note that during UserOperation execution, this method is called only if the account is not deployed.
     * This method returns an existing account address so that entryPoint.getSenderAddress() would work even after account creation
     */
    function createAccount(address owner, uint256 salt) public returns (SimpleAccount ret) {
        address addr = getAddress(owner, salt);
        uint codeSize = addr.code.length;
        if (codeSize > 0) {
            return SimpleAccount(payable(addr));
        }
        bytes memory initCode = abi.encodeCall(SimpleAccount.initialize, (owner));
        ERC1967Proxy proxy = new ERC1967Proxy{salt : bytes32(salt)}(address(accountImplementation), initCode);
        return SimpleAccount(payable(address(proxy)));
    }

    /**
     * calculate the counterfactual address of this account as it would be returned by createAccount()
     */
    function getAddress(address owner, uint256 salt) public view returns (address) {
        bytes memory initCode = abi.encodeCall(SimpleAccount.initialize, (owner));
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                bytes32(salt),
                keccak256(abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(address(accountImplementation), initCode)))
            )
        );
        return address(uint160(uint256(hash)));
    }
}
