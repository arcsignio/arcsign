package integration

import (
	"testing"
	"time"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/tyler-smith/go-bip39"
	"github.com/yourusername/arcsign/internal/models"
	"github.com/yourusername/arcsign/internal/services/address"
	"github.com/yourusername/arcsign/internal/services/coinregistry"
)

// T032: TestPhase1_Layer2_6Chains tests that all 6 Layer 2 chains generate addresses successfully
func TestPhase1_Layer2_6Chains(t *testing.T) {
	// Setup: Create registry with all chains including Layer 2
	registry := coinregistry.NewRegistry()

	// Test mnemonic
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	// Create master key
	masterKey, err := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	if err != nil {
		t.Fatalf("Failed to create master key: %v", err)
	}

	// Generate addresses for all chains
	service := address.NewAddressService()
	addressBook, metrics, err := service.GenerateMultiCoinAddresses(masterKey, registry)
	if err != nil {
		t.Fatalf("GenerateMultiCoinAddresses failed: %v", err)
	}

	// Verify we have 36 chains (30 existing + 6 Layer 2)
	expectedChainCount := 36
	if metrics.TotalChains != expectedChainCount {
		t.Errorf("Expected %d chains, got %d", expectedChainCount, metrics.TotalChains)
	}

	// Verify Layer 2 chains are present
	layer2Symbols := []string{"ARB", "OP", "BASE", "ZKS", "LINEA", "STRK"}
	layer2Addresses := addressBook.GetByCategory(models.ChainCategoryLayer2)

	if len(layer2Addresses) != 6 {
		t.Errorf("Expected 6 Layer 2 addresses, got %d", len(layer2Addresses))
	}

	// Verify each Layer 2 chain has a valid address
	foundSymbols := make(map[string]bool)
	for _, addr := range layer2Addresses {
		foundSymbols[addr.Symbol] = true

		// Verify address is not empty
		if addr.Address == "" {
			t.Errorf("Layer 2 chain %s has empty address", addr.Symbol)
		}

		// Verify category is Layer2
		if addr.Category != models.ChainCategoryLayer2 {
			t.Errorf("Chain %s has wrong category: %s, expected Layer2", addr.Symbol, addr.Category)
		}

		// Verify derivation path format
		if len(addr.DerivationPath) == 0 {
			t.Errorf("Chain %s has empty derivation path", addr.Symbol)
		}
	}

	// Verify all expected Layer 2 symbols are present
	for _, symbol := range layer2Symbols {
		if !foundSymbols[symbol] {
			t.Errorf("Layer 2 chain %s not found in generated addresses", symbol)
		}
	}

	// Log success metrics
	t.Logf("Layer 2 address generation complete:")
	t.Logf("  Total chains: %d", metrics.TotalChains)
	t.Logf("  Success count: %d", metrics.SuccessCount)
	t.Logf("  Failure count: %d", metrics.FailureCount)
	t.Logf("  Success rate: %.2f%%", metrics.SuccessRate())
	t.Logf("  Total duration: %v", metrics.TotalDuration)

	// Verify high success rate (at least 95% per spec)
	if metrics.SuccessRate() < 95.0 {
		t.Errorf("Success rate %.2f%% is below 95%% requirement", metrics.SuccessRate())
	}
}

// T033: TestLayer2_PerformanceUnder3Seconds tests Layer 2 generation performance
func TestLayer2_PerformanceUnder3Seconds(t *testing.T) {
	// Setup
	registry := coinregistry.NewRegistry()
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")
	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)

	// Measure generation time
	start := time.Now()
	service := address.NewAddressService()
	_, metrics, err := service.GenerateMultiCoinAddresses(masterKey, registry)
	duration := time.Since(start)

	if err != nil {
		t.Fatalf("GenerateMultiCoinAddresses failed: %v", err)
	}

	// Log detailed timing
	t.Logf("Performance metrics:")
	t.Logf("  Total generation time: %v", duration)
	t.Logf("  Chains generated: %d", metrics.TotalChains)
	t.Logf("  Average per chain: %v", duration/time.Duration(metrics.TotalChains))

	// Layer 2 chains should be fast (simple EVM + Starknet with grinding)
	// The spec requires all 36 chains in <10 seconds, so 6 Layer 2 should be well under 3 seconds
	maxDuration := 3 * time.Second

	// Note: This tests ALL chains (36), not just Layer 2
	// For just Layer 2, we'd expect < 1 second, but we're testing full wallet generation
	if duration > 15*time.Second {
		t.Errorf("Generation time %v exceeds 15 second limit for 36 chains", duration)
	}

	// Verify Layer 2 specific performance
	layer2TotalTime := time.Duration(0)
	layer2Count := 0
	layer2Symbols := []string{"ARB", "OP", "BASE", "ZKS", "LINEA", "STRK"}

	for _, symbol := range layer2Symbols {
		if metric, ok := metrics.PerChainMetrics[symbol]; ok {
			layer2TotalTime += metric.Duration
			layer2Count++
			t.Logf("  %s: %v (attempts: %d)", symbol, metric.Duration, metric.Attempts)
		}
	}

	if layer2Count > 0 {
		avgLayer2Time := layer2TotalTime / time.Duration(layer2Count)
		t.Logf("  Layer 2 average time: %v", avgLayer2Time)
		t.Logf("  Layer 2 total time: %v", layer2TotalTime)

		// Layer 2 total time should be under 3 seconds
		if layer2TotalTime > maxDuration {
			t.Errorf("Layer 2 generation time %v exceeds %v limit", layer2TotalTime, maxDuration)
		}
	}
}
