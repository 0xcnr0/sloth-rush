import hre from "hardhat";

async function main() {
  console.log("Deploying Slug Rush contracts to", hre.network.name);

  // Deploy FreeSlug
  const freeSlug = await hre.viem.deployContract("FreeSlug");
  console.log("FreeSlug deployed to:", freeSlug.address);

  // Deploy Snail
  const snail = await hre.viem.deployContract("Snail");
  console.log("Snail deployed to:", snail.address);

  // Deploy SlugRush (main game contract)
  const slugRush = await hre.viem.deployContract("SlugRush", [
    freeSlug.address,
    snail.address,
  ]);
  console.log("SlugRush deployed to:", slugRush.address);

  // Set permissions
  await freeSlug.write.setUpgradeContract([slugRush.address]);
  console.log("FreeSlug.upgradeContract set to SlugRush");

  await snail.write.setMinter([slugRush.address]);
  console.log("Snail.minter set to SlugRush");

  console.log("\n--- Deployment Complete ---");
  console.log("FreeSlug:", freeSlug.address);
  console.log("Snail:   ", snail.address);
  console.log("SlugRush:", slugRush.address);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
