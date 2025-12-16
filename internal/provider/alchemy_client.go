/**
 * Alchemy API client for token balance queries
 * Feature: Query token balances across multiple chains
 */

package provider

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strconv"
	"strings"
)

const (
	AlchemyAPIBaseURL = "https://api.g.alchemy.com/data/v1"
)

// AlchemyClient handles communication with Alchemy API
type AlchemyClient struct {
	apiKey     string
	httpClient *http.Client
}

// NewAlchemyClient creates a new Alchemy API client
func NewAlchemyClient(apiKey string) *AlchemyClient {
	return &AlchemyClient{
		apiKey:     apiKey,
		httpClient: &http.Client{},
	}
}

// GetTokenBalancesByAddress queries token balances for multiple addresses across networks
func (c *AlchemyClient) GetTokenBalancesByAddress(addresses []AlchemyAddressWithNetworks) (*AlchemyTokenBalanceResponse, error) {
	// Build request
	requestBody := AlchemyTokenBalanceRequest{
		Addresses: addresses,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Construct URL
	url := fmt.Sprintf("%s/%s/assets/tokens/by-address", AlchemyAPIBaseURL, c.apiKey)

	// Create HTTP request
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var response AlchemyTokenBalanceResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &response, nil
}

// SimplifyTokenBalances converts Alchemy response to simplified format
func SimplifyTokenBalances(alchemyResponse *AlchemyTokenBalanceResponse) []SimplifiedTokenBalance {
	var result []SimplifiedTokenBalance

	for _, token := range alchemyResponse.Data.Tokens {
		// Fix decimals for native tokens (Alchemy returns 0 for native tokens)
		decimals := token.TokenMetadata.Decimals
		if token.TokenAddress == "" && decimals == 0 {
			// Native tokens typically use 18 decimals
			decimals = 18
		}
		
		// Convert raw balance to human-readable format
		balance := formatTokenBalance(token.TokenBalance, decimals)

		// Get USD price and value
		var priceUSD float64
		var usdValue float64
		if len(token.TokenPrices) > 0 {
			for _, price := range token.TokenPrices {
				if price.Currency == "usd" {
					priceUSD, _ = strconv.ParseFloat(price.Value, 64)
					break
				}
			}
		}

		// Calculate USD value
		if balanceFloat, err := strconv.ParseFloat(balance, 64); err == nil {
			usdValue = balanceFloat * priceUSD
		}

		// Get human-readable network label
		networkLabel := getNetworkLabel(token.Network)

		result = append(result, SimplifiedTokenBalance{
			Address:      token.Address,
			Network:      token.Network,
			NetworkLabel: networkLabel,
			TokenAddress: token.TokenAddress,
			TokenSymbol:  token.TokenMetadata.Symbol,
			TokenName:    token.TokenMetadata.Name,
			TokenLogo:    token.TokenMetadata.Logo,
			Balance:      balance,
			RawBalance:   token.TokenBalance,
			Decimals:     decimals,
			USDValue:     usdValue,
			PriceUSD:     priceUSD,
			Error:        token.Error,
		})
	}

	return result
}

// formatTokenBalance converts raw balance string to human-readable format
func formatTokenBalance(rawBalance string, decimals int) string {
	// Handle hex format (0x prefix)
	var balance *big.Int
	var ok bool
	
	if strings.HasPrefix(rawBalance, "0x") || strings.HasPrefix(rawBalance, "0X") {
		// Parse as hexadecimal (remove 0x prefix)
		balance = new(big.Int)
		_, ok = balance.SetString(rawBalance[2:], 16)
	} else {
		// Parse as decimal
		balance, ok = new(big.Int).SetString(rawBalance, 10)
	}
	
	if !ok {
		return "0"
	}

	// Create divisor (10^decimals)
	divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)

	// Divide: quotient and remainder
	quotient := new(big.Int).Div(balance, divisor)
	remainder := new(big.Int).Mod(balance, divisor)

	// Format with decimals
	if remainder.Sign() == 0 {
		return quotient.String()
	}

	// Pad remainder with leading zeros
	remainderStr := remainder.String()
	paddingNeeded := decimals - len(remainderStr)
	if paddingNeeded > 0 {
		remainderStr = strings.Repeat("0", paddingNeeded) + remainderStr
	}

	// Trim trailing zeros
	remainderStr = strings.TrimRight(remainderStr, "0")

	if remainderStr == "" {
		return quotient.String()
	}

	return fmt.Sprintf("%s.%s", quotient.String(), remainderStr)
}

// getNetworkLabel converts Alchemy network identifier to human-readable label
func getNetworkLabel(network string) string {
	labels := map[string]string{
		NetworkEthMainnet:      "Ethereum",
		NetworkPolygonMainnet:  "Polygon",
		NetworkArbitrumMainnet: "Arbitrum",
		NetworkOptimismMainnet: "Optimism",
		NetworkBaseMainnet:     "Base",
		NetworkBnbMainnet:      "BNB Chain",
	}

	if label, ok := labels[network]; ok {
		return label
	}
	return network
}
