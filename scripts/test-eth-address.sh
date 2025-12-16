#!/bin/bash

# Quick test script to verify address derivation
# Usage: ./test-eth-address.sh "your mnemonic words here"

MNEMONIC="$1"

if [ -z "$MNEMONIC" ]; then
    echo "Usage: $0 \"your mnemonic words here\""
    exit 1
fi

echo "Testing Ethereum address derivation..."
echo "Mnemonic: $MNEMONIC"
echo ""
echo "Expected address: 0x59a3ed049ebf5483E32513b1Cd9557B570f6f5dE"
echo ""

# You can use an online tool or library to test
# For example: https://iancoleman.io/bip39/
echo "Please verify using:"
echo "1. Go to https://iancoleman.io/bip39/"
echo "2. Enter your mnemonic"
echo "3. Select 'ETH - Ethereum'"
echo "4. Check derivation path m/44'/60'/0'/0/0"
echo "5. Compare the generated address"
