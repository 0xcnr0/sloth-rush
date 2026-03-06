// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FreeSloth
 * @notice Free Sloth ERC-721 — one per wallet, burnable for upgrade
 */
contract FreeSloth is ERC721, Ownable {
    uint256 private _nextTokenId;
    string private _baseTokenURI;

    mapping(address => bool) public hasMinted;

    // Address authorized to burn (SlothRush contract)
    address public upgradeContract;

    constructor() ERC721("Sloth Rush: Free Sloth", "FSLOTH") Ownable(msg.sender) {}

    /// @notice Mint one Free Sloth per wallet
    function mint() external {
        require(!hasMinted[msg.sender], "Already minted");
        hasMinted[msg.sender] = true;

        uint256 tokenId = _nextTokenId++;
        _mint(msg.sender, tokenId);
    }

    /// @notice Burn a Free Sloth (only owner or approved upgrade contract)
    function burn(uint256 tokenId) external {
        require(
            msg.sender == ownerOf(tokenId) || msg.sender == upgradeContract,
            "Not authorized to burn"
        );
        _burn(tokenId);
    }

    /// @notice Set the upgrade contract address
    function setUpgradeContract(address _upgradeContract) external onlyOwner {
        upgradeContract = _upgradeContract;
    }

    /// @notice Set base URI for metadata
    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }
}
