# @arcsign/hardhat-plugin

Hardhat plugin for secure transaction signing with ArcSign wallet.

**No more private keys in .env files!**

## Features

- 🔐 Sign transactions using your ArcSign cold wallet
- 🔑 Private keys never leave the USB device
- 👁️ Visual confirmation in ArcSign Dashboard for each transaction
- ⚡ Session mode for rapid testnet development
- ✍️ Full EIP-191 and EIP-712 signing support
- 📝 Works with Hardhat's existing deployment scripts (no changes needed!)
- 🔍 Auto-inject Block Explorer API keys for contract verification

## Installation

```bash
npm install @arcsign/hardhat-plugin
```

## Quick Start

### 1. Update your `hardhat.config.js`

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("@arcsign/hardhat-plugin");

module.exports = {
  solidity: "0.8.20",
  networks: {
    mainnet: {
      url: process.env.RPC_URL,
      accounts: [],      // Empty - ArcSign provides signers
      arcsign: true,     // Enable ArcSign for this network
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [],
      arcsign: true,
    },
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      accounts: [],
      arcsign: true,
    },
  },
};
```

### 2. Make sure ArcSign Dashboard is running

The plugin connects to ArcSign Dashboard via WebSocket (127.0.0.1:9527).

1. Open ArcSign Dashboard
2. Unlock your wallet
3. Go to Developer Mode (🔧 button)

### 3. Run your deploy script

```bash
npx hardhat run scripts/deploy.ts --network mainnet
```

You'll see output like:

```
🔗 Connecting to ArcSign wallet...
✓ Connected to ArcSign v1.0.0
Available accounts:
  [0] 0x742d35Cc6634C0532925a3b844Bc9e7595f45321

Deploying with: 0x742d35Cc...5321
⏳ Waiting for approval in ArcSign Dashboard...
   Transaction: Deploy MyToken.sol
   Network: Ethereum Mainnet
   Estimated Gas: ~0.05 ETH

✓ Transaction signed!
✓ Transaction submitted: 0xabc123...

Token deployed to: 0xdef456...
```

## Deploy Scripts

Your existing deploy scripts work without modification:

```typescript
// scripts/deploy.ts
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Token = await ethers.getContractFactory("MyToken");
  const token = await Token.deploy();
  // ↑ ArcSign Dashboard will show approval request

  await token.waitForDeployment();
  console.log("Token deployed to:", await token.getAddress());
}

main().catch(console.error);
```

## Session Mode (Optional)

For rapid testnet development, enable Session Mode in ArcSign Dashboard:

1. Go to Developer Mode → Session Settings
2. Enable "Session Mode"
3. Testnet transactions will auto-sign for 30 minutes

**Security**: Mainnet transactions always require manual confirmation.

## Supported Networks

The plugin works with any EVM-compatible network:

- Ethereum (mainnet, sepolia, goerli)
- BNB Chain (BSC mainnet, testnet)
- Polygon (mainnet, mumbai)
- Arbitrum
- Optimism
- Base
- And any custom EVM chain

## API Reference

### `hre.arcsign`

The plugin extends Hardhat's runtime environment with an `arcsign` namespace:

```typescript
// Check connection status
const isConnected = await hre.arcsign.isConnected();

// Get available accounts
const accounts = await hre.arcsign.getAccounts();

// Get the underlying provider
const provider = hre.arcsign.provider;
```

### Session Management

```typescript
// Get session status
const session = await hre.arcsign.provider.getSession();

// Create a session (for CLI tools)
await hre.arcsign.provider.createSession({
  walletId: "wallet-id",
  durationMinutes: 30,
  trustedNetworks: ["sepolia", "bsc-testnet"],
});

// End session
await hre.arcsign.provider.endSession();
```

## Contract Verification

ArcSign automatically injects Block Explorer API keys when you run `npx hardhat verify`. No need to configure API keys in `.env` files!

### Setup API Keys

1. Open ArcSign Dashboard
2. Go to Developer Mode → Settings tab
3. Add your Block Explorer API keys (Etherscan, BSCScan, etc.)

### Usage

```bash
# Deploy your contract
npx hardhat run scripts/deploy.ts --network bscTestnet

# Verify - API key is auto-injected from ArcSign!
npx hardhat verify --network bscTestnet 0xYourContractAddress "constructor" "args"
```

Terminal output:

```text
[ArcSign] Network "bscTestnet" will use ArcSign wallet for signing
[ArcSign] Checking for bscscan API key...
[ArcSign] Found bscscan API key, injecting into config...
[ArcSign] Injected API key successfully
Successfully verified contract MyContract on the block explorer.
https://testnet.bscscan.com/address/0xYourContractAddress#code
```

### Supported Block Explorers

| Explorer | Networks | Get API Key |
|----------|----------|-------------|
| Etherscan | Ethereum, Sepolia | [etherscan.io/apis](https://etherscan.io/apis) |
| BSCScan | BSC, BSC Testnet | [bscscan.com/apis](https://bscscan.com/apis) |
| Polygonscan | Polygon, Mumbai, Amoy | [polygonscan.com/apis](https://polygonscan.com/apis) |
| Arbiscan | Arbitrum, Arbitrum Sepolia | [arbiscan.io/apis](https://arbiscan.io/apis) |
| Optimism | Optimism, Optimism Sepolia | [optimistic.etherscan.io/apis](https://optimistic.etherscan.io/apis) |
| Basescan | Base, Base Sepolia | [basescan.org/apis](https://basescan.org/apis) |
| Snowtrace | Avalanche, Avalanche Fuji | [snowtrace.io/apis](https://snowtrace.io/apis) |

### Fallback Behavior

If ArcSign Dashboard is not running or no API key is configured:

- The plugin falls back to `hardhat.config.js` etherscan settings
- You can still use traditional `.env` configuration as a backup

## Troubleshooting

### "Failed to connect to ArcSign"

Make sure:
1. ArcSign Dashboard is running
2. You're on the correct version (check with ping)
3. No firewall is blocking localhost:9527

### "No accounts available"

Make sure:
1. A wallet is unlocked in ArcSign Dashboard
2. The wallet has at least one address
3. You're in Developer Mode

### "Transaction confirmation timed out"

Transactions require approval within 5 minutes. Check ArcSign Dashboard for pending requests.

## Security

- Private keys never leave your USB device
- All transactions require visual confirmation (except testnet in session mode)
- The plugin only communicates with localhost (127.0.0.1)
- No data is sent to external servers

## License

MIT
