// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "./AIAgentWallet.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract AIAgentWalletFactory {
    AIAgentWallet public immutable accountImplementation;

    constructor(IEntryPoint _entryPoint) {
        accountImplementation = new AIAgentWallet(_entryPoint);
    }

    function createAccount(address owner, uint256 salt) public returns (AIAgentWallet ret) {
        address addr = getAddress(owner, salt);
        uint codeSize = addr.code.length;
        if (codeSize > 0) {
            return AIAgentWallet(payable(addr));
        }
        bytes memory initCode = abi.encodeCall(AIAgentWallet.initialize, (owner));
        ERC1967Proxy proxy = new ERC1967Proxy{salt : bytes32(salt)}(address(accountImplementation), initCode);
        return AIAgentWallet(payable(address(proxy)));
    }

    function getAddress(address owner, uint256 salt) public view returns (address) {
        bytes memory initCode = abi.encodeCall(AIAgentWallet.initialize, (owner));
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
