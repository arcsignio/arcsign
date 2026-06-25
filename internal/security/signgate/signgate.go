// Package signgate is the single, mandatory security entry point every signing
// path must pass before a private key is touched. It is independent of the FFI
// layer so the gate cannot be bypassed by a future export that forgets to call
// it — deriveAndSign (internal/lib) calls Authorize first and is the only place
// that derives a key.
package signgate

import (
	"context"
	"errors"

	"github.com/arcsignio/arcsign/internal/security/simulation"
	"github.com/arcsignio/arcsign/internal/security/txguard"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
)

// ErrBlocked is returned when a request is dangerous and not acknowledged.
// The FFI layer maps this to ErrBlacklisted ("BLACKLISTED_TARGET").
var ErrBlocked = errors.New("signing blocked: risk not acknowledged")

type SignKind int

const (
	KindTransaction SignKind = iota
	KindTypedData
	KindMessage
)

// SignRequest is the discriminated union describing what is about to be signed.
//
// NOTE on missing payloads: if Kind is set but its payload field is nil/empty
// (e.g. KindTypedData with a nil TypedData), assess returns a safe report and
// Authorize ALLOWS the signature. This is deliberate fail-open: a missing
// payload carries no blacklisted address to check, and the gate never blocks on
// a check it cannot run (same posture as SignTransaction's existing gate). The
// real, unbypassable refusal happens only on an affirmative danger signal.
type SignRequest struct {
	Kind             SignKind
	ChainID          string
	AcknowledgedRisk bool

	To        string              // KindTransaction
	TypedData *apitypes.TypedData // KindTypedData
	Message   []byte              // KindMessage
}

// Authorize is the only security entry point. nil = allow, ErrBlocked = refuse.
// fail-open: nil guard or a check that can't run does NOT block (consistent
// with SignTransaction's existing gate).
func Authorize(ctx context.Context, g *txguard.Guard, req SignRequest) error {
	if g == nil {
		return nil
	}
	report := assess(ctx, g, req)
	if report != nil && report.RequiresAcknowledge && !req.AcknowledgedRisk {
		return ErrBlocked
	}
	return nil
}

func assess(ctx context.Context, g *txguard.Guard, req SignRequest) *txguard.SecurityReport {
	switch req.Kind {
	case KindTransaction:
		// isPro=true so the free blacklist runs; alchemyKey="" skips simulation.
		return g.Check(ctx, true, req.To, req.ChainID, "", simulation.TxParams{To: req.To})
	case KindTypedData:
		return g.CheckTypedData(ctx, req.TypedData)
	case KindMessage:
		return g.CheckMessage(req.Message)
	default:
		// Unknown kind: fail-open (allow). Same deliberate posture as a nil
		// payload — the gate only refuses on an affirmative danger signal.
		return nil
	}
}
