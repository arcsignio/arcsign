# Security Policy

## Reporting a vulnerability

**Do NOT report security vulnerabilities through public GitHub issues.**

Instead, email **`security@arcsign.io`**. For sensitive reports, encrypt
with our PGP key — fingerprint and download below.

> If you do not receive an acknowledgement within the SLA (see below),
> please also ping `@ArcSignWallet` on Twitter or open a generic issue
> saying "please check security email" — without disclosing any details.

### Response SLA

This is a one-maintainer project. We commit to **best-effort response,
not guaranteed turnaround**:

- **Within 24 hours**: acknowledge receipt.
- **Within 7 days**: initial triage and severity assignment.
- **Critical bugs**: target fix within 14 days.
- **High severity**: target fix within 30 days.
- **Medium / Low**: target fix within 60–90 days.

### Disclosure policy

We follow coordinated disclosure:

- Reporter and ArcSign agree on a fix timeline.
- Fix shipped + binary updated via OTA (`latest.json`).
- **30-day embargo** after fix to let users upgrade.
- After embargo: public advisory published in
  [`docs/security-advisories/`](docs/security-advisories/).

### Hall of Fame

Researchers who follow this policy get credited in
[`SECURITY-HALL-OF-FAME.md`](SECURITY-HALL-OF-FAME.md) (created on first
disclosure).

## Bug bounty

ArcSign currently does **NOT** offer a monetary bounty.

ArcSign is a single-maintainer project without the budget for a bounty
program. A formal bounty program will follow once the project is
sustainable enough to fund it; tiers and rules will be published in this
file at that time.

What I can offer today:

- Public credit in Hall of Fame for qualified disclosures.
- Non-monetary support I can actually deliver: references, citations,
  help with CVE assignment.
- First-priority access to the bounty program once it launches.

## Threat model

What ArcSign defends against:

- ✅ **Lost / stolen USB device** — encrypted `.arcsign` backup means
  physical loss does not equal fund loss.
- ✅ **Compromised host OS** — private keys never decrypt outside the
  USB-resident wallet file path.
- ✅ **Malicious DEX router output** — swap parameters are displayed
  and signed on-device before broadcast.
- ✅ **Forged provider data** — independent verification across
  Alchemy / NodeReal providers when available.
- ✅ **Supply chain attacks** — reproducible builds let users verify
  binaries against source. See
  [`docs/reproducible-builds.md`](docs/reproducible-builds.md).

What ArcSign does **not** defend against (out of scope):

- ❌ Physical extraction attacks against the USB device itself (we are
  not a HSM).
- ❌ User social engineering (we cannot prevent users sharing their
  `.arcsign` file or its decryption password).
- ❌ Compromised hardware (the USB controller itself being malicious).
- ❌ Side-channel attacks on the host machine (TEMPEST, etc.).
- ❌ Vulnerabilities in third-party DEX routers or RPC providers — we
  surface their data; we don't operate them.

## PGP key

```
User ID     : ArcSign Security <security@arcsign.io>
Key type    : RSA 4096
Fingerprint : DD9E 5E64 52BA F196 BAD0  7897 61BA 5B67 FF39 660E
Created     : 2026-05-13
Expires     : 2028-05-12
```

**Download the public key:**

- From this repo: [`docs/pgp-pubkey.asc`](docs/pgp-pubkey.asc)
- From a keyserver: `gpg --keyserver keys.openpgp.org --recv-keys DD9E5E6452BAF196BAD0789761BA5B67FF39660E`

**Encrypt a report:**

```bash
gpg --import docs/pgp-pubkey.asc
gpg --encrypt --armor --recipient security@arcsign.io < report.txt
# Send the .asc output via email.
```

## Scope

### In scope

- Critical: key extraction, signature forgery, fund loss, remote code
  execution, persistent device compromise.
- High: privilege escalation, authentication bypass, ability to read
  the unencrypted wallet file from another process.
- Medium: information disclosure, denial-of-service on user actions,
  exposure of metadata that could deanonymize.
- Low: UI / UX security issues, hardening suggestions, minor improvements.

### Out of scope

- Issues in third-party dependencies (please report to the upstream
  project; ping us if it's load-bearing for our security model).
- Issues only exploitable with physical access to an *unlocked* device.
- DoS via flooding (rate limits enforced).
- Issues in test / dev / example code.
- Self-XSS or issues requiring users to ignore explicit security warnings.

## Past audits

None yet. An external audit will be commissioned when the project has
the budget to fund one. I'm not going to promise a specific milestone
trigger here — solo project, limited resources, honesty matters.

## Verifying you have an official binary

Before reporting a vulnerability, please verify you're running an
official ArcSign binary — the bug may not exist in the official source.

- Compare your binary's SHA-256 to the `SHA256SUMS` file attached to the
  matching GitHub Release at
  `https://github.com/arcsignio/arcsign/releases`.
- On startup, the Dashboard logs three official addresses (Pro NFT,
  Referral, Swap Referrer). They must match
  [`OFFICIAL_ADDRESSES.md`](OFFICIAL_ADDRESSES.md).

If either check fails, you may be running a malicious fork —
**that itself is worth reporting** (separately from any other bug).

## Dependency vulnerability scanning

This project continuously scans its dependencies for known
vulnerabilities:

- **Go code** is scanned in CI with
  [`govulncheck`](https://pkg.go.dev/golang.org/x/vuln/cmd/govulncheck).
  The CI check runs in **report-only** mode (it surfaces findings but does
  not block the build), so maintainers triage results without breaking
  unrelated work.
- **npm dependencies** are monitored by **GitHub Dependabot**, which opens
  alerts and pull requests for vulnerable packages.

To reproduce the scans locally:

```bash
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...
(cd src/chainadapter && govulncheck $(go list ./... | grep -v /examples))
cd dashboard && npm audit --omit=dev
```
