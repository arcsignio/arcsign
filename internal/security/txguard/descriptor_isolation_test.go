package txguard

import (
	"context"
	"reflect"
	"testing"

	"github.com/arcsignio/arcsign/internal/security/simulation"
)

// TestTxGuardVerdictIsDeterministic is the executable form of this project's
// core clear-signing rule: an ERC-7730 descriptor may change what the user
// SEES, never what the guard DECIDES.
//
// The guard takes no descriptor input at all, so its verdict for a given
// transaction cannot vary with the descriptor set.
func TestTxGuardVerdictIsDeterministic(t *testing.T) {
	g := NewGuard(nil, nil)
	tx := simulation.TxParams{}

	first := g.Check(context.Background(), "0x0000000000000000000000000000000000000001", "1", "", tx)
	second := g.Check(context.Background(), "0x0000000000000000000000000000000000000001", "1", "", tx)

	if !reflect.DeepEqual(first, second) {
		t.Fatalf("guard verdict is not deterministic:\n first=%+v\nsecond=%+v", first, second)
	}
	if first.RequiresAcknowledge {
		t.Error("a clean address must not require acknowledgement")
	}
}

// TestSecurityReportHasNoDescriptorFields guards the boundary structurally: if
// someone later threads descriptor data into SecurityReport, this fails. The
// report is what the signing gate consumes, so it must stay free of anything
// a descriptor could influence.
func TestSecurityReportHasNoDescriptorFields(t *testing.T) {
	typ := reflect.TypeOf(SecurityReport{})
	forbidden := []string{"Descriptor", "Erc7730", "ERC7730", "Intent", "DescriptorMeta", "Owner", "ContractName"}
	for _, name := range forbidden {
		if _, found := typ.FieldByName(name); found {
			t.Errorf("SecurityReport must not carry %s — descriptors are display-only", name)
		}
	}
}

// TestCheckSignatureTakesNoDescriptorArgument pins the Check signature. A
// descriptor reaching the guard would mean display data influencing a safety
// decision, which this project forbids.
func TestCheckSignatureTakesNoDescriptorArgument(t *testing.T) {
	m, ok := reflect.TypeOf(&Guard{}).MethodByName("Check")
	if !ok {
		t.Fatal("Guard.Check not found")
	}
	for i := 0; i < m.Type.NumIn(); i++ {
		if got := m.Type.In(i).String(); got == "clearsign.ResolvedIntent" ||
			got == "*clearsign.ResolvedIntent" || got == "clearsign.Descriptor" {
			t.Errorf("Check must not accept descriptor data, found parameter %s", got)
		}
	}
}
