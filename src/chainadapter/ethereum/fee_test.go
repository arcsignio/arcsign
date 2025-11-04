// Package ethereum - Unit tests for fee estimation
package ethereum

import (
	"context"
	"encoding/json"
	"math/big"
	"testing"
	"time"

	"github.com/arcsign/chainadapter"
	"github.com/arcsign/chainadapter/rpc"
)

// MockFeeRPCClient for fee estimator testing
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

// T045: Unit test Ethereum fee estimator with mock RPC
func TestEthereumFeeEstimator_Estimate_Success(t *testing.T) {
	ctx := context.Background()

	// Create mock RPC client
	mockRPC := NewMockFeeRPCClient()

	// Configure mock responses for eth_getBlockByNumber (base fee)
	mockRPC.SetResponse("eth_getBlockByNumber", map[string]interface{}{
		"baseFeePerGas": "0x4a817c800", // 20 Gwei in hex (20 * 1e9)
		"number":        "0x1234",
	})

	// Configure mock responses for eth_feeHistory (priority fee)
	mockRPC.SetResponse("eth_feeHistory", map[string]interface{}{
		"reward": [][]string{
			{"0x77359400"}, // 2 Gwei in hex (2 * 1e9)
		},
	})

	// Create RPC helper and fee estimator
	rpcHelper := NewRPCHelper(mockRPC)
	feeEstimator := NewFeeEstimator(rpcHelper, 1) // Mainnet chainID

	testCases := []struct {
		name             string
		feeSpeed         chainadapter.FeeSpeed
		expectedBlocks   int
		baseMultiplier   int64
		priorityMult     int64
	}{
		{
			name:           "Fast",
			feeSpeed:       chainadapter.FeeSpeedFast,
			expectedBlocks: 1,
			baseMultiplier: 3, // 3x base fee
			priorityMult:   3, // 3x priority fee
		},
		{
			name:           "Normal",
			feeSpeed:       chainadapter.FeeSpeedNormal,
			expectedBlocks: 3,
			baseMultiplier: 2, // 2x base fee
			priorityMult:   2, // 2x priority fee
		},
		{
			name:           "Slow",
			feeSpeed:       chainadapter.FeeSpeedSlow,
			expectedBlocks: 6,
			baseMultiplier: 1, // 1x base fee
			priorityMult:   1, // 1x priority fee
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := &chainadapter.TransactionRequest{
				From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
				To:       "0xdAC17F958D2ee523a2206206994597C13D831ec7",
				Asset:    "ETH",
				Amount:   big.NewInt(1e18), // 1 ETH
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
			if estimate.ChainID != "ethereum" {
				t.Errorf("Expected ChainID 'ethereum', got '%s'", estimate.ChainID)
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

			// Verify BaseFee is set (EIP-1559)
			if estimate.BaseFee == nil {
				t.Error("BaseFee should be set for Ethereum")
			}

			// Verify BaseFee value
			expectedBaseFee := big.NewInt(20 * 1e9) // 20 Gwei
			if estimate.BaseFee.Cmp(expectedBaseFee) != 0 {
				t.Errorf("Expected BaseFee %s, got %s", expectedBaseFee, estimate.BaseFee)
			}
		})
	}
}

// T047: Unit test Ethereum Estimate() with various network conditions
func TestEthereumFeeEstimator_Estimate_RPCFailure(t *testing.T) {
	ctx := context.Background()

	// Create mock RPC that always fails
	mockRPC := NewMockFeeRPCClient()
	// Don't configure any responses - RPC will fail

	rpcHelper := NewRPCHelper(mockRPC)
	feeEstimator := NewFeeEstimator(rpcHelper, 1)

	req := &chainadapter.TransactionRequest{
		From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
		To:       "0xdAC17F958D2ee523a2206206994597C13D831ec7",
		Asset:    "ETH",
		Amount:   big.NewInt(1e18),
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

	// Verify BaseFee is set even for fallback
	if estimate.BaseFee == nil {
		t.Error("BaseFee should be set even for fallback")
	}
}

func TestEthereumFeeEstimator_FallbackEstimate(t *testing.T) {
	mockRPC := NewMockFeeRPCClient()
	rpcHelper := NewRPCHelper(mockRPC)
	feeEstimator := NewFeeEstimator(rpcHelper, 1)

	testCases := []struct {
		name             string
		feeSpeed         chainadapter.FeeSpeed
		expectedBaseFee  int64 // In Gwei
		expectedPriority int64 // In Gwei
		expectedBlocks   int
	}{
		{
			name:             "Fast fallback",
			feeSpeed:         chainadapter.FeeSpeedFast,
			expectedBaseFee:  50, // 50 Gwei
			expectedPriority: 3,  // 3 Gwei
			expectedBlocks:   1,
		},
		{
			name:             "Normal fallback",
			feeSpeed:         chainadapter.FeeSpeedNormal,
			expectedBaseFee:  30, // 30 Gwei
			expectedPriority: 2,  // 2 Gwei
			expectedBlocks:   3,
		},
		{
			name:             "Slow fallback",
			feeSpeed:         chainadapter.FeeSpeedSlow,
			expectedBaseFee:  20, // 20 Gwei
			expectedPriority: 1,  // 1 Gwei
			expectedBlocks:   6,
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

			// Verify BaseFee
			expectedBaseFee := big.NewInt(tc.expectedBaseFee * 1e9)
			if fallback.BaseFee.Cmp(expectedBaseFee) != 0 {
				t.Errorf("Expected BaseFee %s, got %s", expectedBaseFee, fallback.BaseFee)
			}

			// Verify recommended fee
			// maxFeePerGas = (baseFee + priorityFee) * 1e9
			// recommendedFee = maxFeePerGas * 21000
			maxFeePerGas := (tc.expectedBaseFee + tc.expectedPriority) * 1e9
			expectedRecommended := big.NewInt(maxFeePerGas * 21000)

			if fallback.Recommended.Cmp(expectedRecommended) != 0 {
				t.Errorf("Expected Recommended %s, got %s", expectedRecommended, fallback.Recommended)
			}
		})
	}
}

func TestEthereumFeeEstimator_CalculateConfidence(t *testing.T) {
	mockRPC := NewMockFeeRPCClient()
	rpcHelper := NewRPCHelper(mockRPC)
	feeEstimator := NewFeeEstimator(rpcHelper, 1)

	testCases := []struct {
		name             string
		baseFeeGwei      int64
		priorityFeeGwei  int64
		expectedMinConf  int
		expectedMaxConf  int
	}{
		{
			name:            "Low fees - high confidence",
			baseFeeGwei:     20,  // < 50 Gwei
			priorityFeeGwei: 2,   // < 5 Gwei
			expectedMinConf: 80,  // Base confidence
			expectedMaxConf: 80,
		},
		{
			name:            "Medium base fee - reduced confidence",
			baseFeeGwei:     60,  // > 50 Gwei
			priorityFeeGwei: 2,   // < 5 Gwei
			expectedMinConf: 70,  // 80 - 10
			expectedMaxConf: 70,
		},
		{
			name:            "High base fee - lower confidence",
			baseFeeGwei:     120, // > 100 Gwei
			priorityFeeGwei: 2,   // < 5 Gwei
			expectedMinConf: 65,  // 80 - 15
			expectedMaxConf: 65,
		},
		{
			name:            "High priority fee - reduced confidence",
			baseFeeGwei:     20,  // < 50 Gwei
			priorityFeeGwei: 12,  // > 10 Gwei
			expectedMinConf: 70,  // 80 - 10
			expectedMaxConf: 70,
		},
		{
			name:            "Both high - lowest confidence",
			baseFeeGwei:     120, // > 100 Gwei
			priorityFeeGwei: 12,  // > 10 Gwei
			expectedMinConf: 55,  // 80 - 15 - 10
			expectedMaxConf: 55,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			baseFee := big.NewInt(tc.baseFeeGwei * 1e9)
			priorityFee := big.NewInt(tc.priorityFeeGwei * 1e9)

			confidence := feeEstimator.calculateConfidence(baseFee, priorityFee)

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

func TestEthereumFeeEstimator_GenerateReason(t *testing.T) {
	mockRPC := NewMockFeeRPCClient()
	rpcHelper := NewRPCHelper(mockRPC)
	feeEstimator := NewFeeEstimator(rpcHelper, 1)

	testCases := []struct {
		name            string
		confidence      int
		baseFeeGwei     int64
		priorityFeeGwei int64
		expectedContain string
	}{
		{
			name:            "High confidence",
			confidence:      80,
			baseFeeGwei:     20,
			priorityFeeGwei: 2,
			expectedContain: "Network stable",
		},
		{
			name:            "Medium confidence",
			confidence:      70,
			baseFeeGwei:     60,
			priorityFeeGwei: 2,
			expectedContain: "Network conditions normal",
		},
		{
			name:            "Low confidence",
			confidence:      55,
			baseFeeGwei:     120,
			priorityFeeGwei: 12,
			expectedContain: "Network congested",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			baseFee := big.NewInt(tc.baseFeeGwei * 1e9)
			priorityFee := big.NewInt(tc.priorityFeeGwei * 1e9)

			reason := feeEstimator.generateReason(tc.confidence, baseFee, priorityFee)

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

func TestEthereumFeeEstimator_EstimateWithGasLimit(t *testing.T) {
	ctx := context.Background()

	mockRPC := NewMockFeeRPCClient()
	mockRPC.SetResponse("eth_getBlockByNumber", map[string]interface{}{
		"baseFeePerGas": "0x4a817c800", // 20 Gwei
		"number":        "0x1234",
	})
	mockRPC.SetResponse("eth_feeHistory", map[string]interface{}{
		"reward": [][]string{
			{"0x77359400"}, // 2 Gwei
		},
	})

	rpcHelper := NewRPCHelper(mockRPC)
	feeEstimator := NewFeeEstimator(rpcHelper, 1)

	req := &chainadapter.TransactionRequest{
		From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
		To:       "0xdAC17F958D2ee523a2206206994597C13D831ec7",
		Asset:    "ETH",
		Amount:   big.NewInt(1e18),
		FeeSpeed: chainadapter.FeeSpeedNormal,
	}

	// Test with higher gas limit (contract interaction)
	contractGasLimit := uint64(100000) // vs 21000 for simple transfer

	estimate, err := feeEstimator.EstimateWithGasLimit(ctx, req, contractGasLimit)
	if err != nil {
		t.Fatalf("EstimateWithGasLimit() failed: %v", err)
	}

	// Verify estimate is not nil
	if estimate == nil {
		t.Fatal("Estimate returned nil")
	}

	// Verify fees are positive
	if estimate.Recommended.Sign() <= 0 {
		t.Error("Recommended fee must be positive")
	}

	// The fee should be higher than for a simple transfer (21000 gas)
	// Ratio: 100000 / 21000 = 4.76x higher
	// Base estimate: Normal speed = 2x baseFee (20 Gwei) + 2x priorityFee (2 Gwei) = 44 Gwei
	// For 21000 gas: 44 * 21000 = 924000 Gwei = 0.000924 ETH
	// For 100000 gas: 44 * 100000 = 4400000 Gwei = 0.0044 ETH
	expectedMin := big.NewInt(4e15) // At least 0.004 ETH (with some margin)
	if estimate.Recommended.Cmp(expectedMin) < 0 {
		t.Errorf("With gas limit %d, expected fee >= %s, got %s",
			contractGasLimit, expectedMin, estimate.Recommended)
	}
}

func TestEthereumFeeEstimator_SubscribeFeeUpdates(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	mockRPC := NewMockFeeRPCClient()
	mockRPC.SetResponse("eth_getBlockByNumber", map[string]interface{}{
		"baseFeePerGas": "0x4a817c800",
		"number":        "0x1234",
	})
	mockRPC.SetResponse("eth_feeHistory", map[string]interface{}{
		"reward": [][]string{
			{"0x77359400"},
		},
	})
	mockRPC.SetResponse("eth_blockNumber", "0x1234")

	rpcHelper := NewRPCHelper(mockRPC)
	feeEstimator := NewFeeEstimator(rpcHelper, 1)

	req := &chainadapter.TransactionRequest{
		From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
		To:       "0xdAC17F958D2ee523a2206206994597C13D831ec7",
		Asset:    "ETH",
		Amount:   big.NewInt(1e18),
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
