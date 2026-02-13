/**
 * Set Base URI for ArcSign Pro NFT Metadata
 *
 * This script calls setBaseURI() on the deployed ArcSignPro contract
 * to configure the NFT metadata endpoint.
 *
 * Usage:
 *   npx hardhat run scripts/set-base-uri.js --network bsc
 *   npx hardhat run scripts/set-base-uri.js --network bscTestnet
 *
 * The default base URI points to arcsign.io landing page:
 *   https://arcsign.io/nft/metadata/
 *
 * To override, set BASE_URI in .env:
 *   BASE_URI=https://arcsign.io/nft/metadata/
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Contract ABI (only the functions we need)
const ABI = [
  "function setBaseURI(string calldata baseURI) external",
  "function owner() view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function name() view returns (string)",
];

// Deployment addresses
const DEPLOYMENTS = {
  bsc: {
    address: "0x02EA7B4870Aa0553EF357Af6475727f1E01c7b2F",
    name: "BSC Mainnet",
  },
  bscTestnet: {
    address: "0x401b0D7D9Ae46fDF75d92d8F218b1F15Dd2DFEc1",
    name: "BSC Testnet (USDT)",
    contractName: "ArcSignPro",
  },
  "bscTestnet-bnb": {
    address: "0x600dD7eFB4f0dd64B38FEf3d9C8cf660BF6bFa23",
    name: "BSC Testnet (BNB)",
    contractName: "ArcSignProTestnet",
  },
};

async function main() {
  const network = hre.network.name;
  const [signer] = await hre.ethers.getSigners();

  console.log("=== ArcSign Pro: Set Base URI ===\n");
  console.log("Network:", network);
  console.log("Signer:", signer.address);

  // Determine contract address
  let deployment = DEPLOYMENTS[network];

  if (!deployment) {
    // Try loading from deployments file
    const deployFile = path.join(__dirname, "..", "deployments", `${network}.json`);
    if (fs.existsSync(deployFile)) {
      const data = JSON.parse(fs.readFileSync(deployFile, "utf8"));
      deployment = {
        address: data.contractAddress || data.arcSignProAddress,
        name: network,
      };
    } else {
      throw new Error(`No deployment found for network: ${network}`);
    }
  }

  console.log("Contract:", deployment.address);
  console.log("Name:", deployment.name);

  // Determine base URI — default to arcsign.io landing page
  const DEFAULT_BASE_URI = "https://arcsign.io/nft/metadata/";
  let baseURI = process.env.BASE_URI || DEFAULT_BASE_URI;
  console.log(baseURI === DEFAULT_BASE_URI ? "\nUsing default base URI (arcsign.io)" : "\nUsing custom BASE_URI from .env");

  console.log("Base URI:", baseURI);

  // Connect to contract
  const contract = new hre.ethers.Contract(deployment.address, ABI, signer);

  // Verify ownership
  const owner = await contract.owner();
  console.log("\nContract owner:", owner);

  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(
      `Signer ${signer.address} is not the contract owner ${owner}. Only the owner can set the base URI.`
    );
  }

  // Check current state
  const totalSupply = await contract.totalSupply();
  console.log("Total minted:", totalSupply.toString());

  // Set the base URI
  console.log("\nSetting base URI...");
  const tx = await contract.setBaseURI(baseURI);
  console.log("Transaction hash:", tx.hash);

  console.log("Waiting for confirmation...");
  const receipt = await tx.wait(2);
  console.log("Confirmed in block:", receipt.blockNumber);

  // Verify the change (if there are minted tokens)
  if (totalSupply > 0n) {
    console.log("\nVerifying tokenURI for token #1...");
    const tokenURI = await contract.tokenURI(1);
    console.log("Token #1 URI:", tokenURI);
  }

  // Summary
  console.log("\n========================================");
  console.log("  Base URI Updated Successfully!");
  console.log("========================================");
  console.log(`Network:    ${deployment.name}`);
  console.log(`Contract:   ${deployment.address}`);
  console.log(`Base URI:   ${baseURI}`);
  console.log(`Tx Hash:    ${tx.hash}`);
  console.log("========================================");

  if (baseURI.startsWith("ipfs://")) {
    const cid = baseURI.replace("ipfs://", "").replace("/", "");
    console.log(`\nView on IPFS gateway:`);
    console.log(`  https://gateway.pinata.cloud/ipfs/${cid}/1`);
    console.log(`  https://ipfs.io/ipfs/${cid}/1`);
  } else if (baseURI.startsWith("https://")) {
    console.log(`\nView metadata:`);
    console.log(`  ${baseURI}1`);
  }

  // Save the update record
  const updateLog = {
    network,
    contractAddress: deployment.address,
    baseURI,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    updatedAt: new Date().toISOString(),
    signer: signer.address,
  };

  const logDir = path.join(__dirname, "..", "metadata");
  const logPath = path.join(logDir, `baseuri-update-${network}.json`);
  fs.writeFileSync(logPath, JSON.stringify(updateLog, null, 2));
  console.log(`\nUpdate log saved to: ${logPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nError:", error.message || error);
    process.exit(1);
  });
