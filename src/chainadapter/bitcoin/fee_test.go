// Package bitcoin - Unit tests for fee estimation
package bitcoin

import (
	"context"
	"encoding/json"
	"math/big"
	"testing"
	"time"

	"github.com/arcsign/chainadapter"
	"github.com/arcsign/chainadapter/rpc"
)

// MockRPCClient for fee estimator testing
type MockFeeRPCClient struct {
	responses map[string]interface{}
}

func NewMockFeeRPCClient() *MockFeeRPCClient {
	return &MockFeeRPCClient{
		responses: make(map[string]interface{}),
	}
}

func (m *MockFeeRPCClient) SetResponse(method string, response interface{}) {
	m.responses[method] = response
}

func (m *MockFeeRPCClient) Call(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	if response, ok := m.responses[method]; ok {
		data, _ := json.Marshal(response)
		return data, nil
	}
	return nil, chainadapter.NewRetryableError(
		chainadapter.ErrCodeRPCUnavailable,
		"mock RPC method not configured: "+method,
		nil,
		nil,
	)
}

func (m *MockFeeRPCClient) CallBatch(ctx context.Context, requests []rpc.RPCRequest) ([]json.RawMessage, error) {
	return nil, nil
}

func (m *MockFeeRPCClient) Close() error {
	return nil
}

// T041: Unit test Bitcoin fee estimator with mock RPC
func TestBitcoinFeeEstimator_Estimate_Success(t *testing.T) {
	ctx := context.Background()

	// Create mock RPC client
	mockRPC := NewMockFeeRPCClient()

	// Configure estimatesmartfee responses
	mockRPC.SetResponse("estimatesmartfee", map[string]interface{}{
		"feerate": 0.00002, // 20 sat/byte in BTC/KB = 2000 sat/KB = 20 sat/vbyte
		"blocks":  3,
	})
	mockRPC.SetResponse("getblockcount", 700000)

	// Create RPC helper and fee estimator
	rpcHelper := NewRPCHelper(mockRPC)
	feeEstimator := NewFeeEstimator(rpcHelper, "testnet3")

	testCases := []struct {
		name              string
		feeSpeed          chainadapter.FeeSpeed
		expectedBlocks    int
		minTargetBlocks   int
		maxTargetBlocks   int
	}{
		{
			name:            "Fast",
			feeSpeed:        chainadapter.FeeSpeedFast,
			expectedBlocks:  1,
			minTargetBlocks: 2,  // targetBlocks * 2
			maxTargetBlocks: 1,  // targetBlocks / 2 + 1
		},
		{
			name:            "Normal",
			feeSpeed:        chainadapter.FeeSpeedNormal,
			expectedBlocks:  3,
			minTargetBlocks: 6,  // targetBlocks * 2
			maxTargetBlocks: 2,  // targetBlocks / 2 + 1
		},
		{
			name:            "Slow",
			feeSpeed:        chainadapter.FeeSpeedSlow,
			expectedBlocks:  6,
			minTargetBlocks: 12, // targetBlocks * 2
			maxTargetBlocks: 4,  // targetBlocks / 2 + 1
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := &chainadapter.TransactionRequest{
				From:     "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
				To:       "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7",
				Asset:    "BTC",
				Amount:   big.NewInt(100000),
				FeeSpeed: tc.feeSpeed,
			}

			estimate, err := feeEstimator.Estimate(ctx, req)
			if err != nil {
				t.Fatalf("Estimate() failed: %v", err)
			}

			// Verify estimate is not nil
			if estimate == nil {
				t.Fatal("Estimate returned nil")
			}

			// Verify ChainID
			if estimate.ChainID != "bitcoin" {
				t.Errorf("Expected ChainID 'bitcoin', got '%s'", estimate.ChainID)
			}

			// Verify EstimatedBlocks
			if estimate.EstimatedBlocks != tc.expectedBlocks {
				t.Errorf("Expected EstimatedBlocks %d, got %d", tc.expectedBlocks, estimate.EstimatedBlocks)
			}

			// Verify all fees are positive
			if estimate.MinFee.Sign() <= 0 {
				t.Error("MinFee must be positive")
			}
			if estimate.Recommended.Sign() <= 0 {
				t.Error("Recommended must be positive")
			}
			if estimate.MaxFee.Sign() <= 0 {
				t.Error("MaxFee must be positive")
			}

			// Verify fee ordering
			if estimate.MinFee.Cmp(estimate.Recommended) > 0 {
				t.Errorf("MinFee (%s) > Recommended (%s)", estimate.MinFee, estimate.Recommended)
			}
			if estimate.Recommended.Cmp(estimate.MaxFee) > 0 {
				t.Errorf("Recommended (%s) > MaxFee (%s)", estimate.Recommended, estimate.MaxFee)
			}

			// Verify confidence is in valid range
			if estimate.Confidence < 0 || estimate.Confidence > 100 {
				t.Errorf("Confidence %d out of range [0, 100]", estimate.Confidence)
			}

			// Verify Reason is not empty
			if estimate.Reason == "" {
				t.Error("Reason should not be empty")
			}

			// Verify Timestamp is recent (within 1 second)
			if time.Since(estimate.Timestamp) > time.Second {
				t.Error("Timestamp should be recent")
			}

			// Verify BaseFee is nil for Bitcoin (UTXO-based)
			if estimate.BaseFee != nil {
				t.Error("BaseFee should be nil for Bitcoin")
			}
		})
	}
}

// T043: Unit test Bitcoin Estimate() with various network conditions
func TestBitcoinFeeEstimator_Estimate_RPCFailure(t *testing.T) {
	ctx := context.Background()

	// Create mock RPC that always fails
	mockRPC := NewMockFeeRPCClient()
	// Don't configure any responses - RPC will fail

	rpcHelper := NewRPCHelper(mockRPC)
	feeEstimator := NewFeeEstimator(rpcHelper, "mainnet")

	req := &chainadapter.TransactionRequest{
		From:     "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
		To:       "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3",
		Asset:    "BTC",
		Amount:   big.NewInt(100000),
		FeeSpeed: chainadapter.FeeSpeedNormal,
	}

	// When RPC fails, Estimate should return fallback estimate
	estimate, err := feeEstimator.Estimate(ctx, req)
	if err != nil {
		t.Fatalf("Estimate() should not fail, should return fallback: %v", err)
	}

	// Verify fallback estimate properties
	if estimate == nil {
		t.Fatal("Estimate returned nil")
	}

	if estimate.Confidence != 50 {
		t.Errorf("Fallback estimate should have confidence 50, got %d", estimate.Confidence)
	}

	if estimate.Reason != "Using fallback estimates (RPC unavailable)" {
		t.Errorf("Unexpected reason: %s", estimate.Reason)
	}

	// Verify fees are positive
	if estimate.MinFee.Sign() <= 0 || estimate.Recommended.Sign() <= 0 || estimate.MaxFee.Sign() <= 0 {
		t.Error("Fallback fees must be positive")
	}
}

func TestBitcoinFeeEstimator_FallbackEstimate(t *testing.T) {
	mockRPC := NewMockFeeRPCClient()
	rpcHelper := NewRPCHelper(mockRPC)
	feeEstimator := NewFeeEstimator(rpcHelper, "mainnet")

	testCases := []struct {
		name                string
		feeSpeed            chainadapter.FeeSpeed
		expectedFeeRate     int64
		expectedBlocks      int
	}{
		{
			name:            "Fast fallback",
			feeSpeed:        chainadapter.FeeSpeedFast,
			expectedFeeRate: 50, // 50 sat/byte
			expectedBlocks:  1,
		},
		{
			name:            "Normal fallback",
			feeSpeed:        chainadapter.FeeSpeedNormal,
			expectedFeeRate: 20, // 20 sat/byte
			expectedBlocks:  3,
		},
		{
			name:            "Slow fallback",
			feeSpeed:        chainadapter.FeeSpeedSlow,
			expectedFeeRate: 10, // 10 sat/byte
			expectedBlocks:  6,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			fallback := feeEstimator.fallbackEstimate(tc.feeSpeed)

			// Verify EstimatedBlocks
			if fallback.EstimatedBlocks != tc.expectedBlocks {
				t.Errorf("Expected EstimatedBlocks %d, got %d", tc.expectedBlocks, fallback.EstimatedBlocks)
			}

			// Verify Confidence is 50 (low)
			if fallback.Confidence != 50 {
				t.Errorf("Expected Confidence 50, got %d", fallback.Confidence)
			}

			// Verify Reason
			if fallback.Reason != "Using fallback estimates (RPC unavailable)" {
				t.Errorf("Unexpected reason: %s", fallback.Reason)
			}

			// Verify recommended fee matches expected rate
			// expectedFee = feeRate * estimatedSize (140 vbytes)
			expectedRecommended := big.NewInt(tc.expectedFeeRate * 140)
			if fallback.Recommended.Cmp(expectedRecommended) != 0 {
				t.Errorf("Expected Recommended %s, got %s", expectedRecommended, fallback.Recommended)
			}

			// Verify min/max bounds
			expectedMin := big.NewInt(tc.expectedFeeRate * 80 / 100 * 140)
			expectedMax := big.NewInt(tc.expectedFeeRate * 150 / 100 * 140)

			if fallback.MinFee.Cmp(expectedMin) != 0 {
				t.Errorf("Expected MinFee %s, got %s", expectedMin, fallback.MinFee)
			}
			if fallback.MaxFee.Cmp(expectedMax) != 0 {
				t.Errorf("Expected MaxFee %s, got %s", expectedMax, fallback.MaxFee)
			}
		})
	}
}

func TestBitcoinFeeEstimator_CalculateConfidence(t *testing.T) {
	mockRPC := NewMockFeeRPCClient()
	rpcHelper := NewRPCHelper(mockRPC)
	feeEstimator := NewFeeEstimator(rpcHelper, "mainnet")

	testCases := []struct {
		name             string
		minRate          int64
		recommended      int64
		maxRate          int64
		expectedMinConf  int
		expectedMaxConf  int
	}{
		{
			name:            "Narrow spread - high confidence",
			minRate:         19, // 5% below
			recommended:     20,
			maxRate:         21, // 5% above
			expectedMinConf: 90, // Should be high
			expectedMaxConf: 100,
		},
		{
			name:            "Wide spread - lower confidence",
			minRate:         10, // 50% below
			recommended:     20,
			maxRate:         30, // 50% above
			expectedMinConf: 50, // Should be lower
			expectedMaxConf: 60,
		},
		{
			name:            "Zero recommended - default confidence",
			minRate:         0,
			recommended:     0,
			maxRate:         0,
			expectedMinConf: 50,
			expectedMaxConf: 50,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			confidence := feeEstimator.calculateConfidence(tc.minRate, tc.recommended, tc.maxRate)

			if confidence < tc.expectedMinConf || confidence > tc.expectedMaxConf {
				t.Errorf("Expected confidence in range [%d, %d], got %d",
					tc.expectedMinConf, tc.expectedMaxConf, confidence)
			}

			// Verify confidence is always clamped to [50, 100]
			if confidence < 50 || confidence > 100 {
				t.Errorf("Confidence %d out of range [50, 100]", confidence)
			}
		})
	}
}

func TestBitcoinFeeEstimator_GenerateReason(t *testing.T) {
	mockRPC := NewMockFeeRPCClient()
	rpcHelper := NewRPCHelper(mockRPC)
	feeEstimator := NewFeeEstimator(rpcHelper, "mainnet")

	testCases := []struct {
		name            string
		confidence      int
		feeRate         int64
		expectedContain string
	}{
		{
			name:            "High confidence",
			confidence:      95,
			feeRate:         20,
			expectedContain: "Network stable",
		},
		{
			name:            "Medium confidence",
			confidence:      75,
			feeRate:         20,
			expectedContain: "Network conditions normal",
		},
		{
			name:            "Low confidence",
			confidence:      55,
			feeRate:         20,
			expectedContain: "Network volatile",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			reason := feeEstimator.generateReason(tc.confidence, tc.feeRate)

			if reason == "" {
				t.Error("Reason should not be empty")
			}

			// Check if reason contains expected substring
			if len(tc.expectedContain) > 0 {
				found := false
				for i := 0; i <= len(reason)-len(tc.expectedContain); i++ {
					if reason[i:i+len(tc.expectedContain)] == tc.expectedContain {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("Reason '%s' should contain '%s'", reason, tc.expectedContain)
				}
			}
		})
	}
}

func TestBitcoinFeeEstimator_EstimateWithUTXOs(t *testing.T) {
	ctx := context.Background()

	mockRPC := NewMockFeeRPCClient()
	mockRPC.SetResponse("estimatesmartfee", map[string]interface{}{
		"feerate": 0.0002, // 20 sat/byte (0.0002 BTC/KB = 20000 sat/KB = 20 sat/byte)
		"blocks":  3,
	})
	mockRPC.SetResponse("getblockcount", 700000)

	rpcHelper := NewRPCHelper(mockRPC)
	feeEstimator := NewFeeEstimator(rpcHelper, "mainnet")

	req := &chainadapter.TransactionRequest{
		From:     "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
		To:       "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3",
		Asset:    "BTC",
		Amount:   big.NewInt(100000),
		FeeSpeed: chainadapter.FeeSpeedNormal,
	}

	// Test with 2 UTXOs
	utxos := []UTXO{
		{TxID: "tx1", Vout: 0, Amount: 50000, ScriptPubKey: []byte("script1")},
		{TxID: "tx2", Vout: 1, Amount: 60000, ScriptPubKey: []byte("script2")},
	}

	estimate, err := feeEstimator.EstimateWithUTXOs(ctx, req, utxos)
	if err != nil {
		t.Fatalf("EstimateWithUTXOs() failed: %v", err)
	}

	// Verify estimate is not nil
	if estimate == nil {
		t.Fatal("Estimate returned nil")
	}

	// With 2 inputs and 2 outputs, size = 10 + 2*68 + 2*31 = 208 vbytes
	// This is larger than the default 140 vbytes, so fees should be proportionally higher

	// Verify fees are positive
	if estimate.Recommended.Sign() <= 0 {
		t.Error("Recommended fee must be positive")
	}

	// The fee should be higher than for a single-input transaction
	// (approximately 208/140 = 1.49x higher)
	// Expected fee ~= 20 sat/byte * 208 vbytes = 4160 satoshis
	expectedApprox := big.NewInt(4000) // Allow some margin
	if estimate.Recommended.Cmp(expectedApprox) < 0 {
		t.Errorf("With 2 UTXOs, expected fee >= %s, got %s", expectedApprox, estimate.Recommended)
	}
}

func TestBitcoinFeeEstimator_SubscribeFeeUpdates(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	mockRPC := NewMockFeeRPCClient()
	mockRPC.SetResponse("estimatesmartfee", map[string]interface{}{
		"feerate": 0.00002,
		"blocks":  3,
	})
	mockRPC.SetResponse("getblockcount", 700000)

	rpcHelper := NewRPCHelper(mockRPC)
	feeEstimator := NewFeeEstimator(rpcHelper, "mainnet")

	req := &chainadapter.TransactionRequest{
		From:     "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
		To:       "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3",
		Asset:    "BTC",
		Amount:   big.NewInt(100000),
		FeeSpeed: chainadapter.FeeSpeedNormal,
	}

	// Subscribe with short poll interval for testing
	estimateChan, err := feeEstimator.SubscribeFeeUpdates(ctx, req, 100*time.Millisecond)
	if err != nil {
		t.Fatalf("SubscribeFeeUpdates() failed: %v", err)
	}

	// Should receive initial estimate immediately
	select {
	case estimate := <-estimateChan:
		if estimate == nil {
			t.Error("Received nil estimate")
		}
		if estimate.Recommended.Sign() <= 0 {
			t.Error("Initial estimate should have positive recommended fee")
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("Did not receive initial estimate within 500ms")
	}

	// Cancel context
	cancel()

	// Channel should close
	select {
	case _, ok := <-estimateChan:
		if ok {
			t.Error("Channel should be closed after context cancellation")
		}
	case <-time.After(1 * time.Second):
		t.Error("Channel not closed after context cancellation")
	}
}
