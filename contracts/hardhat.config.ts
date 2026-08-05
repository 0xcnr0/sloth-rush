import { defineConfig, configVariable } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";

export default defineConfig({
  plugins: [hardhatToolboxViem],
  solidity: "0.8.28",
  paths: {
    tests: {
      nodejs: "./test",
    },
  },
  networks: {
    // Rehearsal target for `scripts/deploy.ts`. Points at `hardhat node`, so a
    // deploy runs over real JSON-RPC exactly as it will against Base Sepolia —
    // the in-process simulated network skips that layer and hides its failures.
    // Accounts come from the node's own funded dev keys.
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
    },
    baseSepolia: {
      type: "http",
      url: "https://sepolia.base.org",
      accounts: [configVariable("DEPLOYER_PRIVATE_KEY")],
    },
  },
});
