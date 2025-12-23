/**
 * BSC Testnet Deployment Script - BNB Version
 *
 * Deploys ArcSignProTestnet NFT contract that accepts BNB for easy testing
 *
 * Usage:
 * 1. Get testnet BNB from https://www.bnbchain.org/en/testnet-faucet
 * 2. Run: npx hardhat run scripts/deploy-testnet-bnb.js --network bscTestnet
 * 3. Mint: Send 0.001 tBNB to the mint() function
 */

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("==========================================");
  console.log("BSC Testnet Deployment (BNB Payment)");
  console.log("==========================================");
  console.log("Deployer:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "tBNB");

  if (balance < hre.ethers.parseEther("0.01")) {
    console.log("\n⚠️  WARNING: Low balance! Get testnet BNB from:");
    console.log("   https://www.bnbchain.org/en/testnet-faucet");
    return;
  }

  // Treasury address - your provided address
  const treasuryAddress = "0x2e26cbd533ac3e98d3b650c7f89406ebb6f2f634";

  console.log("\nDeployment Configuration:");
  console.log("  Payment: BNB (native token)");
  console.log("  Price: 0.001 tBNB");
  console.log("  Treasury:", treasuryAddress);

  // Deploy ArcSignProTestnet
  console.log("\n--- Deploying ArcSignProTestnet ---");
  const ArcSignProTestnet = await hre.ethers.getContractFactory("ArcSignProTestnet");
  const arcSignPro = await ArcSignProTestnet.deploy(treasuryAddress);
  await arcSignPro.waitForDeployment();
  const arcSignProAddress = await arcSignPro.getAddress();
  console.log("✅ ArcSignProTestnet deployed to:", arcSignProAddress);

  // Wait for confirmations
  console.log("\nWaiting for confirmations...");
  await arcSignPro.deploymentTransaction().wait(3);

  // Print summary
  console.log("\n==========================================");
  console.log("Deployment Summary");
  console.log("==========================================");
  console.log("Network: BSC Testnet (Chain ID: 97)");
  console.log("");
  console.log("ArcSignProTestnet:", arcSignProAddress);
  console.log("Treasury:", treasuryAddress);
  console.log("Price: 0.001 tBNB");
  console.log("Duration: 365 days");
  console.log("");
  console.log("Block Explorer:");
  console.log(`  https://testnet.bscscan.com/address/${arcSignProAddress}`);
  console.log("==========================================");

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: "bscTestnet",
    chainId: 97,
    contractType: "ArcSignProTestnet",
    arcSignProAddress,
    paymentToken: "BNB (native)",
    price: "0.001 tBNB",
    treasuryAddress,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address
  };

  if (!fs.existsSync("deployments")) {
    fs.mkdirSync("deployments");
  }

  fs.writeFileSync(
    "deployments/bscTestnet-bnb.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n📁 Saved to deployments/bscTestnet-bnb.json");

  // Test instructions
  console.log("\n📝 Test Instructions:");
  console.log("1. Go to BSCScan and connect your wallet");
  console.log(`   https://testnet.bscscan.com/address/${arcSignProAddress}#writeContract`);
  console.log("2. Click 'Write Contract' > 'Connect to Web3'");
  console.log("3. Find 'mint' function");
  console.log("4. Enter '0.001' in the 'payableAmount (ether)' field");
  console.log("5. Click 'Write' and confirm transaction");
  console.log("");
  console.log("Or use ethers.js:");
  console.log(`  const contract = new ethers.Contract("${arcSignProAddress}", abi, signer);`);
  console.log(`  await contract.mint({ value: ethers.parseEther("0.001") });`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
