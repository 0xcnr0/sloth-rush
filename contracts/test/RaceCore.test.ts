import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";

describe("Race contracts", function () {
  /**
   * Hardhat 3 removed the `hre.viem` global. A network connection is opened
   * explicitly and carries its own viem helpers — the same shape
   * scripts/deploy.ts uses, so tests and deployment exercise one code path.
   *
   * Each test opens its own connection and deploys fresh contracts, so no
   * state (minted tokens, recorded races) leaks between them.
   */
  async function deployFixture() {
    const connection = await hre.network.connect();
    const { viem } = connection;

    const [owner, player1, player2] = await viem.getWalletClients();

    const freeRacer = await viem.deployContract("FreeRacer");
    const racer = await viem.deployContract("Racer");
    const raceCore = await viem.deployContract("RaceCore", [
      freeRacer.address,
      racer.address,
    ]);

    await freeRacer.write.setUpgradeContract([raceCore.address]);
    await racer.write.setMinter([raceCore.address]);

    return { viem, freeRacer, racer, raceCore, owner, player1, player2 };
  }

  describe("FreeRacer", function () {
    it("should mint one Free Racer per wallet", async function () {
      const { viem, freeRacer, player1 } = await deployFixture();

      const freeRacerAsPlayer = await viem.getContractAt(
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
      const { viem, freeRacer, player1 } = await deployFixture();

      const freeRacerAsPlayer = await viem.getContractAt(
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
      const { viem, freeRacer, racer, raceCore, player1 } = await deployFixture();

      const freeRacerAsPlayer = await viem.getContractAt(
        "FreeRacer",
        freeRacer.address,
        { client: { wallet: player1 } }
      );
      await freeRacerAsPlayer.write.mint();
      await freeRacerAsPlayer.write.approve([raceCore.address, 0n]);

      const raceCoreAsPlayer = await viem.getContractAt(
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
      const { viem, raceCore, player1 } = await deployFixture();

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
