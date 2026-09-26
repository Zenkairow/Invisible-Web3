// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

contract DummyTarget {
    string public lastMessage;
    address public lastSender;

    event MessageSet(address indexed sender, string message);

    function setMessage(string memory message) public {
        lastMessage = message;
        lastSender = msg.sender;
        emit MessageSet(msg.sender, message);
    }
}
