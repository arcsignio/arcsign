// Package contract - Contract tests for capability detection
package contract

import (
	"testing"

	"github.com/arcsign/chainadapter"
	"github.com/arcsign/chainadapter/bitcoin"
	"github.com/arcsign/chainadapter/ethereum"
	"github.com/arcsign/chainadapter/storage"
	"github.com/arcsign/chainadapter/tests/mocks"
)

// TC-015: Capabilities Accuracy
//
// Success Criteria:
// - Bitcoin returns {supportsEIP1559: false, supportsRBF: true}
// - Ethereum returns {supportsEIP1559: true, supportsMemo: true}
// - Unsupported capabilities return false without error
// - All capability fields are accurately populated

// TC-015: Bitcoin Capabilities Accuracy
func TestTC015_CapabilitiesAccuracy_Bitcoin(t *testing.T) {
	// Create Bitcoin adapter (testnet)
	mockRPC := mocks.NewMockRPCClient()
	stateStore := storage.NewMemoryTxStore()
	adapter, err := bitcoin.NewBitcoinAdapter(mockRPC, stateStore, "testnet3", nil)
	if err != nil {
		t.Fatalf("Failed to create Bitcoin adapter: %v", err)
	}

	// Get capabilities
	caps := adapter.Capabilities()
	if caps == nil {
		t.Fatal("Capabilities() returned nil")
	}

	// Verify ChainID
	if caps.ChainID != "bitcoin-testnet" {
		t.Errorf("Expected ChainID 'bitcoin-testnet', got '%s'", caps.ChainID)
	}

	// Verify InterfaceVersion
	if caps.InterfaceVersion == "" {
		t.Error("InterfaceVersion should not be empty")
	}

	// Verify Bitcoin does NOT support EIP-1559
	if caps.SupportsEIP1559 {
		t.Error("Bitcoin should not support EIP-1559")
	}

	// Verify Bitcoin supports memo (OP_RETURN)
	if !caps.SupportsMemo {
		t.Error("Bitcoin should support memo via OP_RETURN")
	}

	// Verify Bitcoin supports multi-sig
	if !caps.SupportsMultiSig {
		t.Error("Bitcoin should support multi-sig via P2SH/P2WSH")
	}

	// Verify Bitcoin does NOT support fee delegation
	if caps.SupportsFeeDelegation {
		t.Error("Bitcoin should not support fee delegation")
	}

	// Verify Bitcoin supports WebSocket (ZMQ)
	if !caps.SupportsWebSocket {
		t.Error("Bitcoin should support WebSocket via ZMQ")
	}

	// Verify Bitcoin supports RBF (Replace-By-Fee)
	if !caps.SupportsRBF {
		t.Error("Bitcoin should support RBF (BIP 125)")
	}

	// Verify MaxMemoLength is reasonable (OP_RETURN max is typically 80 bytes)
	if caps.MaxMemoLength == 0 {
		t.Error("Bitcoin MaxMemoLength should be > 0 (OP_RETURN supports up to 80 bytes)")
	}
	if caps.MaxMemoLength > 100 {
		t.Errorf("Bitcoin MaxMemoLength seems too large: %d (expected ~80)", caps.MaxMemoLength)
	}

	// Verify MinConfirmations is reasonable (Bitcoin typically uses 6)
	if caps.MinConfirmations == 0 {
		t.Error("Bitcoin MinConfirmations should be > 0")
	}
	if caps.MinConfirmations > 20 {
		t.Errorf("Bitcoin MinConfirmations seems too large: %d (expected ~6)", caps.MinConfirmations)
	}

	t.Logf("✓ Bitcoin Capabilities: EIP1559=%v, RBF=%v, Memo=%v, MaxMemoLen=%d, MinConf=%d",
		caps.SupportsEIP1559, caps.SupportsRBF, caps.SupportsMemo,
		caps.MaxMemoLength, caps.MinConfirmations)
}

// TC-015: Ethereum Capabilities Accuracy
func TestTC015_CapabilitiesAccuracy_Ethereum(t *testing.T) {
	// Create Ethereum adapter (mainnet)
	mockRPC := mocks.NewMockRPCClient()
	stateStore := storage.NewMemoryTxStore()
	adapter, err := ethereum.NewEthereumAdapter(mockRPC, stateStore, 1, nil)
	if err != nil {
		t.Fatalf("Failed to create Ethereum adapter: %v", err)
	}

	// Get capabilities
	caps := adapter.Capabilities()
	if caps == nil {
		t.Fatal("Capabilities() returned nil")
	}

	// Verify ChainID
	if caps.ChainID != "ethereum" {
		t.Errorf("Expected ChainID 'ethereum', got '%s'", caps.ChainID)
	}

	// Verify InterfaceVersion
	if caps.InterfaceVersion == "" {
		t.Error("InterfaceVersion should not be empty")
	}

	// Verify Ethereum DOES support EIP-1559 (post-London fork)
	if !caps.SupportsEIP1559 {
		t.Error("Ethereum should support EIP-1559 (post-London fork)")
	}

	// Verify Ethereum supports memo (data field)
	if !caps.SupportsMemo {
		t.Error("Ethereum should support memo via data field")
	}

	// Verify Ethereum supports multi-sig
	if !caps.SupportsMultiSig {
		t.Error("Ethereum should support multi-sig via smart contracts")
	}

	// Verify Ethereum supports fee delegation (meta-transactions)
	if !caps.SupportsFeeDelegation {
		t.Error("Ethereum should support fee delegation via meta-transactions (EIP-2771)")
	}

	// Verify Ethereum supports WebSocket
	if !caps.SupportsWebSocket {
		t.Error("Ethereum should support WebSocket")
	}

	// Verify Ethereum does NOT support RBF (uses nonce replacement instead)
	if caps.SupportsRBF {
		t.Error("Ethereum should not support RBF (uses nonce replacement)")
	}

	// Verify MaxMemoLength (Ethereum has no hard limit, constrained by gas)
	// MaxMemoLength may be 0 (unlimited) or a large number
	if caps.MaxMemoLength > 0 && caps.MaxMemoLength < 100 {
		t.Errorf("Ethereum MaxMemoLength seems too small: %d (expected 0 for unlimited or large value)", caps.MaxMemoLength)
	}

	// Verify MinConfirmations is reasonable (Ethereum typically uses 12-20)
	if caps.MinConfirmations == 0 {
		t.Error("Ethereum MinConfirmations should be > 0")
	}
	if caps.MinConfirmations > 50 {
		t.Errorf("Ethereum MinConfirmations seems too large: %d (expected ~12-20)", caps.MinConfirmations)
	}

	t.Logf("✓ Ethereum Capabilities: EIP1559=%v, RBF=%v, Memo=%v, MaxMemoLen=%d, MinConf=%d",
		caps.SupportsEIP1559, caps.SupportsRBF, caps.SupportsMemo,
		caps.MaxMemoLength, caps.MinConfirmations)
}

// TC-015: Capability Consistency Across Multiple Calls
func TestTC015_CapabilitiesAccuracy_Consistency(t *testing.T) {
	// Create Bitcoin adapter
	mockRPC := mocks.NewMockRPCClient()
	stateStore := storage.NewMemoryTxStore()
	btcAdapter, err := bitcoin.NewBitcoinAdapter(mockRPC, stateStore, "testnet3", nil)
	if err != nil {
		t.Fatalf("Failed to create Bitcoin adapter: %v", err)
	}

	// Call Capabilities() multiple times
	caps1 := btcAdapter.Capabilities()
	caps2 := btcAdapter.Capabilities()
	caps3 := btcAdapter.Capabilities()

	// Verify all fields are consistent
	if caps1.SupportsEIP1559 != caps2.SupportsEIP1559 || caps2.SupportsEIP1559 != caps3.SupportsEIP1559 {
		t.Error("SupportsEIP1559 is inconsistent across calls")
	}

	if caps1.SupportsRBF != caps2.SupportsRBF || caps2.SupportsRBF != caps3.SupportsRBF {
		t.Error("SupportsRBF is inconsistent across calls")
	}

	if caps1.SupportsMemo != caps2.SupportsMemo || caps2.SupportsMemo != caps3.SupportsMemo {
		t.Error("SupportsMemo is inconsistent across calls")
	}

	if caps1.MaxMemoLength != caps2.MaxMemoLength || caps2.MaxMemoLength != caps3.MaxMemoLength {
		t.Error("MaxMemoLength is inconsistent across calls")
	}

	if caps1.MinConfirmations != caps2.MinConfirmations || caps2.MinConfirmations != caps3.MinConfirmations {
		t.Error("MinConfirmations is inconsistent across calls")
	}

	t.Logf("✓ Capabilities are consistent across multiple calls")
}

// TC-015: Capabilities for Different Networks (Bitcoin Mainnet vs Testnet)
func TestTC015_CapabilitiesAccuracy_DifferentNetworks(t *testing.T) {
	mockRPC := mocks.NewMockRPCClient()
	stateStore := storage.NewMemoryTxStore()

	// Create Bitcoin testnet adapter
	testnetAdapter, err := bitcoin.NewBitcoinAdapter(mockRPC, stateStore, "testnet3", nil)
	if err != nil {
		t.Fatalf("Failed to create testnet adapter: %v", err)
	}

	// Create Bitcoin mainnet adapter
	mainnetAdapter, err := bitcoin.NewBitcoinAdapter(mockRPC, stateStore, "mainnet", nil)
	if err != nil {
		t.Fatalf("Failed to create mainnet adapter: %v", err)
	}

	testnetCaps := testnetAdapter.Capabilities()
	mainnetCaps := mainnetAdapter.Capabilities()

	// ChainID should differ
	if testnetCaps.ChainID == mainnetCaps.ChainID {
		t.Errorf("Testnet and mainnet should have different ChainIDs, both are '%s'", testnetCaps.ChainID)
	}

	// Feature flags should be the same (both Bitcoin)
	if testnetCaps.SupportsEIP1559 != mainnetCaps.SupportsEIP1559 {
		t.Error("SupportsEIP1559 should be same for testnet and mainnet")
	}

	if testnetCaps.SupportsRBF != mainnetCaps.SupportsRBF {
		t.Error("SupportsRBF should be same for testnet and mainnet")
	}

	if testnetCaps.SupportsMemo != mainnetCaps.SupportsMemo {
		t.Error("SupportsMemo should be same for testnet and mainnet")
	}

	t.Logf("✓ Testnet ChainID: %s, Mainnet ChainID: %s", testnetCaps.ChainID, mainnetCaps.ChainID)
}

// TC-015: Capabilities for Different Chains (Bitcoin vs Ethereum)
func TestTC015_CapabilitiesAccuracy_CrossChain(t *testing.T) {
	mockRPC := mocks.NewMockRPCClient()
	stateStore := storage.NewMemoryTxStore()

	// Create Bitcoin adapter
	btcAdapter, err := bitcoin.NewBitcoinAdapter(mockRPC, stateStore, "mainnet", nil)
	if err != nil {
		t.Fatalf("Failed to create Bitcoin adapter: %v", err)
	}

	// Create Ethereum adapter
	ethAdapter, err := ethereum.NewEthereumAdapter(mockRPC, stateStore, 1, nil)
	if err != nil {
		t.Fatalf("Failed to create Ethereum adapter: %v", err)
	}

	btcCaps := btcAdapter.Capabilities()
	ethCaps := ethAdapter.Capabilities()

	// Verify opposing capabilities
	if btcCaps.SupportsEIP1559 == ethCaps.SupportsEIP1559 {
		t.Errorf("Bitcoin and Ethereum should have opposite EIP-1559 support, both are %v", btcCaps.SupportsEIP1559)
	}

	if btcCaps.SupportsRBF == ethCaps.SupportsRBF {
		t.Errorf("Bitcoin and Ethereum should have opposite RBF support, both are %v", btcCaps.SupportsRBF)
	}

	// Verify expected values
	if btcCaps.SupportsEIP1559 {
		t.Error("Bitcoin should not support EIP-1559")
	}
	if !ethCaps.SupportsEIP1559 {
		t.Error("Ethereum should support EIP-1559")
	}

	if !btcCaps.SupportsRBF {
		t.Error("Bitcoin should support RBF")
	}
	if ethCaps.SupportsRBF {
		t.Error("Ethereum should not support RBF")
	}

	t.Logf("✓ Cross-chain capabilities verified:")
	t.Logf("  Bitcoin: EIP1559=%v, RBF=%v", btcCaps.SupportsEIP1559, btcCaps.SupportsRBF)
	t.Logf("  Ethereum: EIP1559=%v, RBF=%v", ethCaps.SupportsEIP1559, ethCaps.SupportsRBF)
}

// TC-015: Verify Capabilities Can Be Used for Dynamic Feature Toggling
func TestTC015_CapabilitiesAccuracy_DynamicFeatureToggling(t *testing.T) {
	mockRPC := mocks.NewMockRPCClient()
	stateStore := storage.NewMemoryTxStore()

	// Test with both adapters
	testCases := []struct {
		name      string
		adapter   chainadapter.ChainAdapter
		expectRBF bool
		expectEIP bool
	}{
		{
			name: "Bitcoin",
			adapter: func() chainadapter.ChainAdapter {
				a, _ := bitcoin.NewBitcoinAdapter(mockRPC, stateStore, "mainnet", nil)
				return a
			}(),
			expectRBF: true,
			expectEIP: false,
		},
		{
			name: "Ethereum",
			adapter: func() chainadapter.ChainAdapter {
				a, _ := ethereum.NewEthereumAdapter(mockRPC, stateStore, 1, nil)
				return a
			}(),
			expectRBF: false,
			expectEIP: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			caps := tc.adapter.Capabilities()

			// Simulate dynamic UI feature toggling
			var availableFeatures []string

			if caps.SupportsEIP1559 {
				availableFeatures = append(availableFeatures, "EIP-1559 Fees")
			}

			if caps.SupportsRBF {
				availableFeatures = append(availableFeatures, "Replace-By-Fee")
			}

			if caps.SupportsMemo {
				availableFeatures = append(availableFeatures, "Memo/Data Field")
			}

			if caps.SupportsMultiSig {
				availableFeatures = append(availableFeatures, "Multi-Signature")
			}

			// Verify expected features are present
			hasRBF := false
			hasEIP := false
			for _, feature := range availableFeatures {
				if feature == "Replace-By-Fee" {
					hasRBF = true
				}
				if feature == "EIP-1559 Fees" {
					hasEIP = true
				}
			}

			if hasRBF != tc.expectRBF {
				t.Errorf("Expected RBF=%v, got %v", tc.expectRBF, hasRBF)
			}

			if hasEIP != tc.expectEIP {
				t.Errorf("Expected EIP-1559=%v, got %v", tc.expectEIP, hasEIP)
			}

			t.Logf("✓ %s available features: %v", tc.name, availableFeatures)
		})
	}
}
