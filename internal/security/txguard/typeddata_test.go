package txguard

import (
	"context"
	"testing"

	"github.com/arcsignio/arcsign/internal/security/blacklist"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
)

func tdWith(primaryType string, msg map[string]interface{}, verifying string) *apitypes.TypedData {
	return &apitypes.TypedData{
		PrimaryType: primaryType,
		Domain:      apitypes.TypedDataDomain{VerifyingContract: verifying},
		Message:     msg,
	}
}

func TestExtractRiskyAddresses(t *testing.T) {
	const spender = "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa"
	const verifying = "0x1111111254eeb25477b68fb85ed929f73a960582"

	t.Run("Permit spender + verifyingContract", func(t *testing.T) {
		td := tdWith("Permit", map[string]interface{}{"spender": spender, "value": "1"}, verifying)
		got := extractRiskyAddresses(td)
		assertContains(t, got, verifying)
		assertContains(t, got, spender)
	})

	t.Run("PermitSingle nested Permit2 details", func(t *testing.T) {
		td := tdWith("PermitSingle", map[string]interface{}{
			"spender": spender,
			"details": map[string]interface{}{"token": verifying},
		}, "")
		got := extractRiskyAddresses(td)
		assertContains(t, got, spender)
	})

	t.Run("setApprovalForAll operator", func(t *testing.T) {
		td := tdWith("SetApprovalForAll", map[string]interface{}{"operator": spender}, "")
		got := extractRiskyAddresses(td)
		assertContains(t, got, spender)
	})

	t.Run("no risky fields → only verifyingContract", func(t *testing.T) {
		td := tdWith("Mail", map[string]interface{}{"contents": "hello"}, verifying)
		got := extractRiskyAddresses(td)
		assertContains(t, got, verifying)
		if len(got) != 1 {
			t.Fatalf("want only verifyingContract, got %v", got)
		}
	})
}

// evilAddress is injected into the blacklist via AddAddress so the
// "blacklisted spender" subtest is deterministic and not coupled to the
// embedded seed's exact contents (which shift as OFAC/MEW lists update).
const evilAddress = "0xbadbadbadbadbadbadbadbadbadbadbadbadbad0"

// newTestGuard builds a Guard whose blacklist Manager has the embedded seed
// loaded (offline, no net) but no hit for our test addresses. simulator is nil:
// CheckTypedData never touches the simulator.
func newTestGuard(t *testing.T) *Guard {
	t.Helper()
	return NewGuard(blacklist.NewManager(nil), nil)
}

// newTestGuardWithBlacklist builds a Guard whose Manager flags evilAddress.
func newTestGuardWithBlacklist(t *testing.T) *Guard {
	t.Helper()
	mgr := blacklist.NewManager(nil)
	mgr.AddAddress(evilAddress, "TestSource", "scam")
	return NewGuard(mgr, nil)
}

// blacklistedTestAddress returns an address known to be in the test blacklist.
func blacklistedTestAddress(t *testing.T) string {
	t.Helper()
	return evilAddress
}

func TestCheckTypedData(t *testing.T) {
	const verifying = "0x1111111254eeb25477b68fb85ed929f73a960582"
	ctx := context.Background()

	t.Run("malformed verifyingContract → danger + requires ack", func(t *testing.T) {
		g := newTestGuard(t) // no blacklist hit needed
		td := tdWith("Permit", map[string]interface{}{"spender": verifying},
			"996101235222674412020337938588541139382869425796")
		r := g.CheckTypedData(ctx, td)
		if r.RiskLevel != RiskDanger || !r.RequiresAcknowledge {
			t.Fatalf("want danger+ack, got level=%s ack=%v", r.RiskLevel, r.RequiresAcknowledge)
		}
		assertWarningType(t, r, "EIP712_MALFORMED_DOMAIN")
	})

	t.Run("blacklisted spender → danger + requires ack", func(t *testing.T) {
		evil := blacklistedTestAddress(t) // an address known to be in the blacklist
		g := newTestGuardWithBlacklist(t)
		td := tdWith("Permit", map[string]interface{}{"spender": evil}, verifying)
		r := g.CheckTypedData(ctx, td)
		if !r.RequiresAcknowledge || r.BlacklistMatch == nil {
			t.Fatalf("want blacklist match+ack, got %+v", r)
		}
	})

	t.Run("clean typed data → safe", func(t *testing.T) {
		g := newTestGuardWithBlacklist(t)
		td := tdWith("Mail", map[string]interface{}{"contents": "hi"}, verifying)
		r := g.CheckTypedData(ctx, td)
		if r.RiskLevel != RiskSafe || r.RequiresAcknowledge {
			t.Fatalf("want safe, got level=%s ack=%v", r.RiskLevel, r.RequiresAcknowledge)
		}
	})
}

func assertWarningType(t *testing.T, r *SecurityReport, typ string) {
	t.Helper()
	for _, w := range r.Warnings {
		if w.Type == typ {
			return
		}
	}
	t.Fatalf("expected warning %q in %+v", typ, r.Warnings)
}

func assertContains(t *testing.T, got []string, want string) {
	t.Helper()
	for _, g := range got {
		if g == want {
			return
		}
	}
	t.Fatalf("expected %q in %v", want, got)
}

func TestIsCanonicalAddress(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want bool
	}{
		{"valid lowercase", "0x1111111254eeb25477b68fb85ed929f73a960582", true},
		{"valid mixed case", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", true},
		{"empty is canonical (no verifyingContract)", "", true},
		{"decimal numeric bypass", "996101235222674412020337938588541139382869425796", false},
		{"missing 0x prefix", "1111111254eeb25477b68fb85ed929f73a960582", false},
		{"too short", "0x1234", false},
		{"too long", "0x1111111254eeb25477b68fb85ed929f73a96058200", false},
		{"non-hex chars", "0x1111111254eeb25477b68fb85ed929f73a96zzzz", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := isCanonicalAddress(c.in); got != c.want {
				t.Fatalf("isCanonicalAddress(%q) = %v, want %v", c.in, got, c.want)
			}
		})
	}
}
