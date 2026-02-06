/**
 * Developer Mode Blockchain Test Script
 *
 * Tests the complete flow of Developer Mode with actual blockchain interaction:
 * 1. ETH Transfer - Sends a small amount of ETH to self
 * 2. personal_sign - Signs a message (EIP-191)
 * 3. signTypedData_v4 - Signs typed data (EIP-712)
 *
 * Prerequisites:
 *   1. Dashboard running with Developer Mode enabled
 *   2. Wallet selected in Developer Mode page
 *   3. Account has some Sepolia ETH (get from faucet: https://sepoliafaucet.com)
 *
 * Usage:
 *   cd contracts
 *   npx hardhat run scripts/test-dev-mode.js --network sepolia
 *
 * Created: 2026-02-06
 */

const { ethers } = require("hardhat");

// Test configuration
const TEST_VALUE = ethers.parseEther("0.0001"); // 0.0001 ETH
const RECIPIENT = null; // Will use signer's own address if null

async function main() {
  console.log("");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     ArcSign Developer Mode - Blockchain Test               ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");

  // Get signer from ArcSign plugin
  const [signer] = await ethers.getSigners();
  const address = await signer.getAddress();

  console.log("🔑 Signer address:", address);

  // Check balance
  const balance = await ethers.provider.getBalance(address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH");
  console.log("");

  if (balance < TEST_VALUE) {
    console.log("⚠️  Insufficient balance for testing.");
    console.log("   Get Sepolia ETH from: https://sepoliafaucet.com");
    process.exit(1);
  }

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("🌐 Network:", network.name, "(Chain ID:", network.chainId.toString(), ")");
  console.log("");

  const results = {};

  // ============================================================================
  // Test 1: ETH Transfer (actual blockchain transaction)
  // ============================================================================
  console.log("═".repeat(60));
  console.log("📝 Test 1: ETH Transfer (on-chain)");
  console.log("═".repeat(60));

  const recipient = RECIPIENT || address; // Send to self if no recipient
  console.log("   From:", address);
  console.log("   To:", recipient);
  console.log("   Amount:", ethers.formatEther(TEST_VALUE), "ETH");
  console.log("");
  console.log("⏳ Approve in Dashboard UI (enter password and click Approve)...");
  console.log("");

  try {
    const tx = await signer.sendTransaction({
      to: recipient,
      value: TEST_VALUE,
    });

    console.log("✓ Transaction sent!");
    console.log("   TX Hash:", tx.hash);
    console.log("");
    console.log("⏳ Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("✓ Transaction confirmed!");
    console.log("   Block:", receipt.blockNumber);
    console.log("   Gas Used:", receipt.gasUsed.toString());
    console.log("   Status:", receipt.status === 1 ? "Success" : "Failed");
    console.log("");

    results.eth_transfer = true;
  } catch (error) {
    console.log("✗ ETH Transfer failed:", error.message);
    results.eth_transfer = false;
  }

  // ============================================================================
  // Test 2: personal_sign (EIP-191)
  // ============================================================================
  console.log("═".repeat(60));
  console.log("📝 Test 2: personal_sign (EIP-191)");
  console.log("═".repeat(60));

  const message = "Hello from ArcSign Hardhat Test!";
  console.log("   Message:", message);
  console.log("");
  console.log("⏳ Approve in Dashboard UI...");
  console.log("");

  try {
    const signature = await signer.signMessage(message);

    console.log("✓ Message signed!");
    console.log("   Signature:", signature);
    console.log("");

    // Verify the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    const isValid = recoveredAddress.toLowerCase() === address.toLowerCase();
    console.log("   Verification:", isValid ? "✓ Valid" : "✗ Invalid");
    console.log("   Recovered address:", recoveredAddress);
    console.log("");

    results.personal_sign = isValid;
  } catch (error) {
    console.log("✗ personal_sign failed:", error.message);
    results.personal_sign = false;
  }

  // ============================================================================
  // Test 3: signTypedData_v4 (EIP-712)
  // ============================================================================
  console.log("═".repeat(60));
  console.log("📝 Test 3: signTypedData_v4 (EIP-712)");
  console.log("═".repeat(60));

  const domain = {
    name: "ArcSign Test",
    version: "1",
    chainId: Number(network.chainId),  // Convert BigInt to Number for JSON serialization
    verifyingContract: "0x0000000000000000000000000000000000000001", // Dummy address
  };

  const types = {
    Message: [
      { name: "content", type: "string" },
      { name: "timestamp", type: "uint256" },
    ],
  };

  const value = {
    content: "Hello EIP-712!",
    timestamp: Math.floor(Date.now() / 1000),
  };

  console.log("   Domain:", domain.name);
  console.log("   Primary Type: Message");
  console.log("   Content:", value.content);
  console.log("");
  console.log("⏳ Approve in Dashboard UI...");
  console.log("");

  try {
    const signature = await signer.signTypedData(domain, types, value);

    console.log("✓ Typed data signed!");
    console.log("   Signature:", signature);
    console.log("");

    // Verify the signature
    const recoveredAddress = ethers.verifyTypedData(domain, types, value, signature);
    const isValid = recoveredAddress.toLowerCase() === address.toLowerCase();
    console.log("   Verification:", isValid ? "✓ Valid" : "✗ Invalid");
    console.log("   Recovered address:", recoveredAddress);
    console.log("");

    results.sign_typed_data = isValid;
  } catch (error) {
    console.log("✗ signTypedData failed:", error.message);
    results.sign_typed_data = false;
  }

  // ============================================================================
  // Summary
  // ============================================================================
  console.log("═".repeat(60));
  console.log("Test Results Summary");
  console.log("═".repeat(60));

  let passed = 0;
  let failed = 0;

  for (const [name, success] of Object.entries(results)) {
    const icon = success ? "✓" : "✗";
    const status = success ? "PASSED" : "FAILED";
    console.log(`${icon} ${name.padEnd(25)} ${status}`);
    if (success) passed++;
    else failed++;
  }

  console.log("─".repeat(60));
  console.log(`Total: ${passed} passed, ${failed} failed`);
  console.log("");

  // Final balance check
  const finalBalance = await ethers.provider.getBalance(address);
  const spent = balance - finalBalance;
  console.log("💰 Final Balance:", ethers.formatEther(finalBalance), "ETH");
  console.log("💸 Total Spent:", ethers.formatEther(spent), "ETH (including gas)");
  console.log("");

  if (failed > 0) {
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
