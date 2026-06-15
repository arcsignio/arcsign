// Package bitcoin - Unit tests for UTXO selection
package bitcoin

import (
	"testing"
)

// TestSelectUTXOs_LargestFirst verifies that UTXO selection follows the
// largest-first strategy documented in selectUTXOs, regardless of the order
// the UTXOs arrive in from the provider.
//
// Regression: previously selectUTXOs iterated the input slice in arrival
// order without sorting, so the result depended on provider ordering and
// could pull in many small UTXOs (higher fees, more fragmentation).
func TestSelectUTXOs_LargestFirst(t *testing.T) {
	tb := &TransactionBuilder{}

	// UTXOs deliberately out of order, with one large UTXO that on its own
	// covers the target plus fees.
	utxos := []UTXO{
		{TxID: "small-a", Vout: 0, Amount: 1_000},
		{TxID: "small-b", Vout: 0, Amount: 2_000},
		{TxID: "large", Vout: 0, Amount: 5_000_000},
		{TxID: "small-c", Vout: 0, Amount: 3_000},
	}

	// amount well within the single large UTXO once fees are covered
	const amount = 100_000
	const feeRate = 1 // sat/byte

	selected, _, err := tb.selectUTXOs(utxos, amount, feeRate)
	if err != nil {
		t.Fatalf("selectUTXOs returned error: %v", err)
	}

	// Largest-first: the first selected UTXO must be the largest one.
	if len(selected) == 0 {
		t.Fatal("expected at least one selected UTXO, got none")
	}
	if selected[0].TxID != "large" {
		t.Errorf("expected largest UTXO 'large' to be selected first, got %q", selected[0].TxID)
	}

	// The single large UTXO alone covers amount + fee, so selection should
	// stop at one input instead of dragging in the small dust UTXOs.
	if len(selected) != 1 {
		t.Errorf("expected exactly 1 UTXO selected (largest covers target), got %d: %+v", len(selected), selected)
	}
}

// TestSelectUTXOs_DoesNotMutateInput verifies that sorting happens on a copy
// and the caller's slice ordering is preserved.
func TestSelectUTXOs_DoesNotMutateInput(t *testing.T) {
	tb := &TransactionBuilder{}

	utxos := []UTXO{
		{TxID: "a", Vout: 0, Amount: 1_000},
		{TxID: "b", Vout: 0, Amount: 5_000_000},
		{TxID: "c", Vout: 0, Amount: 2_000},
	}
	originalOrder := []string{utxos[0].TxID, utxos[1].TxID, utxos[2].TxID}

	if _, _, err := tb.selectUTXOs(utxos, 100_000, 1); err != nil {
		t.Fatalf("selectUTXOs returned error: %v", err)
	}

	for i, want := range originalOrder {
		if utxos[i].TxID != want {
			t.Errorf("input slice was mutated at index %d: got %q, want %q", i, utxos[i].TxID, want)
		}
	}
}

// TestSelectUTXOs_InsufficientFunds verifies the error path is preserved.
func TestSelectUTXOs_InsufficientFunds(t *testing.T) {
	tb := &TransactionBuilder{}

	utxos := []UTXO{
		{TxID: "a", Vout: 0, Amount: 1_000},
		{TxID: "b", Vout: 0, Amount: 2_000},
	}

	if _, _, err := tb.selectUTXOs(utxos, 1_000_000, 1); err == nil {
		t.Fatal("expected insufficient funds error, got nil")
	}
}
