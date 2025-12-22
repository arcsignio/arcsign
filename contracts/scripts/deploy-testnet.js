/**
 * BSC Testnet Deployment Script
 *
 * Deploys ArcSignPro NFT contract using official BSC Testnet USDT
 *
 * Usage:
 * 1. Get testnet BNB from https://www.bnbchain.org/en/testnet-faucet
 * 2. Get testnet USDT from the same faucet
 * 3. Run: npx hardhat run scripts/deploy-testnet.js --network bscTestnet
 */

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("==========================================");
  console.log("BSC Testnet Deployment");
  console.log("==========================================");
  console.log("Deployer:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "tBNB");

  if (balance < hre.ethers.parseEther("0.01")) {
    console.log("\n⚠️  WARNING: Low balance! Get testnet BNB from:");
    console.log("   https://www.bnbchain.org/en/testnet-faucet");
    return;
  }

  // BSC Testnet USDT (official from faucet)
  const TESTNET_USDT = "0x7ef95a0fee0dd31b22626fa2e10ee6a223f8a684";

  // Treasury address - your provided address
  const treasuryAddress = "0x2e26cbd533ac3e98d3b650c7f89406ebb6f2f634";

  console.log("\nDeployment Configuration:");
  console.log("  USDT Address:", TESTNET_USDT);
  console.log("  Treasury:", treasuryAddress);

  // Deploy ArcSignPro
  console.log("\n--- Deploying ArcSignPro ---");
  const ArcSignPro = await hre.ethers.getContractFactory("ArcSignPro");
  const arcSignPro = await ArcSignPro.deploy(TESTNET_USDT, treasuryAddress);
  await arcSignPro.waitForDeployment();
  const arcSignProAddress = await arcSignPro.getAddress();
  console.log("✅ ArcSignPro deployed to:", arcSignProAddress);

  // Wait for confirmations
  console.log("\nWaiting for confirmations...");
  await arcSignPro.deploymentTransaction().wait(3);

  // Print summary
  console.log("\n==========================================");
  console.log("Deployment Summary");
  console.log("==========================================");
  console.log("Network: BSC Testnet (Chain ID: 97)");
  console.log("");
  console.log("ArcSignPro:", arcSignProAddress);
  console.log("USDT:", TESTNET_USDT);
  console.log("Treasury:", treasuryAddress);
  console.log("Price: 30 USDT");
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
    arcSignProAddress,
    usdtAddress: TESTNET_USDT,
    treasuryAddress,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address
  };

  if (!fs.existsSync("deployments")) {
    fs.mkdirSync("deployments");
  }

  fs.writeFileSync(
    "deployments/bscTestnet.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n📁 Saved to deployments/bscTestnet.json");

  // Next steps
  console.log("\n📝 Next Steps:");
  console.log("1. Get testnet USDT from: https://www.bnbchain.org/en/testnet-faucet");
  console.log("2. Approve USDT spending on the contract");
  console.log("3. Call mint() to test");
  console.log("");
  console.log("Update configs with contract address:", arcSignProAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
