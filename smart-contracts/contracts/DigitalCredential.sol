// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract DigitalCredential is ERC721URIStorage {
    using ECDSA for bytes32;

    uint256 private _nextTokenId;
    address public backendIssuer;
    bool public isSoulbound;

    constructor(address _backendIssuer, bool _isSoulbound) ERC721("Invisible Credential", "INV-CRED") {
        backendIssuer = _backendIssuer;
        isSoulbound = _isSoulbound;
    }

    /**
     * @dev Mints a new credential. Can be called by anyone (like a user's Smart Wallet via a UserOp), 
     * but strictly requires a cryptographic signature from the authorized `backendIssuer`.
     */
    function mintCredential(address to, string memory metadataURI, bytes memory issuerSignature) external returns (uint256) {
        bytes32 hash = keccak256(abi.encodePacked(to, metadataURI));
        bytes32 ethSignedHash = hash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(issuerSignature);
        
        require(signer == backendIssuer, "DigitalCredential: Unauthorized issuer signature");

        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);
        return tokenId;
    }

    // Overriding _beforeTokenTransfer for Soulbound logic
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);

        if (isSoulbound) {
            // Revert if it is a transfer (not a mint and not a burn)
            require(from == address(0) || to == address(0), "DigitalCredential: This asset is Soulbound and non-transferable");
        }
    }
}
