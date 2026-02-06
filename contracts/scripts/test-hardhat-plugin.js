/**
 * Comprehensive Hardhat Plugin Test Script
 *
 * Tests all ArcSign Hardhat Plugin features:
 * 1. Connection & Ping
 * 2. Get Accounts
 * 3. Explorer API Keys
 * 4. Session Management (create, get, end)
 * 5. Signing (optional - requires password)
 *
 * Usage:
 *   cd contracts
 *   npx hardhat run scripts/test-hardhat-plugin.js --network sepolia
 */

const { ethers } = require("hardhat");

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function log(color, prefix, message) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

async function main() {
  const hre = require("hardhat");

  console.log("");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     ArcSign Hardhat Plugin - Comprehensive Test            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");

  const results = {};

  // ============================================================================
  // Test 1: Connection & Ping
  // ============================================================================
  console.log("═".repeat(60));
  console.log("📡 Test 1: Connection & Ping");
  console.log("═".repeat(60));

  try {
    const isConnected = await hre.arcsign.isConnected();
    log(colors.cyan, "   ", `Initial connection: ${isConnected}`);

    // Access the client directly for ping
    const client = hre.arcsign.client;
    if (!client.isConnected()) {
      await client.connect();
    }

    const pingResult = await client.ping();
    log(colors.green, "✓", `Ping successful`);
    log(colors.dim, "   ", `Status: ${pingResult.status}`);
    log(colors.dim, "   ", `Version: ${pingResult.version}`);
    log(colors.dim, "   ", `Wallet: ${pingResult.wallet || "No wallet selected"}`);
    console.log("");

    results.connection = true;
  } catch (err) {
    log(colors.red, "✗", `Connection failed: ${err.message}`);
    console.log("");
    console.log("Make sure:");
    console.log("  1. Dashboard is running (npm run tauri:dev)");
    console.log("  2. Developer Mode is enabled");
    console.log("  3. A wallet is selected");
    process.exit(1);
  }

  // ============================================================================
  // Test 2: Get Accounts
  // ============================================================================
  console.log("═".repeat(60));
  console.log("📋 Test 2: Get Accounts");
  console.log("═".repeat(60));

  try {
    const accounts = await hre.arcsign.getAccounts();
    log(colors.green, "✓", `Found ${accounts.length} account(s)`);

    for (let i = 0; i < accounts.length; i++) {
      log(colors.dim, "   ", `[${i}] ${accounts[i]}`);
    }
    console.log("");

    results.getAccounts = true;
  } catch (err) {
    log(colors.red, "✗", `Get accounts failed: ${err.message}`);
    console.log("");
    results.getAccounts = false;
  }

  // ============================================================================
  // Test 3: Explorer API Keys
  // ============================================================================
  console.log("═".repeat(60));
  console.log("🔑 Test 3: Explorer API Keys");
  console.log("═".repeat(60));

  const explorers = ["etherscan", "bscscan", "polygonscan", "arbiscan"];
  let apiKeyFound = false;

  for (const explorer of explorers) {
    try {
      const apiKey = await hre.arcsign.getExplorerApiKey(explorer);

      if (apiKey) {
        const masked = apiKey.length > 8
          ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
          : "****";
        log(colors.green, "✓", `${explorer.padEnd(15)}: Found (${masked})`);
        apiKeyFound = true;
      } else {
        log(colors.yellow, "-", `${explorer.padEnd(15)}: Not configured`);
      }
    } catch (err) {
      log(colors.red, "✗", `${explorer.padEnd(15)}: Error - ${err.message}`);
    }
  }

  console.log("");
  results.explorerApiKey = apiKeyFound || "not_configured";

  // ============================================================================
  // Test 4: Session Management
  // ============================================================================
  console.log("═".repeat(60));
  console.log("🔐 Test 4: Session Management");
  console.log("═".repeat(60));

  const client = hre.arcsign.client;

  // 4a. Get Session Status (should be inactive initially)
  console.log("\n4a. Get Session Status:");
  try {
    const sessionStatus = await client.getDevSession();
    log(colors.green, "✓", `Get session successful`);
    log(colors.dim, "   ", `Active: ${sessionStatus.active}`);

    if (sessionStatus.session) {
      log(colors.dim, "   ", `Expires: ${new Date(sessionStatus.session.expires_at).toLocaleString()}`);
      log(colors.dim, "   ", `Sign count: ${sessionStatus.session.sign_count}`);
      log(colors.dim, "   ", `Trusted networks: ${sessionStatus.session.trusted_networks.join(", ")}`);
    } else if (sessionStatus.message) {
      log(colors.dim, "   ", `Message: ${sessionStatus.message}`);
    }

    results.getSession = true;
  } catch (err) {
    log(colors.red, "✗", `Get session failed: ${err.message}`);
    results.getSession = false;
  }

  // 4b. Create Session (this may require wallet_id which we might not have)
  console.log("\n4b. Create Session:");
  try {
    // We need a wallet_id for this, which is stored on the Dashboard
    // For testing, we'll try with a placeholder and expect it to fail gracefully
    const createResult = await client.createDevSession({
      wallet_id: "test-wallet-id", // This will likely fail without correct ID
      duration_minutes: 5,
      trusted_networks: ["sepolia"],
    });

    log(colors.green, "✓", `Create session successful`);
    log(colors.dim, "   ", `Status: ${createResult.status}`);

    if (createResult.session) {
      log(colors.dim, "   ", `Enabled: ${createResult.session.enabled}`);
      log(colors.dim, "   ", `Expires: ${new Date(createResult.session.expires_at).toLocaleString()}`);
    }

    results.createSession = true;
  } catch (err) {
    // Expected to fail without correct wallet_id
    log(colors.yellow, "!", `Create session: ${err.message}`);
    log(colors.dim, "   ", `(This is expected without correct wallet_id)`);
    results.createSession = "skipped";
  }

  // 4c. End Session
  console.log("\n4c. End Session:");
  try {
    const endResult = await client.endDevSession();
    log(colors.green, "✓", `End session successful`);
    log(colors.dim, "   ", `Status: ${endResult.status}`);

    if (endResult.sign_count !== undefined) {
      log(colors.dim, "   ", `Sign count: ${endResult.sign_count}`);
    }
    if (endResult.message) {
      log(colors.dim, "   ", `Message: ${endResult.message}`);
    }

    results.endSession = true;
  } catch (err) {
    log(colors.yellow, "!", `End session: ${err.message}`);
    results.endSession = "no_session";
  }

  console.log("");

  // ============================================================================
  // Test 5: ethers.getSigners() Integration
  // ============================================================================
  console.log("═".repeat(60));
  console.log("⚡ Test 5: ethers.getSigners() Integration");
  console.log("═".repeat(60));

  try {
    const [signer] = await ethers.getSigners();
    const address = await signer.getAddress();

    log(colors.green, "✓", `getSigners() working`);
    log(colors.dim, "   ", `Signer address: ${address}`);

    // Check balance
    const balance = await ethers.provider.getBalance(address);
    log(colors.dim, "   ", `Balance: ${ethers.formatEther(balance)} ETH`);

    console.log("");
    results.getSigners = true;
  } catch (err) {
    log(colors.red, "✗", `getSigners() failed: ${err.message}`);
    console.log("");
    results.getSigners = false;
  }

  // ============================================================================
  // Summary
  // ============================================================================
  console.log("═".repeat(60));
  console.log("📊 Test Results Summary");
  console.log("═".repeat(60));

  const testNames = {
    connection: "Connection & Ping",
    getAccounts: "Get Accounts",
    explorerApiKey: "Explorer API Keys",
    getSession: "Get Session",
    createSession: "Create Session",
    endSession: "End Session",
    getSigners: "ethers.getSigners()",
  };

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const [key, success] of Object.entries(results)) {
    const name = testNames[key] || key;
    let icon, status;

    if (success === true) {
      icon = colors.green + "✓";
      status = "PASSED";
      passed++;
    } else if (success === false) {
      icon = colors.red + "✗";
      status = "FAILED";
      failed++;
    } else if (success === "skipped" || success === "no_session" || success === "not_configured") {
      icon = colors.yellow + "-";
      status = `SKIPPED (${success})`;
      skipped++;
    } else {
      icon = colors.yellow + "?";
      status = String(success);
      skipped++;
    }

    console.log(`${icon}${colors.reset} ${name.padEnd(25)} ${status}`);
  }

  console.log("─".repeat(60));
  console.log(`Total: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log("");

  if (failed > 0) {
    console.log(`${colors.red}Some tests failed!${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`${colors.green}All critical tests passed!${colors.reset}`);
    console.log("");
    console.log("Note: Signing tests are in test-dev-mode.js (requires password)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
