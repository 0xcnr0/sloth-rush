// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./FreeSlug.sol";
import "./Snail.sol";

/**
 * @title SlugRush
 * @notice Main game contract — upgrade, race result recording
 */
contract SlugRush {
    FreeSlug public freeSlug;
    Snail public snail;
    address public owner;

    struct RaceResult {
        bytes32 resultHash;
        address winner;
        uint256 timestamp;
    }

    mapping(bytes32 => RaceResult) public raceResults;
    bytes32[] public raceIds;

    event Upgraded(address indexed player, uint256 freeSlugId, uint256 snailId, uint8 rarity);
    event RaceRecorded(bytes32 indexed raceId, bytes32 resultHash, address winner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _freeSlug, address _snail) {
        freeSlug = FreeSlug(_freeSlug);
        snail = Snail(_snail);
        owner = msg.sender;
    }

    /// @notice Upgrade a Free Slug to a Snail
    /// @dev Burns the Free Slug and mints a new Snail with given stats
    /// @param freeSlugId The token ID of the Free Slug to burn
    /// @param rarity Rarity level (0=Common, 4=Legendary)
    function upgrade(
        uint256 freeSlugId,
        uint8 rarity,
        uint8 spd,
        uint8 acc,
        uint8 sta,
        uint8 agi,
        uint8 ref_,
        uint8 lck
    ) external {
        // Verify ownership
        require(freeSlug.ownerOf(freeSlugId) == msg.sender, "Not slug owner");

        // Burn the Free Slug
        freeSlug.burn(freeSlugId);

        // Mint new Snail
        uint256 snailId = snail.mint(msg.sender, rarity, spd, acc, sta, agi, ref_, lck);

        emit Upgraded(msg.sender, freeSlugId, snailId, rarity);
    }

    /// @notice Record a race result on-chain
    /// @param raceId Unique race identifier
    /// @param resultHash SHA-256 hash of the race result
    /// @param winner Address of the race winner
    function recordRaceResult(
        bytes32 raceId,
        bytes32 resultHash,
        address winner
    ) external onlyOwner {
        require(raceResults[raceId].timestamp == 0, "Race already recorded");

        raceResults[raceId] = RaceResult({
            resultHash: resultHash,
            winner: winner,
            timestamp: block.timestamp
        });

        raceIds.push(raceId);

        emit RaceRecorded(raceId, resultHash, winner);
    }

    /// @notice Get a race result
    function getRaceResult(bytes32 raceId) external view returns (
        bytes32 resultHash,
        address winner,
        uint256 timestamp
    ) {
        RaceResult storage r = raceResults[raceId];
        return (r.resultHash, r.winner, r.timestamp);
    }

    /// @notice Total recorded races
    function totalRaces() external view returns (uint256) {
        return raceIds.length;
    }
}
