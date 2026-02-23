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

  // Use explicit gasPrice to force legacy tx (avoid EIP-1559 inflated maxFeePerGas)
  const networkGasPrice = (await hre.ethers.provider.getFeeData()).gasPrice;
  const gasPrice = BigInt(hre.network.config.gasPrice || networkGasPrice || 3000000000);
  console.log("\nUsing gasPrice:", hre.ethers.formatUnits(gasPrice, "gwei"), "gwei");

  // Deploy ArcSignPro
  console.log("\nDeploying ArcSignPro...");
  const ArcSignPro = await hre.ethers.getContractFactory("ArcSignPro");

  // Estimate deployment cost
  const deployTx = await ArcSignPro.getDeployTransaction(usdtAddress, treasuryAddress);
  const estimatedGas = await hre.ethers.provider.estimateGas({ ...deployTx, from: deployer.address });
  const estimatedCost = estimatedGas * gasPrice;
  console.log("Estimated gas:", estimatedGas.toString());
  console.log("Estimated cost:", hre.ethers.formatEther(estimatedCost), "BNB");

  const arcSignPro = await ArcSignPro.deploy(usdtAddress, treasuryAddress, {
    gasPrice,
  });

  await arcSignPro.waitForDeployment();

  const contractAddress = await arcSignPro.getAddress();
  console.log("ArcSignPro deployed to:", contractAddress);

  // Wait for a few block confirmations
  console.log("\nWaiting for block confirmations...");
  await arcSignPro.deploymentTransaction().wait(5);

  // Set base URI immediately to avoid empty metadata on platform indexers
  const baseURI = process.env.BASE_URI || "https://arcsign.io/nft/metadata/";
  console.log("\nSetting base URI:", baseURI);
  const setUriTx = await arcSignPro.setBaseURI(baseURI, { gasPrice });
  await setUriTx.wait(2);
  console.log("Base URI set successfully!");

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
    baseURI,
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
