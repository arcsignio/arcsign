package clearsign

import "testing"

func TestEmbeddedSnapshotLoads(t *testing.T) {
	r, err := LoadEmbeddedSnapshot()
	if err != nil {
		t.Fatalf("load embedded snapshot: %v", err)
	}
	if r.Count() == 0 {
		t.Fatal("embedded snapshot is empty — run scripts/build-erc7730-snapshot.sh")
	}
	if r.Version() == "" {
		t.Error("snapshot version must be set")
	}
}

func TestLookupIsCaseInsensitiveOnAddress(t *testing.T) {
	r := newTestRegistry(t)
	// Uniswap V3 Router 2 on Ethereum, exactInput selector.
	const addr = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"
	sel := SelectorForSignature(
		"exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum) params)")

	if _, _, ok := r.Lookup(1, addr, sel); !ok {
		t.Error("mixed-case address should resolve")
	}
	if _, _, ok := r.Lookup(1, "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", sel); !ok {
		t.Error("lowercase address should resolve")
	}
}

func TestLookupWrongChainMisses(t *testing.T) {
	r := newTestRegistry(t)
	sel := SelectorForSignature(
		"exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum) params)")
	// Same contract address, wrong chain id: must not resolve.
	if _, _, ok := r.Lookup(999999, "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", sel); ok {
		t.Error("descriptor must not apply across chains")
	}
}

func TestLookupUnknownSelectorMisses(t *testing.T) {
	r := newTestRegistry(t)
	if _, _, ok := r.Lookup(1, "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", "0xdeadbeef"); ok {
		t.Error("unknown selector must not resolve")
	}
}

// newTestRegistry builds a registry from one known descriptor so the tests do
// not depend on whatever the embedded snapshot happens to contain.
func newTestRegistry(t *testing.T) *Registry {
	t.Helper()
	d, err := ParseDescriptor([]byte(uniswapSample))
	if err != nil {
		t.Fatalf("parse sample: %v", err)
	}
	return NewRegistry("test", []*Descriptor{d})
}

// TestLookupDoesNotCrossContaminateAcrossChains verifies that when the SAME
// contract address is deployed on two different chains with two DIFFERENT
// descriptors, looking up on one chain never returns the other chain's
// descriptor. A cross-chain mix-up here would show the user a transaction
// description for the wrong protocol/contract.
func TestLookupDoesNotCrossContaminateAcrossChains(t *testing.T) {
	t.Helper()

	const sharedAddr = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"
	sig := "exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum) params)"
	sel := SelectorForSignature(sig)

	mainnetJSON := `{
	  "context": { "$id": "Uniswap v3 Router 2 (Ethereum)",
	    "contract": { "deployments": [{ "chainId": 1, "address": "` + sharedAddr + `" }] } },
	  "metadata": { "owner": "Uniswap Labs", "contractName": "Uniswap v3 Router 2" },
	  "display": { "formats": { "` + sig + `": {
	    "$id": "exactInput", "intent": "Swap on Ethereum",
	    "fields": [{ "path": "params.recipient", "label": "Beneficiary", "format": "addressName" }]
	  } } }
	}`

	// Same address, different chain, deliberately different metadata/intent so
	// the test can tell which descriptor was actually returned.
	polygonJSON := `{
	  "context": { "$id": "Impostor Contract (Polygon)",
	    "contract": { "deployments": [{ "chainId": 137, "address": "` + sharedAddr + `" }] } },
	  "metadata": { "owner": "Someone Else", "contractName": "Impostor Contract" },
	  "display": { "formats": { "` + sig + `": {
	    "$id": "exactInput", "intent": "Swap on Polygon",
	    "fields": [{ "path": "params.recipient", "label": "Beneficiary", "format": "addressName" }]
	  } } }
	}`

	mainnetDesc, err := ParseDescriptor([]byte(mainnetJSON))
	if err != nil {
		t.Fatalf("parse mainnet descriptor: %v", err)
	}
	polygonDesc, err := ParseDescriptor([]byte(polygonJSON))
	if err != nil {
		t.Fatalf("parse polygon descriptor: %v", err)
	}

	r := NewRegistry("test", []*Descriptor{mainnetDesc, polygonDesc})

	fmt1, desc1, ok := r.Lookup(1, sharedAddr, sel)
	if !ok {
		t.Fatal("chain 1 lookup should resolve")
	}
	if desc1.Metadata.Owner != "Uniswap Labs" {
		t.Errorf("chain 1 lookup returned wrong descriptor: owner = %q, want Uniswap Labs", desc1.Metadata.Owner)
	}
	if fmt1.Intent != "Swap on Ethereum" {
		t.Errorf("chain 1 lookup returned wrong format: intent = %q, want %q", fmt1.Intent, "Swap on Ethereum")
	}

	fmt2, desc2, ok := r.Lookup(137, sharedAddr, sel)
	if !ok {
		t.Fatal("chain 137 lookup should resolve")
	}
	if desc2.Metadata.Owner != "Someone Else" {
		t.Errorf("chain 137 lookup returned wrong descriptor: owner = %q, want Someone Else", desc2.Metadata.Owner)
	}
	if fmt2.Intent != "Swap on Polygon" {
		t.Errorf("chain 137 lookup returned wrong format: intent = %q, want %q", fmt2.Intent, "Swap on Polygon")
	}

	// A third, unrelated chain must still miss even though the address matches.
	if _, _, ok := r.Lookup(56, sharedAddr, sel); ok {
		t.Error("chain 56 lookup should miss — address only deployed on chains 1 and 137")
	}
}
