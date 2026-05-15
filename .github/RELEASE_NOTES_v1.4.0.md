# ArcSign v1.4.0 — Open Source Launch

**This is ArcSign's first public release.** Apache 2.0 licensed, open source, with reproducible builds.

ArcSign is a USB-only cold wallet for Bitcoin and 6 EVM chains. Private keys
never leave the USB drive. The `.arcsign` backup file is AES-256 encrypted at
export, so a stolen backup file is not a stolen wallet.

## Why this exists

Hardware wallets cost $79–$149, lock you into a specific device, and aren't
something you can carry through a border crossing without questions. Software
wallets are convenient but store keys on a hard drive that any malware can
read. ArcSign is the middle path: install on any USB stick you already own,
unplug it when you're done, and your keys are out of reach of anything
running on the computer.

The original audience I had in mind was people who need to actually carry
their money with them — refugees, journalists in hostile jurisdictions,
people whose bank accounts have been frozen. They don't have time to wait
for a Ledger to arrive in the mail. But the same tradeoffs make sense for
everyone who wants strong cold-storage security at zero hardware cost.

## What's in this release

- **Multi-chain HD wallet** — Bitcoin + 6 major EVM chains
  (Ethereum, BSC, Polygon, Arbitrum, Optimism, Base)
- **USB-only cold storage** — private keys generated and stored only on the
  USB device, never on the host filesystem
- **`.arcsign` encrypted backup** — AES-256 at export, replaces paper seed
  phrases
- **DEX swap aggregator** — OpenOcean + KyberSwap parallel quotes, picks the
  best route automatically
- **Token approval manager** — view and revoke ERC-20 approvals across 6
  chains. Pro members get batch revoke.
- **NFT gallery** — cross-chain ERC-721 / ERC-1155 display
- **DeFi positions** — liquid staking (stETH, ankrETH, ankrBNB) with real-time APY
- **WalletConnect** — sign transactions from cold storage when connecting to
  dApps
- **Pro membership** — optional 30 USDT/year NFT on BSC for advanced features

## Downloads

| Platform                | File                              |
|-------------------------|-----------------------------------|
| macOS (Apple Silicon)   | `ArcSign-macOS-ARM64.dmg`         |
| Windows (x64)           | `ArcSign-Windows-x64.msi`         |
| Linux (x64) — Debian/Ubuntu | `ArcSign-Linux-x64.deb`       |
| Linux (x64) — universal | `ArcSign-Linux-x64.AppImage`      |

Also included: `libarcsign.dylib`, `libarcsign.so`, `arcsign.dll` (the Go
shared library that the desktop app loads — published so you can verify the
bundled copy matches).

## Verification

Every release ships with `SHA256SUMS` covering both the installer bundles
and the Go shared library. To verify your download:

```bash
shasum -a 256 -c SHA256SUMS --ignore-missing
```

For full reproducible builds — clone the source at this tag, run
`make build-reproducible`, and the resulting SHA-256 should match what's
published here. If it doesn't, something was tampered with. See
[`docs/reproducible-builds.md`](https://github.com/arcsignio/arcsign/blob/master/docs/reproducible-builds.md)
for the full procedure.

## Install (macOS / Linux)

```bash
bash <(curl -fsSL https://arcsign.io/install.sh)
```

The install script verifies the SHA-256 against the published `SHA256SUMS`
before installing. Source: [`install.sh`](https://arcsign.io/install.sh).

## Open source

- **License:** Apache 2.0 — see [LICENSE](https://github.com/arcsignio/arcsign/blob/master/LICENSE)
- **Trademark policy:** fork-friendly, see [TRADEMARK.md](https://github.com/arcsignio/arcsign/blob/master/TRADEMARK.md)
- **Security policy:** [SECURITY.md](https://github.com/arcsignio/arcsign/blob/master/SECURITY.md) — PGP-signed disclosures welcome
- **Contributing:** [CONTRIBUTING.md](https://github.com/arcsignio/arcsign/blob/master/CONTRIBUTING.md) — DCO sign-off required, no CLA

Every official on-chain address (Pro NFT contract, referral contract, swap
referrer) is a compile-time Go constant. They are printed at app startup
and documented at
[`OFFICIAL_ADDRESSES.md`](https://github.com/arcsignio/arcsign/blob/master/OFFICIAL_ADDRESSES.md)
so you can verify against BscScan.

## Known limitations

- macOS Intel and Linux ARM are not yet built. Open an issue if you need them.
- The macOS DMG is unsigned (no Apple Developer Program enrollment yet) —
  you'll need to right-click → Open the first time, or run
  `xattr -d com.apple.quarantine /Applications/ArcSign.app` after install.
- Windows installer is unsigned (no EV cert yet) — SmartScreen will warn on
  first launch.

These are funding constraints, not technical ones. They'll get fixed as
the project matures.

## What's next

See [ROADMAP.md](https://github.com/arcsignio/arcsign/blob/master/ROADMAP.md).
Mobile companion app, additional chains, hardware wallet bridging are the
next priorities — in roughly that order.

---

Bug reports, security disclosures, and pull requests welcome.
Thanks for taking a look.
