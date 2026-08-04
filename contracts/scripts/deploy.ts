import hre from "hardhat";

async function main() {
  const connection = await hre.network.connect();
  const { viem } = connection;

  console.log("Deploying contracts to", connection.networkName);

  // Deploy FreeRacer
  const freeRacer = await viem.deployContract("FreeRacer");
  console.log("FreeRacer deployed to:", freeRacer.address);

  // Deploy Racer
  const racer = await viem.deployContract("Racer");
  console.log("Racer deployed to:", racer.address);

  // Deploy RaceCore (main game contract)
  const raceCore = await viem.deployContract("RaceCore", [
    freeRacer.address,
    racer.address,
  ]);
  console.log("RaceCore deployed to:", raceCore.address);

  // Set permissions
  await freeRacer.write.setUpgradeContract([raceCore.address]);
  console.log("FreeRacer.upgradeContract set to RaceCore");

  await racer.write.setMinter([raceCore.address]);
  console.log("Racer.minter set to RaceCore");

  console.log("\n--- Deployment Complete ---");
  console.log("FreeRacer:", freeRacer.address);
  console.log("Racer:    ", racer.address);
  console.log("RaceCore:", raceCore.address);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
