/**
 * Verify mint transaction payment
 * Usage: npx hardhat run scripts/verify-mint-tx.js --network bsc
 */
const hre = require("hardhat");

async function main() {
  const txHash = "0xa8e1b9b00be28601ffdeb27cd11293cdb0e477112617b7f7066de70f8ae45d6d";
  const treasuryAddress = "0x2e26cbD533Ac3E98d3B650c7f89406EbB6f2f634";
  const usdtAddress = "0x55d398326f99059fF775485246999027B3197955";

  console.log("Verifying mint transaction:", txHash);
  console.log("Treasury address:", treasuryAddress);
  console.log("");

  // Get transaction receipt
  const receipt = await hre.ethers.provider.getTransactionReceipt(txHash);

  if (!receipt) {
    console.log("Transaction not found");
    return;
  }

  console.log("Transaction status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
  console.log("Block number:", receipt.blockNumber);
  console.log("From:", receipt.from);
  console.log("To (contract):", receipt.to);
  console.log("");

  // Parse logs for USDT Transfer events
  // USDT Transfer event: Transfer(address indexed from, address indexed to, uint256 value)
  const transferEventSig = hre.ethers.id("Transfer(address,address,uint256)");

  console.log("=== Token Transfers in this transaction ===");
  let foundPayment = false;

  for (const log of receipt.logs) {
    if (log.topics[0] === transferEventSig && log.address.toLowerCase() === usdtAddress.toLowerCase()) {
      const from = "0x" + log.topics[1].slice(26);
      const to = "0x" + log.topics[2].slice(26);
      const value = BigInt(log.data);
      const valueFormatted = hre.ethers.formatUnits(value, 18);

      console.log("USDT Transfer:");
      console.log("  From:", from);
      console.log("  To:", to);
      console.log("  Amount:", valueFormatted, "USDT");

      if (to.toLowerCase() === treasuryAddress.toLowerCase()) {
        foundPayment = true;
        console.log("  ✅ VERIFIED: Payment sent to treasury!");
      }
      console.log("");
    }
  }

  // Check for MembershipMinted event
  const mintEventSig = hre.ethers.id("MembershipMinted(address,uint256,uint256)");

  for (const log of receipt.logs) {
    if (log.topics[0] === mintEventSig) {
      const owner = "0x" + log.topics[1].slice(26);
      const tokenId = BigInt(log.topics[2]);
      console.log("=== NFT Minted ===");
      console.log("  Owner:", owner);
      console.log("  Token ID:", tokenId.toString());
      console.log("");
    }
  }

  if (foundPayment) {
    console.log("✅ CONCLUSION: Mint payment was successfully sent to your treasury address!");
  } else {
    console.log("⚠️ No USDT payment to treasury found in this transaction");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
