package signgate

import (
	"context"
	"errors"
	"testing"

	"github.com/arcsignio/arcsign/internal/security/blacklist"
	"github.com/arcsignio/arcsign/internal/security/txguard"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
)

const evilAddr = "0x000000000000000000000000000000000000bAd0"

func cleanGuard(t *testing.T) *txguard.Guard {
	t.Helper()
	return txguard.NewGuard(blacklist.NewManager(nil), nil)
}
func blacklistingGuard(t *testing.T) *txguard.Guard {
	t.Helper()
	mgr := blacklist.NewManager(nil)
	mgr.AddAddress(evilAddr, "test", "scam")
	return txguard.NewGuard(mgr, nil)
}

// tdForTest builds a *apitypes.TypedData analogous to txguard's tdWith.
func tdForTest(primaryType string, msg map[string]interface{}, verifying string) *apitypes.TypedData {
	return &apitypes.TypedData{
		PrimaryType: primaryType,
		Domain:      apitypes.TypedDataDomain{VerifyingContract: verifying},
		Message:     msg,
	}
}

func TestAuthorize(t *testing.T) {
	ctx := context.Background()

	t.Run("safe message → nil", func(t *testing.T) {
		if err := Authorize(ctx, cleanGuard(t), SignRequest{Kind: KindMessage, Message: []byte("hello")}); err != nil {
			t.Fatalf("want nil, got %v", err)
		}
	})
	t.Run("danger + not acknowledged → ErrBlocked", func(t *testing.T) {
		req := SignRequest{Kind: KindMessage, Message: []byte("send to " + evilAddr + " now")}
		if err := Authorize(ctx, blacklistingGuard(t), req); !errors.Is(err, ErrBlocked) {
			t.Fatalf("want ErrBlocked, got %v", err)
		}
	})
	t.Run("danger + acknowledged → nil", func(t *testing.T) {
		req := SignRequest{Kind: KindMessage, Message: []byte("send to " + evilAddr + " now"), AcknowledgedRisk: true}
		if err := Authorize(ctx, blacklistingGuard(t), req); err != nil {
			t.Fatalf("want nil (acknowledged), got %v", err)
		}
	})
	t.Run("nil guard → fail-open nil", func(t *testing.T) {
		if err := Authorize(ctx, nil, SignRequest{Kind: KindMessage, Message: []byte("x")}); err != nil {
			t.Fatalf("want fail-open nil, got %v", err)
		}
	})
	t.Run("typed-data malformed verifyingContract + not ack → ErrBlocked", func(t *testing.T) {
		td := tdForTest("Permit", map[string]interface{}{"spender": "0x1111111254eeb25477b68fb85ed929f73a960582"}, "996101235222674412020337938588541139382869425796")
		req := SignRequest{Kind: KindTypedData, TypedData: td}
		if err := Authorize(ctx, cleanGuard(t), req); !errors.Is(err, ErrBlocked) {
			t.Fatalf("want ErrBlocked for malformed domain, got %v", err)
		}
	})
}
