module github.com/yourusername/arcsign

go 1.25.0

require (
	github.com/SonarBeserk/gousbdrivedetector v0.0.0-20161027045320-4d29e4d6f1b7
	golang.org/x/crypto v0.43.0
)

require (
	github.com/arcsign/chainadapter v0.0.0-00010101000000-000000000000
	github.com/btcsuite/btcd v0.24.2
	github.com/btcsuite/btcd/btcutil v1.1.6
	github.com/ethereum/go-ethereum v1.16.5
	github.com/tyler-smith/go-bip39 v1.1.0
	golang.org/x/sys v0.37.0
)

require (
	github.com/bits-and-blooms/bitset v1.20.0 // indirect
	github.com/btcsuite/btcd/btcec/v2 v2.2.0 // indirect
	github.com/btcsuite/btcd/chaincfg/chainhash v1.1.0 // indirect
	github.com/btcsuite/btclog v0.0.0-20170628155309-84c8d2346e9f // indirect
	github.com/btcsuite/btcutil v1.0.3-0.20201208143702-a53e38424cce // indirect
	github.com/consensys/gnark-crypto v0.18.0 // indirect
	github.com/crate-crypto/go-eth-kzg v1.4.0 // indirect
	github.com/crate-crypto/go-ipa v0.0.0-20240724233137-53bbb0ceb27a // indirect
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/decred/dcrd/dcrec/secp256k1/v4 v4.4.0 // indirect
	github.com/ethereum/c-kzg-4844/v2 v2.1.3 // indirect
	github.com/ethereum/go-verkle v0.2.2 // indirect
	github.com/gorilla/websocket v1.5.3 // indirect
	github.com/holiman/uint256 v1.3.2 // indirect
	github.com/mitchellh/mapstructure v1.5.0 // indirect
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	github.com/supranational/blst v0.3.16-0.20250831170142-f48500c1fdbe // indirect
	golang.org/x/sync v0.12.0 // indirect
)

// Local module replacement for chainadapter
replace github.com/arcsign/chainadapter => ./src/chainadapter

// Workaround for Zilliqa SDK dependency on old btcec path
replace github.com/btcsuite/btcd => github.com/btcsuite/btcd v0.22.3
