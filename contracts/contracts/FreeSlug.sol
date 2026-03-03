// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FreeSlug
 * @notice Free Slug ERC-721 — one per wallet, burnable for upgrade
 */
contract FreeSlug is ERC721, Ownable {
    uint256 private _nextTokenId;
    string private _baseTokenURI;

    mapping(address => bool) public hasMinted;

    // Address authorized to burn (SlugRush contract)
    address public upgradeContract;

    constructor() ERC721("Slug Rush: Free Slug", "FSLUG") Ownable(msg.sender) {}

    /// @notice Mint one Free Slug per wallet
    function mint() external {
        require(!hasMinted[msg.sender], "Already minted");
        hasMinted[msg.sender] = true;

        uint256 tokenId = _nextTokenId++;
        _mint(msg.sender, tokenId);
    }

    /// @notice Burn a Free Slug (only owner or approved upgrade contract)
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
