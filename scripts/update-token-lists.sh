#!/bin/bash

# Token Lists Update Script
# Updates CoinGecko token lists for all supported chains

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TOKEN_LISTS_DIR="$SCRIPT_DIR/../dashboard/public/token-lists"

echo -e "${BLUE}====================================${NC}"
echo -e "${BLUE}   Token Lists Update Script${NC}"
echo -e "${BLUE}====================================${NC}"
echo ""

# Create directory if it doesn't exist
mkdir -p "$TOKEN_LISTS_DIR"

# Function to download token list
download_list() {
    local name=$1
    local url=$2
    local file=$3
    
    echo -e "${BLUE}Downloading $name...${NC}"
    if curl -f -o "$TOKEN_LISTS_DIR/$file" "$url"; then
        local count=$(jq '.tokens | length' "$TOKEN_LISTS_DIR/$file" 2>/dev/null || echo "N/A")
        echo -e "${GREEN}✓ $name downloaded ($count tokens)${NC}"
    else
        echo -e "\033[0;31m✗ Failed to download $name${NC}"
        return 1
    fi
}

# Download all token lists
echo "Downloading token lists from CoinGecko..."
echo ""

download_list "Ethereum (Uniswap)" \
    "https://tokens.coingecko.com/uniswap/all.json" \
    "ethereum.json"

download_list "Arbitrum One" \
    "https://tokens.coingecko.com/arbitrum-one/all.json" \
    "arbitrum.json"

download_list "Polygon PoS" \
    "https://tokens.coingecko.com/polygon-pos/all.json" \
    "polygon.json"

download_list "Optimism" \
    "https://tokens.coingecko.com/optimistic-ethereum/all.json" \
    "optimism.json"

download_list "Binance Smart Chain" \
    "https://tokens.coingecko.com/binance-smart-chain/all.json" \
    "bsc.json"

echo ""
echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}   All token lists updated!${NC}"
echo -e "${GREEN}====================================${NC}"
echo ""
echo "Token lists location: $TOKEN_LISTS_DIR"
echo ""
echo "Summary:"
ls -lh "$TOKEN_LISTS_DIR"
