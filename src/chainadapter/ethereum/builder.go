// Package ethereum - Transaction builder implementation
package ethereum

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/arcsignio/arcsign/src/chainadapter"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
)

// ERC20 transfer function signature: transfer(address,uint256)
const erc20TransferSig = "transfer(address,uint256)"

// encodeERC20Transfer encodes an ERC-20 transfer call data
func encodeERC20Transfer(to common.Address, amount *big.Int) ([]byte, error) {
	// Method ID for transfer(address,uint256) = 0xa9059cbb
	transferFnSignature := []byte("transfer(address,uint256)")
	methodID := crypto.Keccak256(transferFnSignature)[:4]

	// Encode the parameters using ABI encoding
	addressType, _ := abi.NewType("address", "", nil)
	uint256Type, _ := abi.NewType("uint256", "", nil)

	arguments := abi.Arguments{
		{Type: addressType},
		{Type: uint256Type},
	}

	packedArgs, err := arguments.Pack(to, amount)
	if err != nil {
		return nil, fmt.Errorf("failed to pack ERC-20 transfer arguments: %w", err)
	}

	// Combine method ID with packed arguments
	data := append(methodID, packedArgs...)
	return data, nil
}

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
// Supports both native ETH transfers and ERC-20 token transfers.
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

	// Determine if this is an ERC-20 transfer via the single shared resolver.
	// A non-empty-but-invalid token_address is a hard error here (resolver), NOT
	// a silent fall-through to a native transfer — that would send the native
	// coin to the recipient when the user asked to send a token.
	tokenAddress, err := resolveERC20TokenAddress(req)
	if err != nil {
		return nil, err
	}

	var toAddr common.Address
	var data []byte
	var value *big.Int

	if tokenAddress != "" {
		// ERC-20 transfer: to = token contract, data = transfer(recipient, amount), value = 0
		toAddr = common.HexToAddress(tokenAddress)
		recipientAddr := common.HexToAddress(req.To)

		var err error
		data, err = encodeERC20Transfer(recipientAddr, req.Amount)
		if err != nil {
			return nil, chainadapter.NewNonRetryableError(
				"ERR_ERC20_ENCODE",
				fmt.Sprintf("failed to encode ERC-20 transfer: %v", err),
				err,
			)
		}
		value = big.NewInt(0) // ERC-20 transfers don't send ETH

		// ERC-20 transfers need more gas (typically ~65000)
		if gasLimit < 65000 {
			gasLimit = 65000
		}
	} else {
		// Native ETH transfer or contract deployment/call
		value = req.Amount

		// Parse data field (memo) for contract calls/deployments
		// Memo can be hex-encoded contract call data or bytecode
		if req.Memo != "" {
			if len(req.Memo) >= 2 && req.Memo[:2] == "0x" {
				data = common.FromHex(req.Memo)
			} else {
				data = []byte(req.Memo)
			}
		}

		// Set to address (nil for contract deployment)
		if req.To != "" {
			toAddr = common.HexToAddress(req.To)
		}
		// If req.To is empty, toAddr remains zero value
	}

	// Override gas limit from chain-specific if provided
	if req.ChainSpecific != nil {
		if customGasLimit, ok := req.ChainSpecific["gas_limit"].(uint64); ok {
			gasLimit = customGasLimit
		}
	}

	// Determine if this is a contract deployment (empty to address with data)
	isContractDeploy := req.To == "" && len(data) > 0

	// Create EIP-1559 transaction
	var tx *types.Transaction
	if isContractDeploy {
		// Contract deployment: To must be nil
		tx = types.NewTx(&types.DynamicFeeTx{
			ChainID:   tb.chainID,
			Nonce:     nonce,
			GasFeeCap: maxFeePerGas,
			GasTipCap: maxPriorityFeePerGas,
			Gas:       gasLimit,
			To:        nil, // nil indicates contract creation
			Value:     value,
			Data:      data,
		})
	} else {
		// Regular transfer or contract call
		tx = types.NewTx(&types.DynamicFeeTx{
			ChainID:   tb.chainID,
			Nonce:     nonce,
			GasFeeCap: maxFeePerGas,
			GasTipCap: maxPriorityFeePerGas,
			Gas:       gasLimit,
			To:        &toAddr,
			Value:     value,
			Data:      data,
		})
	}

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
		To:             req.To,  // Logical recipient (for display)
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
			"tx_to":                    toAddr.Hex(),  // Actual transaction target (token contract for ERC-20)
			"tx_value":                 value.String(), // Actual transaction value (0 for ERC-20)
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
	// Note: Empty 'to' is allowed for contract deployments when data (memo) is provided
	if req.To == "" {
		// Check if this is a contract deployment (has data/memo)
		if req.Memo == "" {
			return chainadapter.NewNonRetryableError(
				chainadapter.ErrCodeInvalidAddress,
				"to address is required (or provide data for contract deployment)",
				nil,
			)
		}
		// Contract deployment: to is empty, memo contains bytecode
	} else if !tb.isValidAddress(req.To) {
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

	// Validate Asset (allow ERC-20 tokens when token_address is provided). Use the
	// shared resolver so a non-empty-but-invalid token_address is rejected here too
	// (and so "is this ERC-20" is decided the same way as in Build / gas estimation).
	tokenAddr, err := resolveERC20TokenAddress(req)
	if err != nil {
		return err
	}
	isERC20 := tokenAddr != ""

	// For ERC-20, asset can be the token symbol; for native, must be ETH
	if !isERC20 && req.Asset != "ETH" && req.Asset != "ethereum" && req.Asset != "" {
		return chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeUnsupportedAsset,
			fmt.Sprintf("unsupported asset: %s (use 'ETH' for native Ethereum transfers)", req.Asset),
			nil,
		)
	}

	return nil
}

// isValidEthereumAddress checks if a string is a valid Ethereum address
// (0x-prefixed, 42 chars, valid hex). This is the single predicate every layer
// must use to decide "is this an ERC-20 transfer" — gas estimation (adapter.Build),
// transaction construction (builder.Build), and request validation must agree, or
// they diverge (estimate one shape, build another).
func isValidEthereumAddress(addr string) bool {
	if !strings.HasPrefix(addr, "0x") {
		return false
	}
	if len(addr) != 42 { // 0x + 40 hex characters
		return false
	}
	return common.IsHexAddress(addr)
}

// resolveERC20TokenAddress is the SINGLE source of truth for whether a request is
// an ERC-20 transfer. It reads ChainSpecific["token_address"] and returns:
//   - ("", nil)        → native transfer (no token_address)
//   - (addr, nil)      → ERC-20 transfer to a valid token contract
//   - ("", error)      → a non-empty token_address that is INVALID — a hard,
//     non-retryable error. It must NEVER be silently downgraded to a native
//     transfer: the user asked to send a token; quietly sending the native coin
//     to the recipient instead would be an asset-safety failure.
func resolveERC20TokenAddress(req *chainadapter.TransactionRequest) (string, error) {
	if req.ChainSpecific == nil {
		return "", nil
	}
	ta, ok := req.ChainSpecific["token_address"].(string)
	if !ok || ta == "" {
		return "", nil
	}
	if !isValidEthereumAddress(ta) {
		return "", chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeInvalidAddress,
			fmt.Sprintf("invalid token_address: %s", ta),
			nil,
		)
	}
	return ta, nil
}

// isValidAddress checks if an Ethereum address is valid.
func (tb *TransactionBuilder) isValidAddress(addr string) bool {
	return isValidEthereumAddress(addr)
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
