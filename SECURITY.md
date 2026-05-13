# Security Policy

## Reporting a vulnerability

**Do NOT report security vulnerabilities through public GitHub issues.**

Instead, email **`security@arcsign.io`**. For sensitive reports, encrypt
with our PGP key — fingerprint and download below.

> Note: `security@arcsign.io` routing is being set up; if you do not get
> an autoresponse within 24 hours, please also ping `@arcsign` on Twitter
> or open a generic issue saying "please check security email" (no
> details in public).

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

ArcSign currently does **NOT** offer monetary bounty.

We do commit to:

- Public credit in Hall of Fame.
- **Retroactive bounty payments** when revenue allows — qualified
  historical disclosures will receive backpay when the bounty program
  launches.
- First-priority access to the future bounty program.

The bounty program launches when **Pro NFT holders > 500**. Tentative
tiers: Critical $5K / High $1K / Medium $200 / Low credit only.

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

None yet. First external audit is planned after the open-source launch
has been stable for a few months (target: Pro NFT holders > 500
milestone, coordinating with the bounty program launch).

## Verifying you have an official binary

Before reporting a vulnerability, please verify you're running an
official ArcSign binary — the bug may not exist in the official source.

- Compare your binary's SHA-256 to
  `https://dl.arcsign.io/v<VERSION>/SHA256SUMS`.
- On startup, the Dashboard logs three official addresses (Pro NFT,
  Referral, Swap Referrer). They must match
  [`OFFICIAL_ADDRESSES.md`](OFFICIAL_ADDRESSES.md).

If either check fails, you may be running a malicious fork —
**that itself is worth reporting** (separately from any other bug).
