# Reproducible Builds

ArcSign aims for bit-for-bit reproducible builds: anyone can compile the
source code and produce a binary with the **same SHA-256 hash** as the
official release. This means you don't have to trust our build server —
you can verify yourself.

## Why this matters for a cold wallet

"Trust our binary" is not enough for a tool that handles your savings.
A malicious build server (ours or anyone else's) could substitute a
backdoored version that signs unexpected transactions, exfiltrates keys,
or leaks the `.arcsign` decryption password.

Reproducible builds make this detectable: if your build hash differs
from the official hash, **something was tampered with** — either the
binary you downloaded, the build process, or the source code itself.

## How to verify a release

```bash
# 1. Download the official binary
curl -L https://dl.arcsign.io/v1.3.0/libarcsign-macos-arm64.dylib \
  -o libarcsign-official.dylib

# 2. Clone source at the same git tag
git clone https://github.com/arcsignio/arcsign.git
cd arcsign
git checkout v1.3.0

# 3. Build reproducibly
make build-reproducible

# 4. Compare hashes
shasum -a 256 dashboard/src-tauri/libarcsign_arm64.dylib
shasum -a 256 ../libarcsign-official.dylib

# Hashes should match. If they don't, file a SECURITY issue at
# security@arcsign.io and STOP using the binary you downloaded.
```

## Official hashes

Published at `https://dl.arcsign.io/v<VERSION>/SHA256SUMS` for every release.

Also available as a GitHub Actions artifact on every tag push:
https://github.com/arcsignio/arcsign/actions/workflows/reproducible-build.yml

## Build requirements (for reproducibility)

For bit-for-bit reproducibility, you need:

- **Same Go version** (check `go.mod` for `go 1.21+`).
- **`SOURCE_DATE_EPOCH`** set to the commit timestamp (handled
  automatically by `make build-reproducible`).
- **`-trimpath`** flag in Go build (also automatic in the make target).
- No local environment variables affecting compilation (no `CGO_LDFLAGS`
  overrides, etc.).

For approximate verification (catches gross tampering but not deterministic
byte-for-byte): just rebuild with the same Go major version.

## Known sources of non-determinism

- **macOS code signature timestamps**: stripped in reproducible builds
  via ad-hoc signing (`codesign --force --sign -`). External
  Apple-signed distributions add a notarization timestamp; we hash the
  pre-notarization dylib.
- **Windows PE timestamp**: patched to a fixed value in the workflow.
- **Linux**: usually reproducible without special steps.

## What's covered

- ✅ Go shared library (`libarcsign.dylib`/`.so`/`.dll`) — the part that
  handles your keys.

## What's NOT covered

- ❌ The full Tauri Dashboard `.app` / `.exe` / `.AppImage` bundle —
  Tauri's bundling step uses non-deterministic compression (lzma, dmg).
  We hash the pre-bundle Rust binary and the Go dylib instead.
- ❌ Smart contracts: solc bytecode is reproducible per solc version,
  but verification flows through BscScan source-verify, not this doc.
  See `contracts/deployments/`.

## Reporting reproducibility issues

If you cannot reproduce a build, please open an issue tagged
`reproducibility` with:

- OS / architecture (e.g., `macOS 14 arm64`).
- Go / Rust / GCC version (`go version`, `rustc --version`, `gcc --version`).
- Your build hash.
- Official hash from `SHA256SUMS`.

If you suspect a binary discrepancy is malicious rather than a
reproducibility bug, please **email `security@arcsign.io`** instead of
opening a public issue.
