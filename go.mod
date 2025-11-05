module github.com/yourusername/arcsign

go 1.25.0

require (
	github.com/SonarBeserk/gousbdrivedetector v0.0.0-20161027045320-4d29e4d6f1b7
	golang.org/x/crypto v0.43.0
)

require (
	blockwatch.cc/tzgo v1.18.4
	github.com/Zilliqa/gozilliqa-sdk v1.2.0
	github.com/anyproto/go-slip10 v1.0.0
	github.com/arcsign/chainadapter v0.0.0-00010101000000-000000000000
	github.com/btcsuite/btcd v0.24.2
	github.com/btcsuite/btcd/btcutil v1.1.6
	github.com/ethereum/go-ethereum v1.16.5
	github.com/gagliardetto/solana-go v1.14.0
	github.com/mr-tron/base58 v1.2.0
	github.com/stellar/go v0.0.0-20251014044201-dd6ce8e5f01d
	github.com/stretchr/testify v1.11.1
	github.com/tyler-smith/go-bip39 v1.1.0
	github.com/vedhavyas/go-subkey v1.0.4
	golang.org/x/sys v0.37.0
)

require (
	filippo.io/edwards25519 v1.0.0-rc.1 // indirect
	github.com/ChainSafe/go-schnorrkel v1.1.0 // indirect
	github.com/bits-and-blooms/bitset v1.20.0 // indirect
	github.com/blendle/zapdriver v1.3.1 // indirect
	github.com/btcsuite/btcd/btcec/v2 v2.2.0 // indirect
	github.com/btcsuite/btcd/chaincfg/chainhash v1.1.0 // indirect
	github.com/btcsuite/btclog v0.0.0-20170628155309-84c8d2346e9f // indirect
	github.com/btcsuite/btcutil v1.0.3-0.20201208143702-a53e38424cce // indirect
	github.com/consensys/gnark-crypto v0.18.0 // indirect
	github.com/cosmos/go-bip39 v1.0.0 // indirect
	github.com/crate-crypto/go-eth-kzg v1.4.0 // indirect
	github.com/crate-crypto/go-ipa v0.0.0-20240724233137-53bbb0ceb27a // indirect
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/decred/base58 v1.0.4 // indirect
	github.com/decred/dcrd/crypto/blake256 v1.1.0 // indirect
	github.com/decred/dcrd/dcrec/secp256k1/v4 v4.4.0 // indirect
	github.com/ethereum/c-kzg-4844/v2 v2.1.3 // indirect
	github.com/ethereum/go-verkle v0.2.2 // indirect
	github.com/fatih/color v1.18.0 // indirect
	github.com/fsnotify/fsnotify v1.9.0 // indirect
	github.com/gagliardetto/binary v0.8.0 // indirect
	github.com/gagliardetto/treeout v0.1.4 // indirect
	github.com/gorilla/websocket v1.5.3 // indirect
	github.com/gtank/merlin v0.1.1 // indirect
	github.com/gtank/ristretto255 v0.1.2 // indirect
	github.com/holiman/uint256 v1.3.2 // indirect
	github.com/json-iterator/go v1.1.12 // indirect
	github.com/klauspost/compress v1.18.0 // indirect
	github.com/logrusorgru/aurora v2.0.3+incompatible // indirect
	github.com/mattn/go-colorable v0.1.14 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/mimoo/StrobeGo v0.0.0-20220103164710-9a04d6ca976b // indirect
	github.com/mitchellh/go-testing-interface v1.14.1 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/modern-go/reflect2 v1.0.2 // indirect
	github.com/mostynb/zstdpool-freelist v0.0.0-20201229113212-927304c0c3b1 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	github.com/stellar/go-xdr v0.0.0-20231122183749-b53fb00bcac2 // indirect
	github.com/streamingfast/logging v0.0.0-20230608130331-f22c91403091 // indirect
	github.com/stretchr/objx v0.5.2 // indirect
	github.com/supranational/blst v0.3.16-0.20250831170142-f48500c1fdbe // indirect
	go.mongodb.org/mongo-driver v1.12.2 // indirect
	go.uber.org/multierr v1.11.0 // indirect
	go.uber.org/zap v1.27.0 // indirect
	golang.org/x/sync v0.12.0 // indirect
	golang.org/x/term v0.36.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

// Local module replacement for chainadapter
replace github.com/arcsign/chainadapter => ./src/chainadapter

// Workaround for Zilliqa SDK dependency on old btcec path
replace github.com/btcsuite/btcd => github.com/btcsuite/btcd v0.22.3
