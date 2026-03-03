import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";

describe("Slug Rush Contracts", function () {
  async function deployFixture() {
    const [owner, player1, player2] = await hre.viem.getWalletClients();

    const freeSlug = await hre.viem.deployContract("FreeSlug");
    const snail = await hre.viem.deployContract("Snail");
    const slugRush = await hre.viem.deployContract("SlugRush", [
      freeSlug.address,
      snail.address,
    ]);

    await freeSlug.write.setUpgradeContract([slugRush.address]);
    await snail.write.setMinter([slugRush.address]);

    return { freeSlug, snail, slugRush, owner, player1, player2 };
  }

  describe("FreeSlug", function () {
    it("should mint one Free Slug per wallet", async function () {
      const { freeSlug, player1 } = await deployFixture();

      const freeSlugAsPlayer = await hre.viem.getContractAt(
        "FreeSlug",
        freeSlug.address,
        { client: { wallet: player1 } }
      );

      await freeSlugAsPlayer.write.mint();

      const ownerOf = await freeSlug.read.ownerOf([0n]);
      assert.equal(
        ownerOf.toLowerCase(),
        player1.account.address.toLowerCase()
      );
    });

    it("should reject second mint from same wallet", async function () {
      const { freeSlug, player1 } = await deployFixture();

      const freeSlugAsPlayer = await hre.viem.getContractAt(
        "FreeSlug",
        freeSlug.address,
        { client: { wallet: player1 } }
      );

      await freeSlugAsPlayer.write.mint();

      await assert.rejects(
        freeSlugAsPlayer.write.mint(),
        /Already minted/
      );
    });
  });

  describe("Upgrade Flow", function () {
    it("should burn Free Slug and mint Snail", async function () {
      const { freeSlug, snail, slugRush, player1 } = await deployFixture();

      const freeSlugAsPlayer = await hre.viem.getContractAt(
        "FreeSlug",
        freeSlug.address,
        { client: { wallet: player1 } }
      );
      await freeSlugAsPlayer.write.mint();
      await freeSlugAsPlayer.write.approve([slugRush.address, 0n]);

      const slugRushAsPlayer = await hre.viem.getContractAt(
        "SlugRush",
        slugRush.address,
        { client: { wallet: player1 } }
      );

      await slugRushAsPlayer.write.upgrade([
        0n,  // freeSlugId
        0,   // rarity (Common)
        12,  // spd
        11,  // acc
        10,  // sta
        11,  // agi
        10,  // ref
        12,  // lck
      ]);

      const snailOwner = await snail.read.ownerOf([0n]);
      assert.equal(
        snailOwner.toLowerCase(),
        player1.account.address.toLowerCase()
      );

      const stats = await snail.read.getStats([0n]);
      assert.equal(stats[1], 12); // spd
      assert.equal(stats[0], 0);  // rarity = Common
    });
  });

  describe("Race Result Recording", function () {
    it("should record and retrieve race results", async function () {
      const { slugRush, player1 } = await deployFixture();

      const raceId =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;
      const resultHash =
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`;

      await slugRush.write.recordRaceResult([
        raceId,
        resultHash,
        player1.account.address,
      ]);

      const result = await slugRush.read.getRaceResult([raceId]);
      assert.equal(result[0], resultHash);
      assert.equal(
        result[1].toLowerCase(),
        player1.account.address.toLowerCase()
      );
    });
  });
});
