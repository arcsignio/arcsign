/**
 * Upload ArcSign Pro NFT metadata & image to IPFS via Pinata
 *
 * Prerequisites:
 *   npm install @pinata/sdk --save-dev
 *
 * Environment variables (.env):
 *   PINATA_API_KEY=your_api_key
 *   PINATA_SECRET_KEY=your_secret_key
 *
 * Usage:
 *   node scripts/upload-metadata.js
 *
 * This script:
 *   1. Uploads the NFT card image to IPFS
 *   2. Updates the metadata JSON with the IPFS image URI
 *   3. Uploads the metadata JSON to IPFS as a directory
 *      (each file named by potential token ID, all with same content)
 *   4. Outputs the baseURI to use with setBaseURI()
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config();

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;

// Paths
const METADATA_DIR = path.join(__dirname, "..", "metadata");
const IMAGE_PATH = path.join(METADATA_DIR, "arcsign-pro.png");
const METADATA_TEMPLATE = path.join(METADATA_DIR, "arcsign-pro-metadata.json");

async function uploadToPinata(filePath, name) {
  const FormData = (await import("form-data")).default;
  const fetch = (await import("node-fetch")).default;

  const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
  const data = new FormData();

  data.append("file", fs.createReadStream(filePath));
  data.append(
    "pinataMetadata",
    JSON.stringify({ name })
  );

  const res = await fetch(url, {
    method: "POST",
    headers: {
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_SECRET_KEY,
    },
    body: data,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Pinata upload failed: ${res.status} ${errText}`);
  }

  return await res.json();
}

async function uploadDirectoryToPinata(dirPath, name) {
  const FormData = (await import("form-data")).default;
  const fetch = (await import("node-fetch")).default;

  const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
  const data = new FormData();

  // Read all files in the directory
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isFile()) {
      data.append("file", fs.createReadStream(filePath), {
        filepath: `${name}/${file}`,
      });
    }
  }

  data.append(
    "pinataMetadata",
    JSON.stringify({ name })
  );

  const res = await fetch(url, {
    method: "POST",
    headers: {
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_SECRET_KEY,
    },
    body: data,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Pinata directory upload failed: ${res.status} ${errText}`);
  }

  return await res.json();
}

async function main() {
  // Validate env
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    console.error("Error: Set PINATA_API_KEY and PINATA_SECRET_KEY in .env");
    process.exit(1);
  }

  console.log("=== ArcSign Pro NFT Metadata Upload ===\n");

  // Step 1: Upload image to IPFS
  console.log("1. Uploading NFT card image to IPFS...");
  const imageResult = await uploadToPinata(IMAGE_PATH, "arcsign-pro-nft-image");
  const imageCID = imageResult.IpfsHash;
  const imageURI = `ipfs://${imageCID}`;
  console.log(`   Image CID: ${imageCID}`);
  console.log(`   Image URI: ${imageURI}`);
  console.log(`   Gateway:   https://gateway.pinata.cloud/ipfs/${imageCID}\n`);

  // Step 2: Update metadata with image URI
  console.log("2. Preparing metadata with image URI...");
  const metadata = JSON.parse(fs.readFileSync(METADATA_TEMPLATE, "utf8"));
  metadata.image = imageURI;

  // Step 3: Create a temporary directory with numbered metadata files
  // Since tokenURI = baseURI + tokenId, we need files named "1", "2", etc.
  // We'll pre-generate for tokens 1-1000
  const tempDir = path.join(METADATA_DIR, "ipfs-upload");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const MAX_TOKENS = 1000;
  console.log(`   Generating metadata for token IDs 1-${MAX_TOKENS}...`);

  for (let i = 1; i <= MAX_TOKENS; i++) {
    const tokenMetadata = {
      ...metadata,
      name: `ArcSign Pro Membership #${i}`,
    };
    fs.writeFileSync(
      path.join(tempDir, String(i)),
      JSON.stringify(tokenMetadata, null, 2)
    );
  }

  // Step 4: Upload metadata directory to IPFS
  console.log("3. Uploading metadata directory to IPFS...");
  const metadataResult = await uploadDirectoryToPinata(tempDir, "arcsign-pro-metadata");
  const metadataCID = metadataResult.IpfsHash;
  const baseURI = `ipfs://${metadataCID}/`;
  console.log(`   Metadata CID: ${metadataCID}`);
  console.log(`   Base URI:     ${baseURI}`);
  console.log(`   Gateway:      https://gateway.pinata.cloud/ipfs/${metadataCID}/1\n`);

  // Step 5: Save results
  const results = {
    imageCID,
    imageURI,
    imageGateway: `https://gateway.pinata.cloud/ipfs/${imageCID}`,
    metadataCID,
    baseURI,
    metadataGateway: `https://gateway.pinata.cloud/ipfs/${metadataCID}/`,
    uploadedAt: new Date().toISOString(),
    maxTokenId: MAX_TOKENS,
  };

  const resultsPath = path.join(METADATA_DIR, "ipfs-results.json");
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`Results saved to: ${resultsPath}`);

  // Cleanup temp directory
  console.log("Cleaning up temporary files...");
  fs.rmSync(tempDir, { recursive: true, force: true });

  // Summary
  console.log("\n========================================");
  console.log("  Upload Complete!");
  console.log("========================================");
  console.log(`Image URI:  ${imageURI}`);
  console.log(`Base URI:   ${baseURI}`);
  console.log("========================================");
  console.log("\nNext step: Run the setBaseURI script:");
  console.log("  npx hardhat run scripts/set-base-uri.js --network bsc");
  console.log("========================================\n");
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
