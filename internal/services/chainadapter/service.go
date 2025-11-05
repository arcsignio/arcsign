// Package chainadapter provides a service for managing ChainAdapter instances.
// This service handles adapter initialization, caching, and routing based on chainId.
//
// Feature: 006-chain-adapter - ChainAdapter Transaction FFI Integration
// Created: 2025-11-05
package chainadapter

import (
	"context"
	"fmt"
	"math/big"
	"sync"
	"time"

	"github.com/arcsign/chainadapter"
	"github.com/arcsign/chainadapter/bitcoin"
	"github.com/arcsign/chainadapter/ethereum"
	"github.com/arcsign/chainadapter/rpc"
	"github.com/arcsign/chainadapter/storage"
)

// Service manages ChainAdapter instances for different blockchains.
//
// Thread Safety:
// - All methods are thread-safe
// - Uses mutex for adapter cache access
// - Adapter instances are immutable after creation
type Service struct {
	adapters map[string]chainadapter.ChainAdapter // cache: chainId -> adapter
	txStore  storage.TransactionStateStore
	mu       sync.RWMutex
}

// NewService creates a new ChainAdapter service.
//
// Parameters:
// - txStore: Optional transaction state store for broadcast idempotency (pass nil for in-memory)
func NewService(txStore storage.TransactionStateStore) *Service {
	// Use in-memory store if none provided
	if txStore == nil {
		txStore = storage.NewMemoryTxStore()
	}

	return &Service{
		adapters: make(map[string]chainadapter.ChainAdapter),
		txStore:  txStore,
	}
}

// GetAdapter returns a ChainAdapter instance for the specified chainId.
//
// Supported chainIds:
// - "bitcoin", "bitcoin-testnet", "bitcoin-regtest"
// - "ethereum", "ethereum-goerli", "ethereum-sepolia"
//
// Parameters:
// - chainId: Blockchain identifier
// - rpcEndpoint: Optional RPC endpoint URL (uses default if empty)
//
// Returns:
// - ChainAdapter instance
// - Error if chainId not supported or adapter initialization fails
func (s *Service) GetAdapter(ctx context.Context, chainId string, rpcEndpoint string) (chainadapter.ChainAdapter, error) {
	// Check cache first (read lock)
	s.mu.RLock()
	if adapter, exists := s.adapters[chainId]; exists {
		s.mu.RUnlock()
		return adapter, nil
	}
	s.mu.RUnlock()

	// Create adapter (write lock)
	s.mu.Lock()
	defer s.mu.Unlock()

	// Double-check after acquiring write lock (another goroutine might have created it)
	if adapter, exists := s.adapters[chainId]; exists {
		return adapter, nil
	}

	// Create RPC client
	var rpcClient rpc.RPCClient
	var err error

	if rpcEndpoint == "" {
		rpcEndpoint = getDefaultRPCEndpoint(chainId)
	}

	// Create HTTP RPC client with default timeout and nil health tracker
	rpcClient, err = rpc.NewHTTPRPCClient([]string{rpcEndpoint}, 30*time.Second, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create RPC client: %w", err)
	}

	// Create adapter based on chainId
	var adapter chainadapter.ChainAdapter
	switch chainId {
	case "bitcoin":
		adapter, err = bitcoin.NewBitcoinAdapter(rpcClient, s.txStore, "mainnet", nil)
	case "bitcoin-testnet":
		adapter, err = bitcoin.NewBitcoinAdapter(rpcClient, s.txStore, "testnet3", nil)
	case "bitcoin-regtest":
		adapter, err = bitcoin.NewBitcoinAdapter(rpcClient, s.txStore, "regtest", nil)
	case "ethereum":
		adapter, err = ethereum.NewEthereumAdapter(rpcClient, s.txStore, 1, nil)
	case "ethereum-goerli":
		adapter, err = ethereum.NewEthereumAdapter(rpcClient, s.txStore, 5, nil)
	case "ethereum-sepolia":
		adapter, err = ethereum.NewEthereumAdapter(rpcClient, s.txStore, 11155111, nil)
	default:
		return nil, fmt.Errorf("unsupported chainId: %s", chainId)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create adapter for %s: %w", chainId, err)
	}

	// Cache the adapter
	s.adapters[chainId] = adapter

	return adapter, nil
}

// BuildTransaction constructs an unsigned transaction.
func (s *Service) BuildTransaction(ctx context.Context, chainId string, req *chainadapter.TransactionRequest, rpcEndpoint string) (*chainadapter.UnsignedTransaction, error) {
	adapter, err := s.GetAdapter(ctx, chainId, rpcEndpoint)
	if err != nil {
		return nil, err
	}

	return adapter.Build(ctx, req)
}

// EstimateFee calculates fee estimates with confidence bounds.
func (s *Service) EstimateFee(ctx context.Context, chainId string, req *chainadapter.TransactionRequest, rpcEndpoint string) (*chainadapter.FeeEstimate, error) {
	adapter, err := s.GetAdapter(ctx, chainId, rpcEndpoint)
	if err != nil {
		return nil, err
	}

	return adapter.Estimate(ctx, req)
}

// SignTransaction signs an unsigned transaction using the provided signer.
func (s *Service) SignTransaction(ctx context.Context, chainId string, unsigned *chainadapter.UnsignedTransaction, signer chainadapter.Signer, rpcEndpoint string) (*chainadapter.SignedTransaction, error) {
	adapter, err := s.GetAdapter(ctx, chainId, rpcEndpoint)
	if err != nil {
		return nil, err
	}

	return adapter.Sign(ctx, unsigned, signer)
}

// BroadcastTransaction submits a signed transaction to the blockchain network.
func (s *Service) BroadcastTransaction(ctx context.Context, chainId string, signed *chainadapter.SignedTransaction, rpcEndpoint string) (*chainadapter.BroadcastReceipt, error) {
	adapter, err := s.GetAdapter(ctx, chainId, rpcEndpoint)
	if err != nil {
		return nil, err
	}

	return adapter.Broadcast(ctx, signed)
}

// QueryTransactionStatus retrieves the current status of a transaction.
func (s *Service) QueryTransactionStatus(ctx context.Context, chainId string, txHash string, rpcEndpoint string) (*chainadapter.TransactionStatus, error) {
	adapter, err := s.GetAdapter(ctx, chainId, rpcEndpoint)
	if err != nil {
		return nil, err
	}

	return adapter.QueryStatus(ctx, txHash)
}

// getDefaultRPCEndpoint returns the default RPC endpoint for a chainId.
func getDefaultRPCEndpoint(chainId string) string {
	defaults := map[string]string{
		"bitcoin":           "http://127.0.0.1:8332",
		"bitcoin-testnet":   "http://127.0.0.1:18332",
		"bitcoin-regtest":   "http://127.0.0.1:18443",
		"ethereum":          "http://127.0.0.1:8545",
		"ethereum-goerli":   "http://127.0.0.1:8545",
		"ethereum-sepolia":  "http://127.0.0.1:8545",
	}

	if endpoint, ok := defaults[chainId]; ok {
		return endpoint
	}

	return "http://127.0.0.1:8545"
}

// ParseAmount parses a string amount to *big.Int.
// Supports decimal notation (e.g., "1.5" ETH = 1500000000000000000 wei).
func ParseAmount(amount string) (*big.Int, error) {
	result := new(big.Int)
	_, ok := result.SetString(amount, 10)
	if !ok {
		return nil, fmt.Errorf("invalid amount: %s", amount)
	}
	return result, nil
}
