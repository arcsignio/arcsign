const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying ArcSignReferral with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Use explicit gasPrice to force legacy tx (avoid EIP-1559 inflated maxFeePerGas)
  const networkGasPrice = (await hre.ethers.provider.getFeeData()).gasPrice;
  const gasPrice = BigInt(hre.network.config.gasPrice || networkGasPrice || 3000000000);
  console.log("\nUsing gasPrice:", hre.ethers.formatUnits(gasPrice, "gwei"), "gwei");

  // Deploy ArcSignReferral
  console.log("\nDeploying ArcSignReferral...");
  const ArcSignReferral = await hre.ethers.getContractFactory("ArcSignReferral");

  // Estimate deployment cost
  const deployTx = await ArcSignReferral.getDeployTransaction();
  const estimatedGas = await hre.ethers.provider.estimateGas({ ...deployTx, from: deployer.address });
  const estimatedCost = estimatedGas * gasPrice;
  console.log("Estimated gas:", estimatedGas.toString());
  console.log("Estimated cost:", hre.ethers.formatEther(estimatedCost), "BNB");

  const referral = await ArcSignReferral.deploy({
    gasPrice,
    gasLimit: 600000,  // Explicit gas limit
    type: 0,           // Force legacy transaction (avoid EIP-1559 issues)
  });
  await referral.waitForDeployment();

  const contractAddress = await referral.getAddress();
  console.log("ArcSignReferral deployed to:", contractAddress);

  // Wait for block confirmations
  console.log("\nWaiting for block confirmations...");
  await referral.deploymentTransaction().wait(5);

  // Verify contract on BSCScan
  console.log("\nVerifying contract on BSCScan...");
  try {
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [],
    });
    console.log("Contract verified successfully!");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("Contract is already verified!");
    } else {
      console.log("Verification failed:", error.message);
      console.log("You can verify manually with:");
      console.log(`npx hardhat verify --network bsc ${contractAddress}`);
    }
  }

  // Print summary
  console.log("\n========================================");
  console.log("Deployment Summary");
  console.log("========================================");
  console.log("Network:", hre.network.name);
  console.log("Contract Address:", contractAddress);
  console.log("Owner:", deployer.address);
  console.log("========================================");

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    contract: "ArcSignReferral",
    contractAddress,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  const deploymentsDir = "deployments";
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  fs.writeFileSync(
    `${deploymentsDir}/${hre.network.name}-referral.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`\nDeployment info saved to ${deploymentsDir}/${hre.network.name}-referral.json`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
