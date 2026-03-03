// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Snail
 * @notice Snail ERC-721 with dynamic metadata — 6 stats + rarity on-chain
 */
contract Snail is ERC721, Ownable {
    uint256 private _nextTokenId;
    string private _baseTokenURI;

    enum Rarity { Common, Uncommon, Rare, Epic, Legendary }

    struct Stats {
        uint8 spd;
        uint8 acc;
        uint8 sta;
        uint8 agi;
        uint8 ref;
        uint8 lck;
    }

    struct SnailData {
        Rarity rarity;
        Stats stats;
    }

    mapping(uint256 => SnailData) public snailData;

    // Only SlugRush contract can mint
    address public minter;

    constructor() ERC721("Slug Rush: Snail", "SNAIL") Ownable(msg.sender) {}

    /// @notice Mint a new Snail (only minter — SlugRush contract)
    function mint(
        address to,
        uint8 rarity,
        uint8 spd,
        uint8 acc,
        uint8 sta,
        uint8 agi,
        uint8 ref_,
        uint8 lck
    ) external returns (uint256) {
        require(msg.sender == minter, "Only minter can mint");
        require(rarity <= uint8(Rarity.Legendary), "Invalid rarity");

        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);

        snailData[tokenId] = SnailData({
            rarity: Rarity(rarity),
            stats: Stats({
                spd: spd,
                acc: acc,
                sta: sta,
                agi: agi,
                ref: ref_,
                lck: lck
            })
        });

        return tokenId;
    }

    /// @notice Update stats (for training — only minter)
    function updateStats(
        uint256 tokenId,
        uint8 spd,
        uint8 acc,
        uint8 sta,
        uint8 agi,
        uint8 ref_,
        uint8 lck
    ) external {
        require(msg.sender == minter, "Only minter can update");
        require(ownerOf(tokenId) != address(0), "Token does not exist");

        snailData[tokenId].stats = Stats({
            spd: spd, acc: acc, sta: sta,
            agi: agi, ref: ref_, lck: lck
        });
    }

    /// @notice Get snail stats
    function getStats(uint256 tokenId) external view returns (
        uint8 rarity, uint8 spd, uint8 acc, uint8 sta, uint8 agi, uint8 ref_, uint8 lck
    ) {
        SnailData storage data = snailData[tokenId];
        return (
            uint8(data.rarity),
            data.stats.spd,
            data.stats.acc,
            data.stats.sta,
            data.stats.agi,
            data.stats.ref,
            data.stats.lck
        );
    }

    /// @notice Set the minter address (SlugRush contract)
    function setMinter(address _minter) external onlyOwner {
        minter = _minter;
    }

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
