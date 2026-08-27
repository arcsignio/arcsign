package clearsign

import "testing"

func TestResolveProducesLabelledFields(t *testing.T) {
	r := newTestRegistry(t)
	sel := SelectorForSignature(
		"exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum) params)")

	decoded := map[string]any{
		"params": map[string]any{
			"amountIn":  "1500000",
			"recipient": "0xAbC0000000000000000000000000000000000001",
			"path": "0x" +
				"1111111111111111111111111111111111111111" +
				"0001f4" +
				"2222222222222222222222222222222222222222",
		},
	}

	got, ok := r.Resolve(1, "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", sel, decoded, stubLookup)
	if !ok {
		t.Fatal("resolve should succeed for a known descriptor")
	}
	if got.Intent != "Swap" {
		t.Errorf("intent = %q, want Swap", got.Intent)
	}
	if got.Owner != "Uniswap Labs" {
		t.Errorf("owner = %q, want Uniswap Labs", got.Owner)
	}
	if len(got.Fields) != 2 {
		t.Fatalf("fields = %d, want 2", len(got.Fields))
	}
	if got.Fields[0].Label != "Amount to Send" {
		t.Errorf("field[0].Label = %q", got.Fields[0].Label)
	}
	if got.Fields[0].Value != "1.5 USDC" {
		t.Errorf("field[0].Value = %q, want 1.5 USDC", got.Fields[0].Value)
	}
	if got.Fields[1].Value != "0xAbC0...0001" {
		t.Errorf("field[1].Value = %q", got.Fields[1].Value)
	}
}

func TestResolveMissesUnknownContract(t *testing.T) {
	r := newTestRegistry(t)
	if _, ok := r.Resolve(1, "0x0000000000000000000000000000000000000000", "0xdeadbeef",
		map[string]any{}, stubLookup); ok {
		t.Error("unknown contract must not resolve")
	}
}

func TestResolveFailsWhenAFieldCannotBeRendered(t *testing.T) {
	// A descriptor whose field path is absent from the decoded calldata must
	// fail the whole resolve, so the caller falls back to the existing decoder
	// rather than showing a half-populated (and therefore misleading) summary.
	r := newTestRegistry(t)
	sel := SelectorForSignature(
		"exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum) params)")

	if _, ok := r.Resolve(1, "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", sel,
		map[string]any{"params": map[string]any{}}, stubLookup); ok {
		t.Error("missing field data must fail resolve, not render partially")
	}
}

// --- 補充測試：驗證「全有全無」在更細的情境下也成立 ---

// TestResolveFailsOnSecondOfThreeFields verifies the all-or-nothing guarantee
// with a descriptor where the FIRST field resolves fine but the SECOND does
// not. This rules out an implementation that accumulates fields and only
// checks the very last one, or that returns whatever was collected so far
// instead of discarding it on failure.
func TestResolveFailsOnSecondOfThreeFields(t *testing.T) {
	const addr = "0x1234567890123456789012345678901234567890"
	sig := "approve(address spender, uint256 amount, uint256 deadline)"
	sel := SelectorForSignature(sig)

	descJSON := `{
	  "context": { "$id": "ThreeFieldTest",
	    "contract": { "deployments": [{ "chainId": 1, "address": "` + addr + `" }] } },
	  "metadata": { "owner": "Test Owner", "contractName": "Test Contract" },
	  "display": { "formats": { "` + sig + `": {
	    "$id": "approve", "intent": "Approve",
	    "fields": [
	      { "path": "spender", "label": "Spender", "format": "addressName" },
	      { "path": "missingField", "label": "Missing", "format": "raw" },
	      { "path": "deadline", "label": "Deadline", "format": "date" }
	    ]
	  } } }
	}`
	d, err := ParseDescriptor([]byte(descJSON))
	if err != nil {
		t.Fatalf("parse descriptor: %v", err)
	}
	r := NewRegistry("test", []*Descriptor{d})

	decoded := map[string]any{
		"spender":  "0xAbC0000000000000000000000000000000000001",
		"amount":   "100",
		"deadline": "1700000000",
		// "missingField" deliberately absent.
	}

	got, ok := r.Resolve(1, addr, sel, decoded, stubLookup)
	if ok {
		t.Fatalf("resolve must fail when field[1]'s path is missing, got fields=%+v", got)
	}
	if got != nil {
		t.Errorf("failed resolve must return nil intent, got %+v", got)
	}
}

// TestResolveFailsOnUnsupportedFormat verifies that a field using a format
// FormatValue does not implement (e.g. "nftName") fails the whole resolve,
// not just that one field.
func TestResolveFailsOnUnsupportedFormat(t *testing.T) {
	const addr = "0x1234567890123456789012345678901234567890"
	sig := "mint(uint256 tokenId, string name)"
	sel := SelectorForSignature(sig)

	descJSON := `{
	  "context": { "$id": "NftFormatTest",
	    "contract": { "deployments": [{ "chainId": 1, "address": "` + addr + `" }] } },
	  "metadata": { "owner": "Test Owner", "contractName": "Test Contract" },
	  "display": { "formats": { "` + sig + `": {
	    "$id": "mint", "intent": "Mint",
	    "fields": [
	      { "path": "name", "label": "Name", "format": "nftName" }
	    ]
	  } } }
	}`
	d, err := ParseDescriptor([]byte(descJSON))
	if err != nil {
		t.Fatalf("parse descriptor: %v", err)
	}
	r := NewRegistry("test", []*Descriptor{d})

	decoded := map[string]any{"tokenId": "1", "name": "MyNFT"}

	if got, ok := r.Resolve(1, addr, sel, decoded, stubLookup); ok {
		t.Fatalf("resolve must fail on unsupported format, got %+v", got)
	}
}

// TestResolveSkipsNeverVisibleFieldWithoutAffectingOthers verifies that a
// "visible": "never" field is skipped entirely — its path/format are never
// evaluated — while the remaining visible fields still resolve normally.
func TestResolveSkipsNeverVisibleFieldWithoutAffectingOthers(t *testing.T) {
	const addr = "0x1234567890123456789012345678901234567890"
	sig := "swap(address recipient, uint256 amount, bytes32 secret)"
	sel := SelectorForSignature(sig)

	descJSON := `{
	  "context": { "$id": "HiddenFieldTest",
	    "contract": { "deployments": [{ "chainId": 1, "address": "` + addr + `" }] } },
	  "metadata": { "owner": "Test Owner", "contractName": "Test Contract" },
	  "display": { "formats": { "` + sig + `": {
	    "$id": "swap", "intent": "Swap",
	    "fields": [
	      { "path": "recipient", "label": "Recipient", "format": "addressName" },
	      { "path": "secret", "label": "Secret", "format": "nftName", "visible": "never" }
	    ]
	  } } }
	}`
	d, err := ParseDescriptor([]byte(descJSON))
	if err != nil {
		t.Fatalf("parse descriptor: %v", err)
	}
	r := NewRegistry("test", []*Descriptor{d})

	// "secret" is intentionally absent from decoded AND uses an unsupported
	// format ("nftName") — if the hidden field were evaluated at all, this
	// would fail resolve either on the missing path or the bad format.
	decoded := map[string]any{
		"recipient": "0xAbC0000000000000000000000000000000000001",
		"amount":    "100",
	}

	got, ok := r.Resolve(1, addr, sel, decoded, stubLookup)
	if !ok {
		t.Fatal("resolve should succeed: the only failing field is visible=never and must be skipped")
	}
	if len(got.Fields) != 1 {
		t.Fatalf("fields = %d, want 1 (hidden field must not appear)", len(got.Fields))
	}
	if got.Fields[0].Label != "Recipient" {
		t.Errorf("field[0].Label = %q, want Recipient", got.Fields[0].Label)
	}
}
