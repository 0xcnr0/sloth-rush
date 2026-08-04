// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./FreeRacer.sol";
import "./Racer.sol";

/**
 * @title RaceCore
 * @notice Main game contract — upgrade, race result recording
 */
contract RaceCore {
    FreeRacer public freeRacer;
    Racer public racer;
    address public owner;

    struct RaceResult {
        bytes32 resultHash;
        address winner;
        uint256 timestamp;
    }

    mapping(bytes32 => RaceResult) public raceResults;
    bytes32[] public raceIds;

    event Upgraded(address indexed player, uint256 freeRacerId, uint256 racerId, uint8 rarity);
    event RaceRecorded(bytes32 indexed raceId, bytes32 resultHash, address winner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _freeRacer, address _racer) {
        freeRacer = FreeRacer(_freeRacer);
        racer = Racer(_racer);
        owner = msg.sender;
    }

    /// @notice Upgrade a Free Racer to a Racer
    /// @dev Burns the Free Racer and mints a new Racer with given stats
    /// @param freeRacerId The token ID of the Free Racer to burn
    /// @param rarity Rarity level (0=Common, 4=Legendary)
    function upgrade(
        uint256 freeRacerId,
        uint8 rarity,
        uint8 spd,
        uint8 acc,
        uint8 sta,
        uint8 agi,
        uint8 ref_,
        uint8 lck
    ) external {
        // Verify ownership
        require(freeRacer.ownerOf(freeRacerId) == msg.sender, "Not racer owner");

        // Burn the Free Racer
        freeRacer.burn(freeRacerId);

        // Mint new Racer
        uint256 racerId = racer.mint(msg.sender, rarity, spd, acc, sta, agi, ref_, lck);

        emit Upgraded(msg.sender, freeRacerId, racerId, rarity);
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
