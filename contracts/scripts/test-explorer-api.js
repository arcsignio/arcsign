/**
 * Test Explorer API Key Feature via Hardhat Plugin
 *
 * Tests that the Hardhat plugin can correctly fetch explorer API keys
 * from the ArcSign Dashboard.
 *
 * Usage:
 *   cd contracts
 *   npx hardhat run scripts/test-explorer-api.js --network sepolia
 */

async function main() {
  const hre = require("hardhat");

  console.log("");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     ArcSign Hardhat Plugin - Explorer API Key Test         ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");

  // Test explorers to check
  const explorers = [
    "etherscan",
    "bscscan",
    "polygonscan",
    "arbiscan",
    "optimism",
    "basescan",
    "snowtrace"
  ];

  console.log("Testing hre.arcsign.getExplorerApiKey()...\n");

  const results = {};

  for (const explorer of explorers) {
    process.stdout.write(`  ${explorer.padEnd(15)}: `);

    try {
      const apiKey = await hre.arcsign.getExplorerApiKey(explorer);

      if (apiKey) {
        // Mask the API key for security (show first 4 and last 4 chars)
        const masked = apiKey.length > 8
          ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
          : "****";
        console.log(`\x1b[32m✓\x1b[0m Found (${masked})`);
        results[explorer] = true;
      } else {
        console.log(`\x1b[33m-\x1b[0m Not configured`);
        results[explorer] = null; // Not configured (not an error)
      }
    } catch (err) {
      console.log(`\x1b[31m✗\x1b[0m Error: ${err.message}`);
      results[explorer] = false;
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log("Summary:");
  console.log("═".repeat(60));

  const found = Object.values(results).filter(v => v === true).length;
  const notConfigured = Object.values(results).filter(v => v === null).length;
  const errors = Object.values(results).filter(v => v === false).length;

  console.log(`  Found:          ${found}`);
  console.log(`  Not configured: ${notConfigured}`);
  console.log(`  Errors:         ${errors}`);
  console.log("");

  if (errors > 0) {
    console.log("\x1b[31m✗ Some API key fetches failed\x1b[0m");
    console.log("  Make sure Dashboard is running with Developer Mode enabled");
    process.exit(1);
  } else if (found > 0) {
    console.log("\x1b[32m✓ Explorer API key feature is working!\x1b[0m");
  } else {
    console.log("\x1b[33m! No API keys configured yet\x1b[0m");
    console.log("  Configure them in Dashboard > Developer Mode > Settings");
  }

  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
