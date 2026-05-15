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

## Scope of reproducibility

What we can guarantee is reproducible: **`libarcsign.dylib` / `.so`** —
the Go shared library that contains all the key handling, signing, and
BIP-39 code. This is the only piece we'd ever want you to audit for
tampering.

Status per platform:

| Platform | Library | Status |
|---|---|---|
| macOS arm64 | `libarcsign.dylib` | ✅ Reproducible (verified in CI) |
| Linux x86_64 | `libarcsign.so` | ✅ Reproducible (verified in CI) |
| Windows x86_64 | `libarcsign.dll` | ⚠️ Approximate — CGO/MinGW adds PE timestamps |

CI runs each build twice in fresh runners and diffs the SHA-256. macOS
and Linux jobs fail on mismatch. Windows is documented as warning rather
than failure because the Go CGO + MinGW toolchain adds a few non-trivial
non-deterministic bytes (PE header timestamps, debug-info GUIDs) that
require deeper work to eliminate. We treat Windows reproducibility as
ongoing work, not a current promise.

What we **cannot** guarantee bit-for-bit: the full `.dmg`, `.msi`,
`.AppImage` bundles. These contain installer metadata, notarization
timestamps, and code-signature blocks that the OS toolchain adds
non-deterministically. To verify a release, verify the dylib/so/dll
**inside the bundle**, not the bundle itself.

If you need to verify a release, verify the **dylib inside the bundle**.

## How to verify a release (macOS example)

```bash
# 1. Get SHA256SUMS + official dylib from the release
TAG=v1.4.0
BASE="https://github.com/arcsignio/arcsign/releases/download/${TAG}"
curl -fsSL -O "${BASE}/SHA256SUMS"
curl -fsSL -O "${BASE}/libarcsign.dylib"

# 2. Verify the published hash file matches the dylib byte-for-byte
shasum -a 256 -c SHA256SUMS --ignore-missing
# Expected:  libarcsign.dylib: OK

# 3. Clone source at the same tag and rebuild reproducibly
git clone https://github.com/arcsignio/arcsign.git arcsign-src
cd arcsign-src
git checkout "${TAG}"
make build-reproducible

# 4. Compare your build to the published one — these MUST match
shasum -a 256 dashboard/src-tauri/libarcsign.dylib
shasum -a 256 ../libarcsign.dylib
```

If hashes don't match, file a SECURITY issue at `security@arcsign.io`
and STOP using the binary you downloaded.

(Linux/Windows: same flow, replace `libarcsign.dylib` with
`libarcsign.so` / `libarcsign.dll` and use `sha256sum` instead of
`shasum -a 256`.)

## Official hashes

`SHA256SUMS` is published as a GitHub Release attachment for every
tagged release. It covers:

- The installer bundles (`.dmg`, `.msi`, `.deb`, `.AppImage`) so you can
  verify a download wasn't corrupted or substituted.
- The Go shared library (`libarcsign.dylib` / `.so` / `.dll`) so you can
  reproduce the build from source and verify byte-for-byte equality.

The same `SHA256SUMS` is also generated independently in CI by the
`Reproducible Build` workflow on every tag push — that workflow runs
each platform build twice and fails if hashes diverge, providing an
attestation that's independent of the release pipeline.

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
