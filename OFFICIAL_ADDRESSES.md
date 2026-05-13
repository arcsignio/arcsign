# Official ArcSign Addresses

This file is the canonical, user-facing source for ArcSign's official
on-chain addresses. If you are running an unmodified official ArcSign
binary, it uses exactly these values.

## How to verify

Three independent methods, in increasing strength:

1. **Check the Dashboard startup logs** — on launch, ArcSign prints the
   three official addresses to stderr (also visible in the system console).
   They must match the table below. If they don't, you are not running
   an official binary.

2. **Inspect the compiled constants** — search the source at the tag
   you downloaded:
   ```bash
   grep -nE 'ArcSign(ProNFT|Referral|SwapReferrer)Address' internal/wallet/constants.go
   ```

3. **Reproducible build** — clone, build from source, and compare the
   binary hash to the official release.
   See [`docs/reproducible-builds.md`](docs/reproducible-builds.md).

If a fork or modified version uses different addresses, you are NOT
using the official ArcSign. Your fees, NFT membership, and referral
rewards will accrue to whoever forked it, not to the ArcSign project.

## Addresses

### BSC Mainnet (Chain ID: 56)

| Purpose | Address | Source | Deployed |
|---|---|---|---|
| ArcSign Pro NFT | `0x02EA7B4870Aa0553EF357Af6475727f1E01c7b2F` | `internal/wallet/constants.go:ArcSignProNFTAddress` | 2026-01-06 |
| Referral contract | `0x69A7aa10e11958e79988553f1722a703F7411457` | `internal/wallet/constants.go:ArcSignReferralAddress` | 2026-03-31 |
| Swap Referrer (Treasury EOA) | `0x2e26cbD533Ac3E98d3B650c7f89406EbB6f2f634` | `internal/wallet/constants.go:ArcSignSwapReferrer` | EOA, not a contract |

### Payment token

| Token | Address | Notes |
|---|---|---|
| USDT (BSC, BEP-20) | `0x55d398326f99059fF775485246999027B3197955` | Pro NFT mint price: 30 USDT |

## On-chain verification

Each contract has a deployment record committed at the same tag as the
binary that uses it:

- Pro NFT: [`contracts/deployments/bsc.json`](contracts/deployments/bsc.json)
- Referral: [`contracts/deployments/bsc-referral.json`](contracts/deployments/bsc-referral.json)

You can also inspect each contract directly on BscScan:

- [Pro NFT on BscScan](https://bscscan.com/address/0x02EA7B4870Aa0553EF357Af6475727f1E01c7b2F)
- [Referral on BscScan](https://bscscan.com/address/0x69A7aa10e11958e79988553f1722a703F7411457)
- [Treasury on BscScan](https://bscscan.com/address/0x2e26cbD533Ac3E98d3B650c7f89406EbB6f2f634)

## Change policy

These addresses are intentionally pinned at compile time and are NOT
configurable at runtime. Changing any of them requires:

1. A pull request modifying `internal/wallet/constants.go` (and the
   matching `dashboard/src/constants/contracts.ts`).
2. Explicit maintainer review and approval — the CI labeler tags any
   PR touching these files with `needs-design`, which blocks
   auto-merge.
3. An entry in [`CHANGELOG.md`](CHANGELOG.md) explaining the change,
   the new address, and migration instructions for existing users.
4. A pre-announcement on the official Twitter / Discord at least 7 days
   before the release that ships the change.

Forks are free to change these values, but a fork that changes them is
no longer "ArcSign" — see [`TRADEMARK.md`](TRADEMARK.md) for fork
naming requirements.

## Reporting a mismatch

If your Dashboard's startup logs show different addresses, or if you
suspect a fake binary is impersonating ArcSign:

- Email `security@arcsign.io` (PGP key in `SECURITY.md`).
- Do **not** open a public GitHub issue — let us coordinate disclosure.
