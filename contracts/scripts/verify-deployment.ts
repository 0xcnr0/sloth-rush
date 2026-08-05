/**
 * Read back a deployment and check it is wired correctly.
 *
 * `deploy.ts` prints addresses and reports success, but it reports success for
 * the transaction being mined — not for the contracts pointing at each other.
 * A half-wired deployment looks identical in the log and fails later, at mint
 * or upgrade time. This reads the links back over JSON-RPC and says so.
 *
 *   FREE_RACER_ADDRESS=0x... RACER_ADDRESS=0x... RACE_CORE_ADDRESS=0x... \
 *     npx hardhat run scripts/verify-deployment.ts --network localhost
 *
 * Swap the network for baseSepolia to check a real deploy the same way.
 * (Hardhat 3's `run` task rejects trailing positional arguments, so the
 * addresses come through the environment rather than argv.)
 */

import hre from "hardhat";

const ADDRESS_ABI = (name: string) =>
  [
    {
      inputs: [],
      name,
      outputs: [{ name: "", type: "address" }],
      stateMutability: "view",
      type: "function",
    },
  ] as const;

function readAddresses(): { freeRacer: string; racer: string; raceCore: string } {
  const freeRacer = process.env.FREE_RACER_ADDRESS;
  const racer = process.env.RACER_ADDRESS;
  const raceCore = process.env.RACE_CORE_ADDRESS;

  if (!freeRacer || !racer || !raceCore) {
    throw new Error(
      "Set FREE_RACER_ADDRESS, RACER_ADDRESS and RACE_CORE_ADDRESS to the three " +
        "addresses printed by deploy.ts."
    );
  }
  return { freeRacer, racer, raceCore };
}

async function main() {
  const { freeRacer, racer, raceCore } = readAddresses();
  const connection = await hre.network.connect();
  const { viem } = connection;
  const client = await viem.getPublicClient();

  console.log(`Verifying deployment on ${connection.networkName}\n`);

  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  let failures = 0;

  // Every contract must actually exist. An address with no code is the usual
  // shape of "deployed to the wrong network".
  for (const [label, address] of Object.entries({ freeRacer, racer, raceCore })) {
    const code = await client.getCode({ address: address as `0x${string}` });
    const size = code && code !== "0x" ? (code.length - 2) / 2 : 0;
    if (size === 0) failures++;
    console.log(`  ${size > 0 ? "OK  " : "FAIL"} ${label.padEnd(12)} ${address}  ${size} bytes`);
  }

  console.log();

  const links: [string, string, string, string][] = [
    ["FreeRacer.upgradeContract", freeRacer, "upgradeContract", raceCore],
    ["Racer.minter", racer, "minter", raceCore],
    ["RaceCore.freeRacer", raceCore, "freeRacer", freeRacer],
    ["RaceCore.racer", raceCore, "racer", racer],
  ];

  for (const [label, address, fn, expected] of links) {
    let actual = "<call reverted>";
    try {
      actual = (await client.readContract({
        address: address as `0x${string}`,
        abi: ADDRESS_ABI(fn),
        functionName: fn,
      })) as string;
    } catch {
      /* leave the reverted marker */
    }
    const ok = eq(actual, expected);
    if (!ok) failures++;
    console.log(`  ${ok ? "OK  " : "FAIL"} ${label.padEnd(26)} -> ${actual}`);
    if (!ok) console.log(`       expected ${expected}`);
  }

  console.log();
  if (failures > 0) {
    console.error(`${failures} check(s) failed — the deployment is not usable as-is.`);
    process.exit(1);
  }
  console.log("All checks passed. Contracts are deployed and wired to each other.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
