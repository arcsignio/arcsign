// Package bitcoin - Transaction builder implementation
package bitcoin

import (
	"bytes"
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/arcsign/chainadapter"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
)

// UTXO represents an unspent transaction output
type UTXO struct {
	TxID         string   // Transaction ID (hex)
	Vout         uint32   // Output index
	Amount       int64    // Amount in satoshis
	ScriptPubKey []byte   // Script public key
	Address      string   // Bitcoin address
	Confirmations int     // Number of confirmations
}

// TransactionBuilder builds Bitcoin transactions from TransactionRequest.
type TransactionBuilder struct {
	network *chaincfg.Params
}

// NewTransactionBuilder creates a new Bitcoin transaction builder.
func NewTransactionBuilder(network string) (*TransactionBuilder, error) {
	var params *chaincfg.Params
	switch network {
	case "mainnet":
		params = &chaincfg.MainNetParams
	case "testnet3":
		params = &chaincfg.TestNet3Params
	case "regtest":
		params = &chaincfg.RegressionNetParams
	default:
		return nil, fmt.Errorf("unsupported network: %s", network)
	}

	return &TransactionBuilder{
		network: params,
	}, nil
}

// Build constructs an unsigned Bitcoin transaction.
func (tb *TransactionBuilder) Build(ctx context.Context, req *chainadapter.TransactionRequest, utxos []UTXO, feeRate int64) (*chainadapter.UnsignedTransaction, error) {
	// Validate request
	if err := tb.validateRequest(req); err != nil {
		return nil, err
	}

	// Select UTXOs
	selectedUTXOs, changeAmount, err := tb.selectUTXOs(utxos, req.Amount.Int64(), feeRate)
	if err != nil {
		return nil, err
	}

	// Create transaction
	tx := wire.NewMsgTx(wire.TxVersion)

	// Add inputs
	for _, utxo := range selectedUTXOs {
		txHash, err := chainhash.NewHashFromStr(utxo.TxID)
		if err != nil {
			return nil, chainadapter.NewNonRetryableError(
				chainadapter.ErrCodeInvalidTransaction,
				fmt.Sprintf("invalid UTXO txid: %s", utxo.TxID),
				err,
			)
		}

		txIn := wire.NewTxIn(wire.NewOutPoint(txHash, utxo.Vout), nil, nil)

		// Set sequence for RBF support if requested
		if req.ChainSpecific != nil {
			if rbfEnabled, ok := req.ChainSpecific["rbf_enabled"].(bool); ok && rbfEnabled {
				txIn.Sequence = wire.MaxTxInSequenceNum - 2 // BIP 125 RBF signal
			}
		}

		tx.AddTxIn(txIn)
	}

	// Add output to recipient
	recipientAddr, err := btcutil.DecodeAddress(req.To, tb.network)
	if err != nil {
		return nil, chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeInvalidAddress,
			fmt.Sprintf("invalid recipient address: %s", req.To),
			err,
		)
	}

	recipientScript, err := txscript.PayToAddrScript(recipientAddr)
	if err != nil {
		return nil, chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeInvalidTransaction,
			"failed to create recipient script",
			err,
		)
	}

	tx.AddTxOut(wire.NewTxOut(req.Amount.Int64(), recipientScript))

	// Add change output if needed
	var changeAddress string
	if changeAmount > 0 {
		// Use From address as change address by default
		changeAddress = req.From
		if req.ChainSpecific != nil {
			if customChange, ok := req.ChainSpecific["change_address"].(string); ok {
				changeAddress = customChange
			}
		}

		changeAddr, err := btcutil.DecodeAddress(changeAddress, tb.network)
		if err != nil {
			return nil, chainadapter.NewNonRetryableError(
				chainadapter.ErrCodeInvalidAddress,
				fmt.Sprintf("invalid change address: %s", changeAddress),
				err,
			)
		}

		changeScript, err := txscript.PayToAddrScript(changeAddr)
		if err != nil {
			return nil, chainadapter.NewNonRetryableError(
				chainadapter.ErrCodeInvalidTransaction,
				"failed to create change script",
				err,
			)
		}

		tx.AddTxOut(wire.NewTxOut(changeAmount, changeScript))
	}

	// Add OP_RETURN memo if provided
	if req.Memo != "" {
		memoBytes := []byte(req.Memo)
		if len(memoBytes) > 80 {
			return nil, chainadapter.NewNonRetryableError(
				chainadapter.ErrCodeInvalidTransaction,
				"memo exceeds 80 bytes",
				nil,
			)
		}

		memoScript, err := txscript.NullDataScript(memoBytes)
		if err != nil {
			return nil, chainadapter.NewNonRetryableError(
				chainadapter.ErrCodeInvalidTransaction,
				"failed to create memo script",
				err,
			)
		}

		tx.AddTxOut(wire.NewTxOut(0, memoScript))
	}

	// Calculate fee
	txSize := tx.SerializeSize()
	fee := int64(txSize) * feeRate

	// Generate transaction ID (deterministic)
	txID := tb.generateTxID(tx)

	// Create signing payload (serialized transaction for signing)
	signingPayload, err := tb.createSigningPayload(tx, selectedUTXOs)
	if err != nil {
		return nil, err
	}

	// Create human-readable representation
	humanReadable := tb.createHumanReadable(req, selectedUTXOs, fee, changeAmount, changeAddress)

	// Assemble UnsignedTransaction
	unsigned := &chainadapter.UnsignedTransaction{
		ID:             txID,
		ChainID:        "bitcoin", // Will be overridden by adapter
		From:           req.From,
		To:             req.To,
		Amount:         req.Amount,
		Fee:            big.NewInt(fee),
		Nonce:          nil, // Bitcoin uses UTXO model, no nonce
		SigningPayload: signingPayload,
		HumanReadable:  humanReadable,
		ChainSpecific: map[string]interface{}{
			"utxos":          selectedUTXOs,
			"change_amount":  changeAmount,
			"change_address": changeAddress,
			"tx_size":        txSize,
			"fee_rate":       feeRate,
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

	_, err := btcutil.DecodeAddress(req.From, tb.network)
	if err != nil {
		return chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeInvalidAddress,
			fmt.Sprintf("invalid from address: %s", req.From),
			err,
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

	_, err = btcutil.DecodeAddress(req.To, tb.network)
	if err != nil {
		return chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeInvalidAddress,
			fmt.Sprintf("invalid to address: %s", req.To),
			err,
		)
	}

	// Validate Amount
	if req.Amount == nil || req.Amount.Cmp(big.NewInt(0)) <= 0 {
		return chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeInvalidAmount,
			"amount must be positive",
			nil,
		)
	}

	// Validate Asset
	if req.Asset != "BTC" && req.Asset != "bitcoin" {
		return chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeUnsupportedAsset,
			fmt.Sprintf("unsupported asset: %s", req.Asset),
			nil,
		)
	}

	return nil
}

// selectUTXOs selects UTXOs for the transaction using largest-first strategy.
func (tb *TransactionBuilder) selectUTXOs(utxos []UTXO, amount int64, feeRate int64) ([]UTXO, int64, error) {
	// Estimate transaction size (inputs + 2 outputs for recipient + change)
	estimatedSize := int64(10 + 148*len(utxos) + 34*2) // Very rough estimate
	estimatedFee := estimatedSize * feeRate

	totalNeeded := amount + estimatedFee

	// Sort UTXOs by amount (largest first)
	// TODO: Implement more sophisticated UTXO selection (e.g., Branch and Bound)
	selected := make([]UTXO, 0)
	totalSelected := int64(0)

	for _, utxo := range utxos {
		selected = append(selected, utxo)
		totalSelected += utxo.Amount

		if totalSelected >= totalNeeded {
			break
		}
	}

	if totalSelected < totalNeeded {
		return nil, 0, chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeInsufficientFunds,
			fmt.Sprintf("insufficient funds: have %d satoshis, need %d satoshis", totalSelected, totalNeeded),
			nil,
		)
	}

	// Calculate change
	changeAmount := totalSelected - amount - estimatedFee

	// Dust threshold (546 satoshis for P2WPKH)
	const dustThreshold = 546
	if changeAmount > 0 && changeAmount < dustThreshold {
		// Add dust to fee
		estimatedFee += changeAmount
		changeAmount = 0
	}

	return selected, changeAmount, nil
}

// generateTxID creates a deterministic transaction ID.
func (tb *TransactionBuilder) generateTxID(tx *wire.MsgTx) string {
	hash := tx.TxHash()
	return hash.String()
}

// createSigningPayload creates the payload that needs to be signed.
func (tb *TransactionBuilder) createSigningPayload(tx *wire.MsgTx, utxos []UTXO) ([]byte, error) {
	// For now, return the serialized transaction
	// In full implementation, this would create proper SIGHASH for each input
	var buf bytes.Buffer
	if err := tx.Serialize(&buf); err != nil {
		return nil, chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeInvalidTransaction,
			"failed to serialize transaction",
			err,
		)
	}

	return buf.Bytes(), nil
}

// createHumanReadable creates a human-readable JSON representation.
func (tb *TransactionBuilder) createHumanReadable(req *chainadapter.TransactionRequest, utxos []UTXO, fee int64, changeAmount int64, changeAddress string) string {
	return fmt.Sprintf(`{
  "from": "%s",
  "to": "%s",
  "amount": %s satoshis,
  "fee": %d satoshis,
  "inputs": %d UTXOs,
  "change": %d satoshis to %s,
  "memo": "%s",
  "network": "%s"
}`, req.From, req.To, req.Amount.String(), fee, len(utxos), changeAmount, changeAddress, req.Memo, tb.network.Name)
}
