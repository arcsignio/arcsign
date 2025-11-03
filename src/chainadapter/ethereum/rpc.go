// Package ethereum - RPC helper functions for Ethereum adapter
package ethereum

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"

	"github.com/arcsign/chainadapter"
	"github.com/arcsign/chainadapter/rpc"
	"github.com/ethereum/go-ethereum/common/hexutil"
)

// RPCHelper provides helper functions for Ethereum RPC operations
type RPCHelper struct {
	client rpc.RPCClient
}

// NewRPCHelper creates a new Ethereum RPC helper
func NewRPCHelper(client rpc.RPCClient) *RPCHelper {
	return &RPCHelper{
		client: client,
	}
}

// GetTransactionCount retrieves the nonce for an address
func (r *RPCHelper) GetTransactionCount(ctx context.Context, address string) (uint64, error) {
	// Call eth_getTransactionCount with "pending" to get the next nonce
	result, err := r.client.Call(ctx, "eth_getTransactionCount", []interface{}{
		address,
		"pending",
	})
	if err != nil {
		return 0, chainadapter.NewRetryableError(
			chainadapter.ErrCodeRPCUnavailable,
			fmt.Sprintf("eth_getTransactionCount RPC failed: %s", err.Error()),
			nil,
			err,
		)
	}

	// Parse hex result
	var nonceHex string
	if err := json.Unmarshal(result, &nonceHex); err != nil {
		return 0, chainadapter.NewNonRetryableError(
			"ERR_RPC_PARSE",
			fmt.Sprintf("failed to parse nonce: %s", err.Error()),
			err,
		)
	}

	// Convert hex to uint64
	nonce, err := hexutil.DecodeUint64(nonceHex)
	if err != nil {
		return 0, chainadapter.NewNonRetryableError(
			"ERR_RPC_PARSE",
			fmt.Sprintf("failed to decode nonce hex: %s", err.Error()),
			err,
		)
	}

	return nonce, nil
}

// EstimateGas estimates gas for a transaction
func (r *RPCHelper) EstimateGas(ctx context.Context, from, to string, value *big.Int, data []byte) (uint64, error) {
	// Build transaction object for gas estimation
	txObj := map[string]interface{}{
		"from": from,
		"to":   to,
	}

	if value != nil && value.Cmp(big.NewInt(0)) > 0 {
		txObj["value"] = hexutil.EncodeBig(value)
	}

	if len(data) > 0 {
		txObj["data"] = hexutil.Encode(data)
	}

	// Call eth_estimateGas
	result, err := r.client.Call(ctx, "eth_estimateGas", []interface{}{txObj})
	if err != nil {
		return 0, chainadapter.NewRetryableError(
			chainadapter.ErrCodeRPCUnavailable,
			fmt.Sprintf("eth_estimateGas RPC failed: %s", err.Error()),
			nil,
			err,
		)
	}

	// Parse hex result
	var gasHex string
	if err := json.Unmarshal(result, &gasHex); err != nil {
		return 0, chainadapter.NewNonRetryableError(
			"ERR_RPC_PARSE",
			fmt.Sprintf("failed to parse gas estimate: %s", err.Error()),
			err,
		)
	}

	// Convert hex to uint64
	gas, err := hexutil.DecodeUint64(gasHex)
	if err != nil {
		return 0, chainadapter.NewNonRetryableError(
			"ERR_RPC_PARSE",
			fmt.Sprintf("failed to decode gas hex: %s", err.Error()),
			err,
		)
	}

	return gas, nil
}

// GetBaseFee retrieves the current base fee from the latest block (EIP-1559)
func (r *RPCHelper) GetBaseFee(ctx context.Context) (*big.Int, error) {
	// Call eth_getBlockByNumber with "latest"
	result, err := r.client.Call(ctx, "eth_getBlockByNumber", []interface{}{
		"latest",
		false, // Don't include full transactions
	})
	if err != nil {
		return nil, chainadapter.NewRetryableError(
			chainadapter.ErrCodeRPCUnavailable,
			"eth_getBlockByNumber RPC failed",
			nil,
			err,
		)
	}

	// Parse block result
	var block struct {
		BaseFeePerGas string `json:"baseFeePerGas"`
	}

	if err := json.Unmarshal(result, &block); err != nil {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_RPC_PARSE",
			"failed to parse block",
			err,
		)
	}

	// Decode base fee
	if block.BaseFeePerGas == "" {
		// Pre-London fork, no base fee
		return big.NewInt(0), nil
	}

	baseFee, err := hexutil.DecodeBig(block.BaseFeePerGas)
	if err != nil {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_RPC_PARSE",
			"failed to decode base fee",
			err,
		)
	}

	return baseFee, nil
}

// GetFeeHistory retrieves historical fee data for priority fee estimation
func (r *RPCHelper) GetFeeHistory(ctx context.Context, blockCount int) (*big.Int, error) {
	// Call eth_feeHistory
	result, err := r.client.Call(ctx, "eth_feeHistory", []interface{}{
		hexutil.EncodeUint64(uint64(blockCount)),
		"latest",
		[]int{50}, // 50th percentile (median)
	})
	if err != nil {
		return nil, chainadapter.NewRetryableError(
			chainadapter.ErrCodeRPCUnavailable,
			"eth_feeHistory RPC failed",
			nil,
			err,
		)
	}

	// Parse fee history
	var feeHistory struct {
		Reward [][]string `json:"reward"`
	}

	if err := json.Unmarshal(result, &feeHistory); err != nil {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_RPC_PARSE",
			"failed to parse fee history",
			err,
		)
	}

	if len(feeHistory.Reward) == 0 {
		// No data, return default 2 Gwei
		return big.NewInt(2e9), nil
	}

	// Calculate median of recent priority fees
	var sum *big.Int = big.NewInt(0)
	count := 0

	for _, rewards := range feeHistory.Reward {
		if len(rewards) > 0 {
			priorityFee, err := hexutil.DecodeBig(rewards[0])
			if err == nil {
				sum.Add(sum, priorityFee)
				count++
			}
		}
	}

	if count == 0 {
		return big.NewInt(2e9), nil // Default 2 Gwei
	}

	avgPriorityFee := new(big.Int).Div(sum, big.NewInt(int64(count)))
	return avgPriorityFee, nil
}

// GetBlockNumber retrieves the current block number
func (r *RPCHelper) GetBlockNumber(ctx context.Context) (uint64, error) {
	result, err := r.client.Call(ctx, "eth_blockNumber", nil)
	if err != nil {
		return 0, chainadapter.NewRetryableError(
			chainadapter.ErrCodeRPCUnavailable,
			"eth_blockNumber RPC failed",
			nil,
			err,
		)
	}

	var blockHex string
	if err := json.Unmarshal(result, &blockHex); err != nil {
		return 0, chainadapter.NewNonRetryableError(
			"ERR_RPC_PARSE",
			"failed to parse block number",
			err,
		)
	}

	blockNumber, err := hexutil.DecodeUint64(blockHex)
	if err != nil {
		return 0, chainadapter.NewNonRetryableError(
			"ERR_RPC_PARSE",
			"failed to decode block number hex",
			err,
		)
	}

	return blockNumber, nil
}
