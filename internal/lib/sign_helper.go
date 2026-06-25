// Package main - shared signing helper.
//
// deriveAndSign is the SINGLE place in the FFI layer that decrypts a wallet and
// derives a private key. It runs signgate.Authorize FIRST, so no signing path
// can reach key material without passing the mandatory security gate. The
// per-export functions (SignMessage / SignTypedData / SignTransaction) supply a
// kind-specific hashFn and delegate all key handling here, keeping the
// decrypt+derive+sign sequence byte-identical across paths.
package main

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"

	"github.com/arcsignio/arcsign/internal/models"
	"github.com/arcsignio/arcsign/internal/security"
	"github.com/arcsignio/arcsign/internal/security/signgate"
	"github.com/arcsignio/arcsign/internal/services/bip39service"
	"github.com/arcsignio/arcsign/internal/services/hdkey"
	"github.com/arcsignio/arcsign/internal/services/wallet"
)

// errAddressNotFound is returned when the signing address is not present in the
// wallet's AddressBook. Callers map this to a user-facing FFI error code.
var errAddressNotFound = errors.New("address not found in wallet")

// errAddressMismatch is returned when the key derived for an EVM chain does not
// produce the expected From address (dev-mode verification, transaction path).
var errAddressMismatch = errors.New("key derivation address mismatch")

// signParams carries the wallet-access inputs deriveAndSign needs, decoupled
// from the per-export FFI input structs.
type signParams struct {
	WalletID   string
	Password   string
	Passphrase string
	USBPath    string
	Address    string
}

// deriveAndSign is the single decrypt+derive+sign path for MESSAGE and
// TYPED-DATA signing (SignMessage / SignTypedData). It calls signgate.Authorize
// FIRST — no message/typed-data path can reach key material without passing the
// gate. hashFn computes the kind-specific digest (EIP-191 / EIP-712) and runs
// AFTER authorization. Returns the 65-byte signature with v already adjusted
// (+27), or an error (signgate.ErrBlocked if the gate refuses).
//
// NOTE: this is NOT the only key-derivation site in the package. SignTransaction
// (exports_transaction.go) keeps its own decrypt/derive flow (it signs via the
// multi-step ChainAdapter, a different shape than a single SignHash), but it ALSO
// calls signgate.Authorize before touching the key. The invariant is "every
// signing path gates BEFORE deriving the key", not "one derivation entry point".
func deriveAndSign(ctx context.Context, p signParams, req signgate.SignRequest, hashFn func() (common.Hash, error)) ([]byte, error) {
	// 1) MANDATORY security gate — before any key material exists.
	gateCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	err := signgate.Authorize(gateCtx, initTxGuard(), req)
	cancel()
	if err != nil {
		return nil, err
	}

	// 2-3) Decrypt + derive + build XOR-split signer (shared helper).
	// message/typed-data: chainID "ethereum" (EVM-identical raw sig over a hash),
	// case-insensitive AddressBook lookup, no dev EVM verification.
	secureSigner, err := deriveSecureSigner(p, deriveOpts{
		SignerChainID:       "ethereum",
		CaseInsensitiveAddr: true,
		VerifyEVMAddress:    false,
	})
	if err != nil {
		return nil, err
	}
	defer secureSigner.Zeroize()

	// 3) Hash (kind-specific) + sign.
	hash, err := hashFn()
	if err != nil {
		return nil, err
	}
	signature, err := secureSigner.SignHash(hash.Bytes(), p.Address)
	if err != nil {
		return nil, err
	}
	// Adjust v for Ethereum compatibility (go-ethereum returns 0/1).
	if signature[64] < 27 {
		signature[64] += 27
	}
	return signature, nil
}

// deriveOpts carries the per-path differences in the decrypt+derive flow so the
// shared deriveSecureSigner stays one implementation.
type deriveOpts struct {
	// SignerChainID is passed to NewSecureSigner. Transactions pass the real
	// chain ("bsc"/"bitcoin"/...); message & typed-data pass "ethereum".
	SignerChainID string
	// CaseInsensitiveAddr selects the AddressBook lookup: EqualFold (true,
	// message/typed-data) vs exact == (false, transaction).
	CaseInsensitiveAddr bool
	// VerifyEVMAddress runs the dev-mode "derived address == From" check for
	// EVM chains (transaction only).
	VerifyEVMAddress bool
}

// deriveSecureSigner decrypts the wallet, derives the private key, and builds an
// XOR-split SecureSigner — the shared "get a signer" prelude for ALL signing
// paths. Per-path differences are carried in opts.
//
// SECURITY — why decrypt+derive+build-signer live in ONE function and are NOT
// split into two layers: the plaintext private key (GetPrivateKey's output)
// must exist for the shortest possible time. Keeping GetPrivateKey and
// NewSecureSigner adjacent, in one function with no external hand-off and no
// error path between them, means the plaintext key is consumed (XOR-split +
// zeroed) by NewSecureSigner immediately. Splitting this into a derive() that
// RETURNS raw key bytes would lengthen the plaintext key's lifetime and add a
// copy/dump/forgot-to-zero window. Do NOT refactor this into two layers.
//
// Returns *SecureSigner; the CALLER must defer signer.Zeroize().
func deriveSecureSigner(p signParams, opts deriveOpts) (*security.SecureSigner, error) {
	walletSvc := wallet.NewWalletService(p.USBPath)
	mnemonic, err := walletSvc.RestoreWallet(p.WalletID, p.Password)
	if err != nil {
		return nil, err
	}
	defer zeroString(&mnemonic)

	walletObj, err := walletSvc.LoadWallet(p.WalletID)
	if err != nil {
		return nil, err
	}
	derivationPath, err := derivationPathFor(walletObj, p.Address, opts.CaseInsensitiveAddr)
	if err != nil {
		return nil, err
	}

	seed, err := bip39service.NewBIP39Service().MnemonicToSeed(mnemonic, p.Passphrase)
	if err != nil {
		return nil, err
	}
	defer security.SecureZero(seed)

	hdkeySvc := hdkey.NewHDKeyService()
	masterKey, err := hdkeySvc.NewMasterKey(seed)
	if err != nil {
		return nil, err
	}
	childKey, err := hdkeySvc.DerivePath(masterKey, derivationPath)
	if err != nil {
		return nil, err
	}
	privateKeyBytes, err := hdkeySvc.GetPrivateKey(childKey)
	if err != nil {
		return nil, err
	}

	// dev-mode EVM derived-address verification (transaction path only).
	if opts.VerifyEVMAddress {
		cid := opts.SignerChainID
		if strings.HasPrefix(cid, "ethereum") || strings.HasPrefix(cid, "bsc") ||
			strings.HasPrefix(cid, "polygon") || strings.HasPrefix(cid, "arbitrum") ||
			strings.HasPrefix(cid, "optimism") || strings.HasPrefix(cid, "base") {
			ethPrivKey, ethErr := ethcrypto.ToECDSA(privateKeyBytes)
			if ethErr == nil {
				derivedAddr := ethcrypto.PubkeyToAddress(ethPrivKey.PublicKey)
				if !strings.EqualFold(derivedAddr.Hex(), p.Address) {
					security.SecureZero(privateKeyBytes)
					return nil, errAddressMismatch
				}
			}
		}
	}

	// NewSecureSigner splits privateKeyBytes into XOR shares and zeroes the input
	// on success; on failure we zero it ourselves. Adjacent to GetPrivateKey by
	// design (see security note above) — no hand-off of the plaintext key.
	secureSigner, err := security.NewSecureSigner(privateKeyBytes, p.Address, opts.SignerChainID)
	if err != nil {
		security.SecureZero(privateKeyBytes)
		return nil, err
	}
	return secureSigner, nil
}

// derivationPathFor finds the address's derivation path in the wallet's
// AddressBook. caseInsensitive selects EqualFold (message/typed-data) vs exact
// == (transaction) — preserving each signing path's existing lookup behavior.
func derivationPathFor(walletObj *models.Wallet, address string, caseInsensitive bool) (string, error) {
	if walletObj.AddressBook == nil {
		return "", errAddressNotFound
	}
	for _, addr := range walletObj.AddressBook.Addresses {
		match := addr.Address == address
		if caseInsensitive {
			match = strings.EqualFold(addr.Address, address)
		}
		if match {
			return addr.DerivationPath, nil
		}
	}
	return "", errAddressNotFound
}
