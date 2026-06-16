package provider

import "testing"

func TestGetWalletDataProvider_UnknownReturnsNil(t *testing.T) {
	wdp, err := GetWalletDataProvider("does-not-exist", nil)
	if err != nil {
		t.Errorf("unknown provider should not error, got %v", err)
	}
	if wdp != nil {
		t.Errorf("unknown provider should return nil, got %T", wdp)
	}
}

func TestGetWalletDataProvider_GlacierAvailableWithoutKey(t *testing.T) {
	// Glacier has an anonymous tier — it must be available even with a nil store
	// (no key). This is what lets Avalanche work with zero user setup.
	wdp, err := GetWalletDataProvider(ProviderGlacier, nil)
	if err != nil {
		t.Fatalf("glacier factory: %v", err)
	}
	if wdp == nil {
		t.Fatal("Glacier must be available without an API key (anonymous tier)")
	}
	if wdp.Name() != ProviderGlacier {
		t.Errorf("expected glacier, got %q", wdp.Name())
	}
}

func TestGetWalletDataProvider_AlchemyDegradedWithoutKey(t *testing.T) {
	// Progressive-key: without a key Alchemy is STILL available, serving a
	// degraded path (native + common-token balances via public RPCs). It must
	// not be nil, and must report IsDegraded() so the UI can prompt for a key.
	wdp, err := GetWalletDataProvider(ProviderAlchemy, nil)
	if err != nil {
		t.Fatalf("alchemy factory should not error without key, got %v", err)
	}
	if wdp == nil {
		t.Fatal("Alchemy without a key should be available (degraded), not nil")
	}
	if d, ok := wdp.(DegradedProvider); !ok || !d.IsDegraded() {
		t.Error("no-key Alchemy should report IsDegraded() == true")
	}
}

func TestLoadProviderAPIKey_NilStore(t *testing.T) {
	if got := LoadProviderAPIKey(nil, ProviderAlchemy); got != "" {
		t.Errorf("nil store should yield empty key, got %q", got)
	}
}
