# ArcSign v1.5.0 — Key-free balances, clear-signing, and a free OFAC check

This is the first feature update since the open-source launch (v1.4.0). The
theme is **seeing what you sign and owning your data without an API key**.

ArcSign is a USB-only cold wallet for Bitcoin and EVM chains. Private keys
never leave the USB drive, and the `.arcsign` backup file is AES-256 encrypted
at export. Apache 2.0, open source, reproducible builds.

## Highlights

- **Token balances now need no API key — on every chain.** All native coins
  and common tokens (plus anything you've swapped into or imported) are read
  through a self-hosted public-RPC + Multicall3 path with prices from DefiLlama.
  No Alchemy key, no setup, nothing leaves your machine to a central index.
  (Provider keys are now only needed for NFTs and transaction history.)

- **Clear-signing — see what you sign.** WalletConnect and the Pro mint flow no
  longer show a truncated hex blob. Calldata and EIP-712 typed data are decoded
  locally (zero external API) into a human-readable summary: a plain transfer, an
  approval, an *unlimited* approval (flagged red), a `setApprovalForAll`, or a
  decoded DEX swap (Uniswap/Pancake V2 & V3, 1inch, KyberSwap, OpenOcean). When
  something can't be decoded, it says so plainly and still shows the raw hex — no
  false sense of safety.

- **Blacklist check is now free for everyone.** The OFAC sanctions list and a
  curated malicious-address list ship embedded in the app (offline seed), so the
  check works on first launch with no network and no key. Sign a transaction to a
  blacklisted address and the **backend refuses to sign** unless you explicitly
  acknowledge the risk — the gate lives where the private key is used, not in the
  UI. (Transaction *simulation* remains a Pro feature; the blacklist does not.)

- **7th EVM chain: Avalanche.** Ethereum, BSC, Polygon, Arbitrum, Optimism,
  Base, and now Avalanche C-Chain.

- **Import any token; swaps remember themselves.** A manual "Import token" dialog
  plus automatic recording of swap outputs, stored encrypted on the USB — so a
  token you've touched shows its balance without a key, and the list never leaves
  the device.

## Also in this release

- Online ABI fallback (Sourcify) for decoding verified contracts the local list
  doesn't cover — opt-in, with a one-time privacy note, and an encrypted on-USB
  cache.
- Cross-chain asset aggregation: native coins and whitelisted stablecoins merge
  into one row, with a per-chain breakdown in the detail view.
- All message-signing paths (EIP-191 / EIP-712) now go through the same
  XOR-split secure signer — no plaintext key handling on any path.
- Clearer "needs a key" messaging for NFT / history when a provider key is
  missing, instead of silently showing empty.
- Removed a leaked third-party API key that had been committed to the repo;
  provider keys now live only in the per-USB encrypted config.

## Security notes

- The signing security gate (blacklist + acknowledge) is enforced in the Go
  backend, before any key derivation — it cannot be bypassed from the frontend.
- ERC-20/BEP-20 transfer building now validates the token contract address at a
  single source of truth, so gas estimation and transaction construction can
  never disagree on whether a transaction is a token transfer or a native send.

## Downloads

| Platform                    | File                         |
|-----------------------------|------------------------------|
| macOS (Apple Silicon)       | `ArcSign-macOS-ARM64.dmg`    |
| Windows (x64)               | `ArcSign-Windows-x64.msi`    |
| Linux (x64) — Debian/Ubuntu | `ArcSign-Linux-x64.deb`      |
| Linux (x64) — universal     | `ArcSign-Linux-x64.AppImage` |

Also included: `libarcsign.dylib`, `libarcsign.so`, `arcsign.dll` (the Go
shared library the desktop app loads — published so you can verify the bundled
copy matches).

## Verification

Every release ships with `SHA256SUMS` covering both the installer bundles and
the Go shared library:

```bash
shasum -a 256 -c SHA256SUMS --ignore-missing
```

For full reproducible builds, clone the source at this tag and run
`make build-reproducible`; the resulting SHA-256 should match what's published.
See [`docs/reproducible-builds.md`](https://github.com/arcsignio/arcsign/blob/master/docs/reproducible-builds.md).

## Install (macOS / Linux)

```bash
bash <(curl -fsSL https://arcsign.io/install.sh)
```

The install script verifies the SHA-256 against the published `SHA256SUMS`
before installing.

## Known limitations

- macOS Intel and Linux ARM are not yet built. Open an issue if you need them.
- The macOS DMG is unsigned (no Apple Developer Program enrollment yet) — use
  right-click → Open the first time, or
  `xattr -d com.apple.quarantine /Applications/ArcSign.app` after install.
- Windows installer is unsigned (no EV cert yet) — SmartScreen will warn on
  first launch.

## Upgrading

The `.arcsign` backup format is unchanged — existing wallets and backups work
as-is. The Tauri updater will offer this build automatically.

---

Bug reports, security disclosures, and pull requests welcome.
Full commit history: `v1.4.0...v1.5.0`.
