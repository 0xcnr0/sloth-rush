import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";

describe("Race contracts", function () {
  async function deployFixture() {
    const [owner, player1, player2] = await hre.viem.getWalletClients();

    const freeRacer = await hre.viem.deployContract("FreeRacer");
    const racer = await hre.viem.deployContract("Racer");
    const raceCore = await hre.viem.deployContract("RaceCore", [
      freeRacer.address,
      racer.address,
    ]);

    await freeRacer.write.setUpgradeContract([raceCore.address]);
    await racer.write.setMinter([raceCore.address]);

    return { freeRacer, racer, raceCore, owner, player1, player2 };
  }

  describe("FreeRacer", function () {
    it("should mint one Free Racer per wallet", async function () {
      const { freeRacer, player1 } = await deployFixture();

      const freeRacerAsPlayer = await hre.viem.getContractAt(
        "FreeRacer",
        freeRacer.address,
        { client: { wallet: player1 } }
      );

      await freeRacerAsPlayer.write.mint();

      const ownerOf = await freeRacer.read.ownerOf([0n]);
      assert.equal(
        ownerOf.toLowerCase(),
        player1.account.address.toLowerCase()
      );
    });

    it("should reject second mint from same wallet", async function () {
      const { freeRacer, player1 } = await deployFixture();

      const freeRacerAsPlayer = await hre.viem.getContractAt(
        "FreeRacer",
        freeRacer.address,
        { client: { wallet: player1 } }
      );

      await freeRacerAsPlayer.write.mint();

      await assert.rejects(
        freeRacerAsPlayer.write.mint(),
        /Already minted/
      );
    });
  });

  describe("Upgrade Flow", function () {
    it("should burn Free Racer and mint Racer", async function () {
      const { freeRacer, racer, raceCore, player1 } = await deployFixture();

      const freeRacerAsPlayer = await hre.viem.getContractAt(
        "FreeRacer",
        freeRacer.address,
        { client: { wallet: player1 } }
      );
      await freeRacerAsPlayer.write.mint();
      await freeRacerAsPlayer.write.approve([raceCore.address, 0n]);

      const raceCoreAsPlayer = await hre.viem.getContractAt(
        "RaceCore",
        raceCore.address,
        { client: { wallet: player1 } }
      );

      await raceCoreAsPlayer.write.upgrade([
        0n,  // freeRacerId
        0,   // rarity (Common)
        12,  // spd
        11,  // acc
        10,  // sta
        11,  // agi
        10,  // ref
        12,  // lck
      ]);

      const racerOwner = await racer.read.ownerOf([0n]);
      assert.equal(
        racerOwner.toLowerCase(),
        player1.account.address.toLowerCase()
      );

      const stats = await racer.read.getStats([0n]);
      assert.equal(stats[1], 12); // spd
      assert.equal(stats[0], 0);  // rarity = Common
    });
  });

  describe("Race Result Recording", function () {
    it("should record and retrieve race results", async function () {
      const { raceCore, player1 } = await deployFixture();

      const raceId =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;
      const resultHash =
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`;

      await raceCore.write.recordRaceResult([
        raceId,
        resultHash,
        player1.account.address,
      ]);

      const result = await raceCore.read.getRaceResult([raceId]);
      assert.equal(result[0], resultHash);
      assert.equal(
        result[1].toLowerCase(),
        player1.account.address.toLowerCase()
      );
    });
  });
});
