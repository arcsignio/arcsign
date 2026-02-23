const hre = require("hardhat");

async function main() {
  const abi = [
    "function tokenURI(uint256 tokenId) view returns (string)"
  ];
  const contract = new hre.ethers.Contract(
    "0x02EA7B4870Aa0553EF357Af6475727f1E01c7b2F",
    abi,
    hre.ethers.provider
  );

  console.log("Checking token URIs...");
  console.log("Token #1 URI:", await contract.tokenURI(1));
  console.log("Token #10 URI:", await contract.tokenURI(10));
}

main().catch(console.error);
