// Package simulation provides transaction simulation using Alchemy's simulateAssetChanges API.
// This allows users to preview asset changes before signing a transaction.
package simulation

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	// DefaultTimeout for simulation requests
	DefaultTimeout = 15 * time.Second
)

// Alchemy chain subdomain mapping
var alchemyChainSubdomains = map[string]string{
	"ethereum": "eth-mainnet",
	"polygon":  "polygon-mainnet",
	"arbitrum": "arb-mainnet",
	"optimism": "opt-mainnet",
	"base":     "base-mainnet",
}

// SimulationResult contains the result of a transaction simulation.
type SimulationResult struct {
	Success      bool          `json:"success"`
	AssetChanges []AssetChange `json:"assetChanges"`
	GasUsed      string        `json:"gasUsed"`
	Error        string        `json:"error,omitempty"`
}

// AssetChange represents a single asset change from the simulation.
type AssetChange struct {
	AssetType  string `json:"assetType"`  // NATIVE, ERC20, ERC721, ERC1155
	ChangeType string `json:"changeType"` // TRANSFER, APPROVE
	From       string `json:"from"`
	To         string `json:"to"`
	Symbol     string `json:"symbol"`
	Decimals   int    `json:"decimals"`
	Amount     string `json:"amount"`
	Logo       string `json:"logo"`
}

// TxParams holds transaction parameters for simulation.
type TxParams struct {
	From  string `json:"from"`
	To    string `json:"to"`
	Value string `json:"value"` // hex-encoded wei
	Data  string `json:"data"`  // hex-encoded calldata
}

// Simulator performs transaction simulation via Alchemy API.
type Simulator struct {
	httpClient *http.Client
}

// NewSimulator creates a new transaction simulator.
func NewSimulator() *Simulator {
	return &Simulator{
		httpClient: &http.Client{
			Timeout: DefaultTimeout,
		},
	}
}

// SimulateTransaction simulates a transaction and returns predicted asset changes.
// chainID is the internal chain name (e.g. "ethereum", "polygon").
// alchemyKey is the decrypted Alchemy API key.
func (s *Simulator) SimulateTransaction(ctx context.Context, chainID string, alchemyKey string, tx TxParams) (*SimulationResult, error) {
	subdomain, ok := alchemyChainSubdomains[chainID]
	if !ok {
		return &SimulationResult{
			Success: false,
			Error:   fmt.Sprintf("simulation not supported for chain: %s", chainID),
		}, nil
	}

	if alchemyKey == "" {
		return &SimulationResult{
			Success: false,
			Error:   "Alchemy API key required for simulation",
		}, nil
	}

	// Build Alchemy JSON-RPC request
	rpcURL := fmt.Sprintf("https://%s.g.alchemy.com/v2/%s", subdomain, alchemyKey)

	rpcReq := alchemyRPCRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "alchemy_simulateAssetChanges",
		Params: []alchemySimulateParams{{
			From:  tx.From,
			To:    tx.To,
			Value: tx.Value,
			Data:  tx.Data,
		}},
	}

	reqBody, err := json.Marshal(rpcReq)
	if err != nil {
		return nil, fmt.Errorf("marshal simulation request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, rpcURL, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("create simulation request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return &SimulationResult{
			Success: false,
			Error:   fmt.Sprintf("simulation request failed: %v", err),
		}, nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 5*1024*1024)) // 5MB max
	if err != nil {
		return nil, fmt.Errorf("read simulation response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return &SimulationResult{
			Success: false,
			Error:   fmt.Sprintf("Alchemy API error: HTTP %d", resp.StatusCode),
		}, nil
	}

	// Parse response
	var rpcResp alchemyRPCResponse
	if err := json.Unmarshal(body, &rpcResp); err != nil {
		return nil, fmt.Errorf("parse simulation response: %w", err)
	}

	if rpcResp.Error != nil {
		return &SimulationResult{
			Success: false,
			Error:   rpcResp.Error.Message,
		}, nil
	}

	// Convert Alchemy response to our format
	return convertAlchemyResult(&rpcResp.Result), nil
}

// IsChainSupported returns true if the chain supports transaction simulation.
func IsChainSupported(chainID string) bool {
	_, ok := alchemyChainSubdomains[chainID]
	return ok
}

// convertAlchemyResult converts Alchemy's response to our SimulationResult format.
func convertAlchemyResult(result *alchemySimulateResult) *SimulationResult {
	if result == nil {
		return &SimulationResult{
			Success: false,
			Error:   "empty simulation result",
		}
	}

	if result.Error != nil {
		return &SimulationResult{
			Success: false,
			Error:   result.Error.Message,
			GasUsed: result.GasUsed,
		}
	}

	changes := make([]AssetChange, 0, len(result.Changes))
	for _, c := range result.Changes {
		changes = append(changes, AssetChange{
			AssetType:  c.AssetType,
			ChangeType: c.ChangeType,
			From:       c.From,
			To:         c.To,
			Symbol:     c.Symbol,
			Decimals:   c.Decimals,
			Amount:     c.RawAmount,
			Logo:       c.Logo,
		})
	}

	return &SimulationResult{
		Success:      true,
		AssetChanges: changes,
		GasUsed:      result.GasUsed,
	}
}

// SimulateBSCTransaction performs basic simulation for BSC using eth_call.
// Returns success/failure but no detailed asset changes.
func (s *Simulator) SimulateBSCTransaction(ctx context.Context, rpcURL string, tx TxParams) (*SimulationResult, error) {
	rpcReq := struct {
		JSONRPC string        `json:"jsonrpc"`
		Method  string        `json:"method"`
		Params  []interface{} `json:"params"`
		ID      int           `json:"id"`
	}{
		JSONRPC: "2.0",
		Method:  "eth_call",
		Params: []interface{}{
			map[string]string{
				"from":  tx.From,
				"to":    tx.To,
				"value": tx.Value,
				"data":  tx.Data,
			},
			"latest",
		},
		ID: 1,
	}

	reqBody, err := json.Marshal(rpcReq)
	if err != nil {
		return nil, fmt.Errorf("marshal BSC simulation request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, rpcURL, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("create BSC simulation request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return &SimulationResult{
			Success: false,
			Error:   fmt.Sprintf("BSC eth_call failed: %v", err),
		}, nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1*1024*1024))
	if err != nil {
		return nil, fmt.Errorf("read BSC simulation response: %w", err)
	}

	var rpcResp struct {
		Result string `json:"result"`
		Error  *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &rpcResp); err != nil {
		return nil, fmt.Errorf("parse BSC simulation response: %w", err)
	}

	if rpcResp.Error != nil {
		errMsg := rpcResp.Error.Message
		// Check for known revert patterns
		if strings.Contains(strings.ToLower(errMsg), "revert") ||
			strings.Contains(strings.ToLower(errMsg), "insufficient") {
			return &SimulationResult{
				Success: false,
				Error:   fmt.Sprintf("Transaction would fail: %s", errMsg),
			}, nil
		}
		return &SimulationResult{
			Success: false,
			Error:   errMsg,
		}, nil
	}

	return &SimulationResult{
		Success: true,
	}, nil
}

// --- Alchemy API types ---

type alchemyRPCRequest struct {
	JSONRPC string                   `json:"jsonrpc"`
	ID      int                      `json:"id"`
	Method  string                   `json:"method"`
	Params  []alchemySimulateParams  `json:"params"`
}

type alchemySimulateParams struct {
	From  string `json:"from"`
	To    string `json:"to"`
	Value string `json:"value,omitempty"`
	Data  string `json:"data,omitempty"`
}

type alchemyRPCResponse struct {
	JSONRPC string                `json:"jsonrpc"`
	ID      int                   `json:"id"`
	Result  alchemySimulateResult `json:"result"`
	Error   *alchemyRPCError      `json:"error,omitempty"`
}

type alchemyRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type alchemySimulateResult struct {
	Changes []alchemyAssetChange `json:"changes"`
	GasUsed string               `json:"gasUsed"`
	Error   *alchemySimError     `json:"error,omitempty"`
}

type alchemySimError struct {
	Message string `json:"message"`
}

type alchemyAssetChange struct {
	AssetType    string `json:"assetType"`
	ChangeType   string `json:"changeType"`
	From         string `json:"from"`
	To           string `json:"to"`
	RawAmount    string `json:"rawAmount"`
	Amount       string `json:"amount"`
	Symbol       string `json:"symbol"`
	Decimals     int    `json:"decimals"`
	ContractAddr string `json:"contractAddress"`
	Name         string `json:"name"`
	Logo         string `json:"logo"`
	TokenID      string `json:"tokenId,omitempty"`
}
