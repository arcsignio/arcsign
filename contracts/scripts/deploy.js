const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Get configuration from environment
  const usdtAddress = process.env.USDT_ADDRESS;
  const treasuryAddress = process.env.TREASURY_ADDRESS;

  if (!usdtAddress || !treasuryAddress) {
    throw new Error("Please set USDT_ADDRESS and TREASURY_ADDRESS in .env file");
  }

  console.log("\nDeployment parameters:");
  console.log("  USDT Address:", usdtAddress);
  console.log("  Treasury Address:", treasuryAddress);

  // Deploy ArcSignPro
  console.log("\nDeploying ArcSignPro...");
  const ArcSignPro = await hre.ethers.getContractFactory("ArcSignPro");
  const arcSignPro = await ArcSignPro.deploy(usdtAddress, treasuryAddress);

  await arcSignPro.waitForDeployment();

  const contractAddress = await arcSignPro.getAddress();
  console.log("ArcSignPro deployed to:", contractAddress);

  // Wait for a few block confirmations
  console.log("\nWaiting for block confirmations...");
  await arcSignPro.deploymentTransaction().wait(5);

  // Verify contract on BSCScan
  console.log("\nVerifying contract on BSCScan...");
  try {
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [usdtAddress, treasuryAddress],
    });
    console.log("Contract verified successfully!");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("Contract is already verified!");
    } else {
      console.log("Verification failed:", error.message);
      console.log("You can verify manually with:");
      console.log(`npx hardhat verify --network bsc ${contractAddress} ${usdtAddress} ${treasuryAddress}`);
    }
  }

  // Print summary
  console.log("\n========================================");
  console.log("Deployment Summary");
  console.log("========================================");
  console.log("Network:", hre.network.name);
  console.log("Contract Address:", contractAddress);
  console.log("USDT Address:", usdtAddress);
  console.log("Treasury Address:", treasuryAddress);
  console.log("Price: 30 USDT");
  console.log("Duration: 365 days");
  console.log("========================================");

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress,
    usdtAddress,
    treasuryAddress,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address
  };

  fs.writeFileSync(
    `deployments/${hre.network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`\nDeployment info saved to deployments/${hre.network.name}.json`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
