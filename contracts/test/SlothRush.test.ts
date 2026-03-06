import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";

describe("Sloth Rush Contracts", function () {
  async function deployFixture() {
    const [owner, player1, player2] = await hre.viem.getWalletClients();

    const freeSloth = await hre.viem.deployContract("FreeSloth");
    const sloth = await hre.viem.deployContract("Sloth");
    const slothRush = await hre.viem.deployContract("SlothRush", [
      freeSloth.address,
      sloth.address,
    ]);

    await freeSloth.write.setUpgradeContract([slothRush.address]);
    await sloth.write.setMinter([slothRush.address]);

    return { freeSloth, sloth, slothRush, owner, player1, player2 };
  }

  describe("FreeSloth", function () {
    it("should mint one Free Sloth per wallet", async function () {
      const { freeSloth, player1 } = await deployFixture();

      const freeSlothAsPlayer = await hre.viem.getContractAt(
        "FreeSloth",
        freeSloth.address,
        { client: { wallet: player1 } }
      );

      await freeSlothAsPlayer.write.mint();

      const ownerOf = await freeSloth.read.ownerOf([0n]);
      assert.equal(
        ownerOf.toLowerCase(),
        player1.account.address.toLowerCase()
      );
    });

    it("should reject second mint from same wallet", async function () {
      const { freeSloth, player1 } = await deployFixture();

      const freeSlothAsPlayer = await hre.viem.getContractAt(
        "FreeSloth",
        freeSloth.address,
        { client: { wallet: player1 } }
      );

      await freeSlothAsPlayer.write.mint();

      await assert.rejects(
        freeSlothAsPlayer.write.mint(),
        /Already minted/
      );
    });
  });

  describe("Upgrade Flow", function () {
    it("should burn Free Sloth and mint Sloth", async function () {
      const { freeSloth, sloth, slothRush, player1 } = await deployFixture();

      const freeSlothAsPlayer = await hre.viem.getContractAt(
        "FreeSloth",
        freeSloth.address,
        { client: { wallet: player1 } }
      );
      await freeSlothAsPlayer.write.mint();
      await freeSlothAsPlayer.write.approve([slothRush.address, 0n]);

      const slothRushAsPlayer = await hre.viem.getContractAt(
        "SlothRush",
        slothRush.address,
        { client: { wallet: player1 } }
      );

      await slothRushAsPlayer.write.upgrade([
        0n,  // freeSlothId
        0,   // rarity (Common)
        12,  // spd
        11,  // acc
        10,  // sta
        11,  // agi
        10,  // ref
        12,  // lck
      ]);

      const slothOwner = await sloth.read.ownerOf([0n]);
      assert.equal(
        slothOwner.toLowerCase(),
        player1.account.address.toLowerCase()
      );

      const stats = await sloth.read.getStats([0n]);
      assert.equal(stats[1], 12); // spd
      assert.equal(stats[0], 0);  // rarity = Common
    });
  });

  describe("Race Result Recording", function () {
    it("should record and retrieve race results", async function () {
      const { slothRush, player1 } = await deployFixture();

      const raceId =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;
      const resultHash =
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`;

      await slothRush.write.recordRaceResult([
        raceId,
        resultHash,
        player1.account.address,
      ]);

      const result = await slothRush.read.getRaceResult([raceId]);
      assert.equal(result[0], resultHash);
      assert.equal(
        result[1].toLowerCase(),
        player1.account.address.toLowerCase()
      );
    });
  });
});
