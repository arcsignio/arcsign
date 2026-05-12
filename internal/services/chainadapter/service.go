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
	"os"
	"sync"
	"time"

	"github.com/arcsignio/arcsign/src/chainadapter"
	"github.com/arcsignio/arcsign/src/chainadapter/bitcoin"
	"github.com/arcsignio/arcsign/src/chainadapter/ethereum"
	caRPC "github.com/arcsignio/arcsign/src/chainadapter/rpc"
	"github.com/arcsignio/arcsign/src/chainadapter/storage"
	"github.com/arcsignio/arcsign/internal/rpc"
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
	// Resolve RPC endpoint first so we can use it in the cache key
	if rpcEndpoint == "" {
		rpcEndpoint = getDefaultRPCEndpoint(chainId)
	}

	// Create cache key that includes both chainId and rpcEndpoint
	// This allows different endpoints for the same chain (e.g., different API keys)
	cacheKey := chainId + "|" + rpcEndpoint

	// Check cache first (read lock)
	s.mu.RLock()
	if adapter, exists := s.adapters[cacheKey]; exists {
		s.mu.RUnlock()
		return adapter, nil
	}
	s.mu.RUnlock()

	// Create adapter (write lock)
	s.mu.Lock()
	defer s.mu.Unlock()

	// Double-check after acquiring write lock (another goroutine might have created it)
	if adapter, exists := s.adapters[cacheKey]; exists {
		return adapter, nil
	}

	// Create RPC client with all available endpoints for failover
	// If user provided a custom endpoint, use only that; otherwise use all from registry
	var endpoints []string
	if rpcEndpoint == getDefaultRPCEndpoint(chainId) {
		// Using default - get all endpoints (primary + backups) for failover
		allEndpoints, err := rpc.DefaultRegistry.GetAllRPCEndpoints(chainId)
		if err != nil || len(allEndpoints) == 0 {
			endpoints = []string{rpcEndpoint}
		} else {
			endpoints = allEndpoints
		}
	} else {
		// User provided custom endpoint - use only that
		endpoints = []string{rpcEndpoint}
	}

	// Log endpoints for debugging
	fmt.Fprintf(os.Stderr, "[ChainAdapter] Creating RPC client for %s with %d endpoint(s): %v\n", chainId, len(endpoints), endpoints)

	rpcClient, err := caRPC.NewHTTPRPCClient(endpoints, 30*time.Second, nil)
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
	case "bsc", "bsc-mainnet", "bnb":
		// BSC Mainnet - uses same EVM-compatible adapter as Ethereum
		adapter, err = ethereum.NewEthereumAdapter(rpcClient, s.txStore, 56, nil)
	case "bsc-testnet", "bnb-testnet":
		// BSC Testnet - chain ID 97
		adapter, err = ethereum.NewEthereumAdapter(rpcClient, s.txStore, 97, nil)
	case "polygon", "polygon-mainnet":
		// Polygon Mainnet
		adapter, err = ethereum.NewEthereumAdapter(rpcClient, s.txStore, 137, nil)
	case "arbitrum", "arbitrum-mainnet":
		// Arbitrum One
		adapter, err = ethereum.NewEthereumAdapter(rpcClient, s.txStore, 42161, nil)
	case "optimism", "optimism-mainnet":
		// Optimism
		adapter, err = ethereum.NewEthereumAdapter(rpcClient, s.txStore, 10, nil)
	case "base", "base-mainnet":
		// Base
		adapter, err = ethereum.NewEthereumAdapter(rpcClient, s.txStore, 8453, nil)
	default:
		return nil, fmt.Errorf("unsupported chainId: %s", chainId)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create adapter for %s: %w", chainId, err)
	}

	// Cache the adapter using cacheKey (chainId + rpcEndpoint)
	s.adapters[cacheKey] = adapter

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
// Uses the unified RPC Registry for all endpoint resolution.
func getDefaultRPCEndpoint(chainId string) string {
	endpoint, err := rpc.GetRPC(chainId)
	if err != nil {
		// Fallback to localhost for unknown chains
		return "http://127.0.0.1:8545"
	}
	return endpoint
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
