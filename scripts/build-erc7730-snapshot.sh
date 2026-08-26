#!/usr/bin/env bash
# Build the embedded ERC-7730 snapshot from the upstream registry.
# Run this when refreshing the built-in descriptor set for a release.
#
# Usage: scripts/build-erc7730-snapshot.sh
set -euo pipefail

REPO="ethereum/clear-signing-erc7730-registry"
BRANCH="master"   # upstream default branch is master, not main
OUT="internal/clearsign/data/snapshot.json"

# ArcSign's supported chains only — keeps the binary small.
CHAINS="1,56,137,42161,10,8453,43114"

mkdir -p "$(dirname "$OUT")"

SHA=$(curl -sL "https://api.github.com/repos/$REPO/commits/$BRANCH" | python3 -c 'import json,sys; print(json.load(sys.stdin)["sha"])')

# One tarball fetch instead of ~740 individual raw-file requests — much faster
# and avoids GitHub API rate limits.
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT
curl -sL "https://api.github.com/repos/$REPO/tarball/$BRANCH" -o "$TMPDIR/repo.tar.gz"
tar xzf "$TMPDIR/repo.tar.gz" -C "$TMPDIR"
ROOT=$(find "$TMPDIR" -maxdepth 1 -mindepth 1 -type d | head -1)

CHAINS="$CHAINS" REPO="$REPO" SHA="$SHA" OUT="$OUT" ROOT="$ROOT" python3 -c '
import json, os, glob, datetime

root = os.environ["ROOT"]
want = {int(c) for c in os.environ["CHAINS"].split(",")}
repo, sha = os.environ["REPO"], os.environ["SHA"]

# Only top-level "calldata-*.json" descriptors bound to a real deployment
# address. This also naturally excludes registry test fixtures (tests/,
# testsv2/), off-chain EAS attestation samples (sigs/), and the generic
# ERC-standard templates (ercs/) that ship with empty deployments — none of
# those are addressable (chainId, address, selector) descriptors.
paths = [p for p in glob.glob(os.path.join(root, "**", "*.json"), recursive=True)
         if "/calldata-" in p]

kept = []
for p in paths:
    with open(p) as f:
        d = json.load(f)
    deps = d.get("context", {}).get("contract", {}).get("deployments", [])
    if any(dep.get("chainId") in want for dep in deps):
        kept.append(d)

out = {
    "version": datetime.date.today().isoformat(),
    "source": "github.com/" + repo + "@" + sha,
    "descriptors": kept,
}
with open(os.environ["OUT"], "w") as f:
    json.dump(out, f, separators=(",", ":"))
print("wrote " + str(len(kept)) + " descriptors")
'

echo "snapshot: $(wc -c < "$OUT") bytes"
