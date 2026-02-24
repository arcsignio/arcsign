package constants

import "testing"

func TestWalletLimit_FreeUser(t *testing.T) {
	limit := WalletLimit(0)
	if limit != 1 {
		t.Errorf("WalletLimit(0): got %d, want 1", limit)
	}
}

func TestWalletLimit_SingleNFT(t *testing.T) {
	limit := WalletLimit(1)
	if limit != 4 {
		t.Errorf("WalletLimit(1): got %d, want 4", limit)
	}
}

func TestWalletLimit_MultipleNFTs(t *testing.T) {
	limit := WalletLimit(3)
	if limit != 10 {
		t.Errorf("WalletLimit(3): got %d, want 10", limit)
	}
}

func TestWalletLimit_Formula(t *testing.T) {
	tests := []struct {
		nftCount int
		expected int
	}{
		{0, 1},
		{1, 4},
		{2, 7},
		{3, 10},
		{5, 16},
		{10, 31},
	}

	for _, tt := range tests {
		result := WalletLimit(tt.nftCount)
		if result != tt.expected {
			t.Errorf("WalletLimit(%d): got %d, want %d", tt.nftCount, result, tt.expected)
		}
	}
}

func TestWalletLimitFree_Constant(t *testing.T) {
	if WalletLimitFree != 1 {
		t.Errorf("WalletLimitFree: got %d, want 1", WalletLimitFree)
	}
}

func TestWalletLimitPerNFT_Constant(t *testing.T) {
	if WalletLimitPerNFT != 3 {
		t.Errorf("WalletLimitPerNFT: got %d, want 3", WalletLimitPerNFT)
	}
}
