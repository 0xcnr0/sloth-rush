import hre from "hardhat";

async function main() {
  const connection = await hre.network.connect();
  const { viem } = connection;

  console.log("Deploying Sloth Rush contracts to", connection.networkName);

  // Deploy FreeSloth
  const freeSloth = await viem.deployContract("FreeSloth");
  console.log("FreeSloth deployed to:", freeSloth.address);

  // Deploy Sloth
  const sloth = await viem.deployContract("Sloth");
  console.log("Sloth deployed to:", sloth.address);

  // Deploy SlothRush (main game contract)
  const slothRush = await viem.deployContract("SlothRush", [
    freeSloth.address,
    sloth.address,
  ]);
  console.log("SlothRush deployed to:", slothRush.address);

  // Set permissions
  await freeSloth.write.setUpgradeContract([slothRush.address]);
  console.log("FreeSloth.upgradeContract set to SlothRush");

  await sloth.write.setMinter([slothRush.address]);
  console.log("Sloth.minter set to SlothRush");

  console.log("\n--- Deployment Complete ---");
  console.log("FreeSloth:", freeSloth.address);
  console.log("Sloth:    ", sloth.address);
  console.log("SlothRush:", slothRush.address);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
