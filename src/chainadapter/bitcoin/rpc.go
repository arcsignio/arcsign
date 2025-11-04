// Package bitcoin - RPC helper functions for Bitcoin adapter
package bitcoin

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/arcsign/chainadapter"
	"github.com/arcsign/chainadapter/rpc"
)

// ListUnspentResult represents the result of listunspent RPC call
type ListUnspentResult struct {
	TxID          string  `json:"txid"`
	Vout          uint32  `json:"vout"`
	Address       string  `json:"address"`
	ScriptPubKey  string  `json:"scriptPubKey"`
	Amount        float64 `json:"amount"` // BTC amount
	Confirmations int     `json:"confirmations"`
	Spendable     bool    `json:"spendable"`
	Solvable      bool    `json:"solvable"`
}

// EstimateSmartFeeResult represents the result of estimatesmartfee RPC call
type EstimateSmartFeeResult struct {
	FeeRate float64  `json:"feerate"` // BTC/kB
	Blocks  int      `json:"blocks"`
	Errors  []string `json:"errors,omitempty"`
}

// RPCHelper provides helper functions for Bitcoin RPC operations
type RPCHelper struct {
	client rpc.RPCClient
}

// NewRPCHelper creates a new Bitcoin RPC helper
func NewRPCHelper(client rpc.RPCClient) *RPCHelper {
	return &RPCHelper{
		client: client,
	}
}

// ListUnspent retrieves unspent outputs for an address
func (r *RPCHelper) ListUnspent(ctx context.Context, address string) ([]UTXO, error) {
	// Call listunspent RPC method
	result, err := r.client.Call(ctx, "listunspent", []interface{}{
		0,           // minconf
		9999999,     // maxconf
		[]string{address}, // addresses
	})
	if err != nil {
		return nil, chainadapter.NewRetryableError(
			chainadapter.ErrCodeRPCUnavailable,
			fmt.Sprintf("listunspent RPC failed: %s", err.Error()),
			nil,
			err,
		)
	}

	// Parse result
	var utxoResults []ListUnspentResult
	if err := json.Unmarshal(result, &utxoResults); err != nil {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_RPC_PARSE",
			fmt.Sprintf("failed to parse listunspent result: %s", err.Error()),
			err,
		)
	}

	// Convert to UTXO format
	utxos := make([]UTXO, 0, len(utxoResults))
	for _, u := range utxoResults {
		if !u.Spendable {
			continue // Skip non-spendable UTXOs
		}

		// Convert BTC to satoshis
		amountSats := int64(u.Amount * 1e8)

		utxos = append(utxos, UTXO{
			TxID:          u.TxID,
			Vout:          u.Vout,
			Amount:        amountSats,
			ScriptPubKey:  []byte(u.ScriptPubKey), // Will be decoded from hex if needed
			Address:       u.Address,
			Confirmations: u.Confirmations,
		})
	}

	return utxos, nil
}

// EstimateSmartFee estimates the fee rate for confirmation within target blocks
func (r *RPCHelper) EstimateSmartFee(ctx context.Context, targetBlocks int) (int64, error) {
	// Call estimatesmartfee RPC method
	result, err := r.client.Call(ctx, "estimatesmartfee", []interface{}{targetBlocks})
	if err != nil {
		return 0, chainadapter.NewRetryableError(
			chainadapter.ErrCodeRPCUnavailable,
			fmt.Sprintf("estimatesmartfee RPC failed: %s", err.Error()),
			nil,
			err,
		)
	}

	// Parse result
	var feeResult EstimateSmartFeeResult
	if err := json.Unmarshal(result, &feeResult); err != nil {
		return 0, chainadapter.NewNonRetryableError(
			"ERR_RPC_PARSE",
			fmt.Sprintf("failed to parse estimatesmartfee result: %s", err.Error()),
			err,
		)
	}

	// Check for errors in response
	if len(feeResult.Errors) > 0 {
		return 0, chainadapter.NewRetryableError(
			chainadapter.ErrCodeRPCUnavailable,
			fmt.Sprintf("estimatesmartfee returned errors: %v", feeResult.Errors),
			nil,
			nil,
		)
	}

	// Convert BTC/kB to sat/byte
	// feeRate is in BTC per kilobyte
	// We want satoshis per byte
	satPerByte := int64(feeResult.FeeRate * 1e8 / 1000)

	// Minimum fee rate: 1 sat/byte
	if satPerByte < 1 {
		satPerByte = 1
	}

	return satPerByte, nil
}

// GetBlockCount retrieves the current block height
func (r *RPCHelper) GetBlockCount(ctx context.Context) (int64, error) {
	result, err := r.client.Call(ctx, "getblockcount", nil)
	if err != nil {
		return 0, chainadapter.NewRetryableError(
			chainadapter.ErrCodeRPCUnavailable,
			"getblockcount RPC failed",
			nil,
			err,
		)
	}

	var blockCount int64
	if err := json.Unmarshal(result, &blockCount); err != nil {
		return 0, chainadapter.NewNonRetryableError(
			"ERR_RPC_PARSE",
			"failed to parse getblockcount result",
			err,
		)
	}

	return blockCount, nil
}

// SendRawTransaction broadcasts a signed transaction to the Bitcoin network.
//
// Parameters:
// - ctx: Context for cancellation
// - txHex: Hex-encoded signed transaction
//
// Returns:
// - Transaction hash (hex string)
// - Error if broadcast fails
func (r *RPCHelper) SendRawTransaction(ctx context.Context, txHex string) (string, error) {
	result, err := r.client.Call(ctx, "sendrawtransaction", []interface{}{txHex})
	if err != nil {
		// Check if error is due to duplicate transaction
		if errMsg := err.Error(); errMsg != "" {
			// Bitcoin Core returns specific errors for already-broadcast txs
			if contains(errMsg, "already in block chain") || contains(errMsg, "txn-already-known") {
				// Parse the transaction hash from error or result
				var txHash string
				if unmarshalErr := json.Unmarshal(result, &txHash); unmarshalErr == nil && txHash != "" {
					return txHash, nil // Transaction already broadcast, return hash
				}
				// If we can't get the hash, return a retryable error
				return "", chainadapter.NewRetryableError(
					"ERR_TX_ALREADY_BROADCAST",
					"transaction already broadcast",
					nil,
					err,
				)
			}
		}

		return "", chainadapter.NewRetryableError(
			"ERR_BROADCAST_FAILED",
			fmt.Sprintf("sendrawtransaction RPC failed: %s", err.Error()),
			nil,
			err,
		)
	}

	var txHash string
	if err := json.Unmarshal(result, &txHash); err != nil {
		return "", chainadapter.NewNonRetryableError(
			"ERR_RPC_PARSE",
			"failed to parse sendrawtransaction result",
			err,
		)
	}

	return txHash, nil
}
