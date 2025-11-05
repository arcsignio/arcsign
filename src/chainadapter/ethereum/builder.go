// Package ethereum - Transaction builder implementation
package ethereum

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/arcsign/chainadapter"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
)

// TransactionBuilder builds Ethereum transactions from TransactionRequest.
type TransactionBuilder struct {
	chainID *big.Int
}

// NewTransactionBuilder creates a new Ethereum transaction builder.
func NewTransactionBuilder(chainID int64) *TransactionBuilder {
	return &TransactionBuilder{
		chainID: big.NewInt(chainID),
	}
}

// Build constructs an unsigned Ethereum transaction (EIP-1559).
func (tb *TransactionBuilder) Build(
	ctx context.Context,
	req *chainadapter.TransactionRequest,
	nonce uint64,
	gasLimit uint64,
	maxFeePerGas *big.Int,
	maxPriorityFeePerGas *big.Int,
) (*chainadapter.UnsignedTransaction, error) {
	// Validate request
	if err := tb.validateRequest(req); err != nil {
		return nil, err
	}

	// Parse addresses
	toAddr := common.HexToAddress(req.To)

	// Parse data field (memo)
	var data []byte
	if req.Memo != "" {
		data = []byte(req.Memo)
	}

	// Override gas limit from chain-specific if provided
	if req.ChainSpecific != nil {
		if customGasLimit, ok := req.ChainSpecific["gas_limit"].(uint64); ok {
			gasLimit = customGasLimit
		}
	}

	// Create EIP-1559 transaction
	tx := types.NewTx(&types.DynamicFeeTx{
		ChainID:   tb.chainID,
		Nonce:     nonce,
		GasFeeCap: maxFeePerGas,
		GasTipCap: maxPriorityFeePerGas,
		Gas:       gasLimit,
		To:        &toAddr,
		Value:     req.Amount,
		Data:      data,
	})

	// Generate transaction ID (hash without signature)
	signer := types.LatestSignerForChainID(tb.chainID)
	txHash := signer.Hash(tx)
	txID := txHash.Hex()

	// Create signing payload (the hash that needs to be signed)
	signingPayload := txHash.Bytes()

	// Calculate fee
	fee := new(big.Int).Mul(maxFeePerGas, big.NewInt(int64(gasLimit)))

	// Create human-readable representation
	humanReadable := tb.createHumanReadable(req, nonce, gasLimit, maxFeePerGas, maxPriorityFeePerGas, fee)

	// Assemble UnsignedTransaction
	unsigned := &chainadapter.UnsignedTransaction{
		ID:             txID,
		ChainID:        fmt.Sprintf("ethereum-%d", tb.chainID.Int64()),
		From:           req.From,
		To:             req.To,
		Amount:         req.Amount,
		Fee:            fee,
		Nonce:          &nonce,
		SigningPayload: signingPayload,
		HumanReadable:  humanReadable,
		ChainSpecific: map[string]interface{}{
			"chain_id":                 tb.chainID.Int64(),
			"nonce":                    nonce,
			"gas_limit":                gasLimit,
			"max_fee_per_gas":          maxFeePerGas.String(),
			"max_priority_fee_per_gas": maxPriorityFeePerGas.String(),
			"data":                     data,
		},
		CreatedAt: time.Now(),
	}

	return unsigned, nil
}

// validateRequest validates the transaction request fields.
func (tb *TransactionBuilder) validateRequest(req *chainadapter.TransactionRequest) error {
	// Validate From address
	if req.From == "" {
		return chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeInvalidAddress,
			"from address is required",
			nil,
		)
	}

	if !tb.isValidAddress(req.From) {
		return chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeInvalidAddress,
			fmt.Sprintf("invalid from address: %s", req.From),
			nil,
		)
	}

	// Validate To address
	if req.To == "" {
		return chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeInvalidAddress,
			"to address is required",
			nil,
		)
	}

	if !tb.isValidAddress(req.To) {
		return chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeInvalidAddress,
			fmt.Sprintf("invalid to address: %s", req.To),
			nil,
		)
	}

	// Validate Amount
	if req.Amount == nil || req.Amount.Cmp(big.NewInt(0)) < 0 {
		return chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeInvalidAmount,
			"amount must be non-negative",
			nil,
		)
	}

	// Validate Asset
	if req.Asset != "ETH" && req.Asset != "ethereum" {
		return chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeUnsupportedAsset,
			fmt.Sprintf("unsupported asset: %s (use 'ETH' for Ethereum)", req.Asset),
			nil,
		)
	}

	return nil
}

// isValidAddress checks if an Ethereum address is valid.
func (tb *TransactionBuilder) isValidAddress(addr string) bool {
	// Check if address starts with 0x and has correct length
	if !strings.HasPrefix(addr, "0x") {
		return false
	}

	if len(addr) != 42 { // 0x + 40 hex characters
		return false
	}

	// Check if it's a valid hex address
	if !common.IsHexAddress(addr) {
		return false
	}

	return true
}

// ValidateChecksum validates EIP-55 checksummed address.
func (tb *TransactionBuilder) ValidateChecksum(addr string) bool {
	address := common.HexToAddress(addr)
	return address.Hex() == addr
}

// createHumanReadable creates a human-readable JSON representation.
func (tb *TransactionBuilder) createHumanReadable(
	req *chainadapter.TransactionRequest,
	nonce uint64,
	gasLimit uint64,
	maxFeePerGas *big.Int,
	maxPriorityFeePerGas *big.Int,
	fee *big.Int,
) string {
	// Convert Wei to Ether for readability
	amountEth := new(big.Float).Quo(
		new(big.Float).SetInt(req.Amount),
		new(big.Float).SetInt(big.NewInt(1e18)),
	)

	feeEth := new(big.Float).Quo(
		new(big.Float).SetInt(fee),
		new(big.Float).SetInt(big.NewInt(1e18)),
	)

	maxFeeGwei := new(big.Int).Div(maxFeePerGas, big.NewInt(1e9))
	maxPriorityGwei := new(big.Int).Div(maxPriorityFeePerGas, big.NewInt(1e9))

	return fmt.Sprintf(`{
  "from": "%s",
  "to": "%s",
  "amount": %s ETH (%s wei),
  "nonce": %d,
  "gas_limit": %d,
  "max_fee_per_gas": %s Gwei,
  "max_priority_fee_per_gas": %s Gwei,
  "estimated_fee": %s ETH,
  "memo": "%s",
  "chain_id": %d
}`,
		req.From,
		req.To,
		amountEth.Text('f', 6),
		req.Amount.String(),
		nonce,
		gasLimit,
		maxFeeGwei.String(),
		maxPriorityGwei.String(),
		feeEth.Text('f', 6),
		req.Memo,
		tb.chainID.Int64(),
	)
}

// SignTransaction signs an Ethereum transaction with a private key.
// This is a helper function for testing; production should use external signers.
func (tb *TransactionBuilder) SignTransaction(tx *types.Transaction, privateKeyHex string) (*types.Transaction, error) {
	privateKey, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}

	signer := types.LatestSignerForChainID(tb.chainID)
	signedTx, err := types.SignTx(tx, signer, privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign transaction: %w", err)
	}

	return signedTx, nil
}
