require("@nomicfoundation/hardhat-toolbox");
require("@arcsign/hardhat-plugin");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    // Sepolia Testnet - for testing Developer Mode
    sepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/1zXEi-hsnrgtd82vEvuYx",
      chainId: 11155111,
      accounts: [],  // ArcSign plugin will provide signers
      arcsign: true, // Enable ArcSign for this network
    },
    // BSC Testnet - uses ArcSign for secure signing
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: [],  // ArcSign plugin will provide signers
      arcsign: true, // Enable ArcSign for this network
    },
    // BSC Mainnet - uses ArcSign for secure signing
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: [],  // ArcSign plugin will provide signers
      arcsign: true, // Enable ArcSign for this network
    }
  },
  // Etherscan API v2 configuration (unified API key for all chains)
  // See: https://docs.etherscan.io/v2-migration
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || process.env.BSCSCAN_API_KEY || "",
    customChains: [
      {
        network: "bsc",
        chainId: 56,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=56",
          browserURL: "https://bscscan.com"
        }
      },
      {
        network: "bscTestnet",
        chainId: 97,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=97",
          browserURL: "https://testnet.bscscan.com"
        }
      }
    ]
  }
};
