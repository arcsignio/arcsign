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

	// 2) Decrypt + derive (mirrors the former per-export logic exactly).
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
	derivationPath, err := derivationPathFor(walletObj, p.Address, true)
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

	// NewSecureSigner splits privateKeyBytes into XOR shares and zeroes the
	// input on success; on failure we zero it ourselves before returning.
	// chainID is "ethereum": an EIP-191/EIP-712 (and tx) signature is a raw
	// secp256k1 sig over a hash, identical across the EVM family — so all signing
	// paths share one SecureSigner config. (Matches the former per-export code.)
	secureSigner, err := security.NewSecureSigner(privateKeyBytes, p.Address, "ethereum")
	if err != nil {
		security.SecureZero(privateKeyBytes)
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
