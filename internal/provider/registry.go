package provider

import (
	"context"
	"fmt"
	"sync"
)

// ProviderFactory is a function that creates a new BlockchainProvider instance
type ProviderFactory func(config *ProviderConfig) (BlockchainProvider, error)

// ProviderRegistry manages provider registration and instantiation
type ProviderRegistry struct {
	factories map[string]ProviderFactory // providerType -> factory
	providers map[string]BlockchainProvider // cacheKey -> provider instance
	mutex     sync.RWMutex
}

// Global registry instance
var globalRegistry *ProviderRegistry
var registryOnce sync.Once

// GetRegistry returns the global provider registry singleton
func GetRegistry() *ProviderRegistry {
	registryOnce.Do(func() {
		globalRegistry = &ProviderRegistry{
			factories: make(map[string]ProviderFactory),
			providers: make(map[string]BlockchainProvider),
		}
	})
	return globalRegistry
}

// RegisterProvider registers a provider factory for a given provider type
//
// Parameters:
// - providerType: Unique identifier for the provider (e.g., "alchemy", "infura")
// - factory: Function that creates provider instances
//
// Example:
//
//	RegisterProvider("alchemy", func(config *ProviderConfig) (BlockchainProvider, error) {
//	    return NewAlchemyProvider(config)
//	})
func (r *ProviderRegistry) RegisterProvider(providerType string, factory ProviderFactory) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if providerType == "" {
		return fmt.Errorf("provider type cannot be empty")
	}

	if factory == nil {
		return fmt.Errorf("provider factory cannot be nil")
	}

	if _, exists := r.factories[providerType]; exists {
		return fmt.Errorf("provider type %s already registered", providerType)
	}

	r.factories[providerType] = factory
	return nil
}

// GetProvider retrieves or creates a provider instance for the given configuration
//
// This method implements caching: if a provider with the same cache key already exists,
// it returns the cached instance. Otherwise, it creates a new instance using the
// registered factory.
//
// Parameters:
// - config: Provider configuration
//
// Returns:
// - BlockchainProvider instance
// - Error if provider type not registered or creation fails
func (r *ProviderRegistry) GetProvider(config *ProviderConfig) (BlockchainProvider, error) {
	if config == nil {
		return nil, fmt.Errorf("provider config is nil")
	}

	// Generate cache key: providerType-chainID-networkID
	cacheKey := fmt.Sprintf("%s-%s-%s", config.ProviderType, config.ChainID, config.NetworkID)

	// Check cache first (read lock)
	r.mutex.RLock()
	if provider, ok := r.providers[cacheKey]; ok {
		r.mutex.RUnlock()
		return provider, nil
	}
	r.mutex.RUnlock()

	// Not in cache, need to create (write lock)
	r.mutex.Lock()
	defer r.mutex.Unlock()

	// Double-check after acquiring write lock (another goroutine might have created it)
	if provider, ok := r.providers[cacheKey]; ok {
		return provider, nil
	}

	// Get factory for provider type
	factory, ok := r.factories[config.ProviderType]
	if !ok {
		return nil, fmt.Errorf("provider type %s not registered", config.ProviderType)
	}

	// Create new provider instance
	provider, err := factory(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create provider %s: %w", config.ProviderType, err)
	}

	// Cache the instance
	r.providers[cacheKey] = provider

	return provider, nil
}

// GetProviderForChain retrieves the best available provider for a given chain
//
// This method:
// 1. Looks up the highest-priority enabled provider from the config store
// 2. Creates or retrieves a cached provider instance
// 3. Verifies provider health
//
// Parameters:
// - chainID: Chain identifier (e.g., "ethereum", "bitcoin")
// - configStore: Provider configuration store
//
// Returns:
// - BlockchainProvider instance
// - Error if no providers configured or all providers unhealthy
func (r *ProviderRegistry) GetProviderForChain(ctx context.Context, chainID string, configStore *ProviderConfigStore) (BlockchainProvider, error) {
	// Get best provider config from store
	config, err := configStore.GetBestProvider(chainID)
	if err != nil {
		return nil, fmt.Errorf("no provider configured for chain %s: %w", chainID, err)
	}

	// Get or create provider instance
	provider, err := r.GetProvider(config)
	if err != nil {
		return nil, err
	}

	// Verify provider health
	if err := provider.HealthCheck(ctx); err != nil {
		return nil, fmt.Errorf("provider %s unhealthy for chain %s: %w", config.ProviderType, chainID, err)
	}

	return provider, nil
}

// GetProviderWithFallback retrieves a provider for a chain with automatic fallback
//
// This method tries providers in priority order until it finds a healthy one.
//
// Parameters:
// - chainID: Chain identifier
// - configStore: Provider configuration store
//
// Returns:
// - BlockchainProvider instance
// - Error if all providers fail health check
func (r *ProviderRegistry) GetProviderWithFallback(ctx context.Context, chainID string, configStore *ProviderConfigStore) (BlockchainProvider, error) {
	// Get all enabled providers for chain, sorted by priority
	configs, err := configStore.GetAllForChain(chainID)
	if err != nil {
		return nil, fmt.Errorf("no providers configured for chain %s: %w", chainID, err)
	}

	if len(configs) == 0 {
		return nil, fmt.Errorf("no enabled providers for chain %s", chainID)
	}

	// Sort by priority (descending)
	sortConfigsByPriority(configs)

	// Try each provider until one passes health check
	var lastErr error
	for _, config := range configs {
		provider, err := r.GetProvider(config)
		if err != nil {
			lastErr = err
			continue
		}

		// Health check with short timeout
		healthCtx, cancel := context.WithTimeout(ctx, 5*1000000000) // 5 seconds
		err = provider.HealthCheck(healthCtx)
		cancel()

		if err == nil {
			return provider, nil
		}

		lastErr = fmt.Errorf("provider %s failed health check: %w", config.ProviderType, err)
	}

	return nil, fmt.Errorf("all providers unhealthy for chain %s: %w", chainID, lastErr)
}

// ClearCache removes all cached provider instances
//
// This is useful when:
// - Provider configurations have been updated
// - Forcing recreation of provider connections
// - Cleaning up resources
func (r *ProviderRegistry) ClearCache() {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	// Close all providers before clearing cache
	for _, provider := range r.providers {
		_ = provider.Close() // Ignore errors during cleanup
	}

	r.providers = make(map[string]BlockchainProvider)
}

// RemoveFromCache removes a specific provider from cache
func (r *ProviderRegistry) RemoveFromCache(providerType, chainID, networkID string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	cacheKey := fmt.Sprintf("%s-%s-%s", providerType, chainID, networkID)

	if provider, ok := r.providers[cacheKey]; ok {
		_ = provider.Close() // Ignore errors during cleanup
		delete(r.providers, cacheKey)
	}

	return nil
}

// ListRegisteredProviders returns all registered provider types
func (r *ProviderRegistry) ListRegisteredProviders() []string {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	types := make([]string, 0, len(r.factories))
	for providerType := range r.factories {
		types = append(types, providerType)
	}
	return types
}

// IsProviderRegistered checks if a provider type is registered
func (r *ProviderRegistry) IsProviderRegistered(providerType string) bool {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	_, ok := r.factories[providerType]
	return ok
}

// sortConfigsByPriority sorts provider configs by priority (descending)
func sortConfigsByPriority(configs []*ProviderConfig) {
	// Simple bubble sort (adequate for small number of providers)
	n := len(configs)
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-i-1; j++ {
			if configs[j].Priority < configs[j+1].Priority {
				configs[j], configs[j+1] = configs[j+1], configs[j]
			}
		}
	}
}

// RegisterProvider is a convenience function to register a provider with the global registry
func RegisterProvider(providerType string, factory ProviderFactory) error {
	return GetRegistry().RegisterProvider(providerType, factory)
}
