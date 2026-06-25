package swap

import (
	"errors"
	"testing"
)

func TestResolveFreeQuote(t *testing.T) {
	ooQuote := &SwapQuote{Provider: ProviderOpenOcean, ToAmount: "100"}
	ksQuote := &SwapQuote{Provider: ProviderKyberSwap, ToAmount: "99"}
	ooErr := errors.New("openocean 403")
	ksErr := errors.New("kyberswap 500")

	t.Run("OpenOcean ok → OpenOcean quote", func(t *testing.T) {
		q, err := resolveFreeQuote(ooQuote, nil, false, func() (*SwapQuote, error) { t.Fatal("should not call ks"); return nil, nil })
		if err != nil || q.Provider != ProviderOpenOcean {
			t.Fatalf("want OpenOcean quote, got q=%v err=%v", q, err)
		}
	})
	t.Run("OpenOcean fail + KyberSwap supported ok → KyberSwap fallback (fee 0)", func(t *testing.T) {
		q, err := resolveFreeQuote(nil, ooErr, true, func() (*SwapQuote, error) { return ksQuote, nil })
		if err != nil {
			t.Fatalf("want fallback success, got err=%v", err)
		}
		if q.Provider != ProviderKyberSwap || q.RouteType != "standard-fallback" || q.FeeRate != "0" || q.FeeAmount != "0" {
			t.Fatalf("want KyberSwap fallback w/ zero fee, got %+v", q)
		}
	})
	t.Run("OpenOcean fail + KyberSwap unsupported → error", func(t *testing.T) {
		_, err := resolveFreeQuote(nil, ooErr, false, func() (*SwapQuote, error) { t.Fatal("should not call ks"); return nil, nil })
		if err == nil {
			t.Fatalf("want error when ks unsupported")
		}
	})
	t.Run("both fail → combined error wrapping ooErr", func(t *testing.T) {
		_, err := resolveFreeQuote(nil, ooErr, true, func() (*SwapQuote, error) { return nil, ksErr })
		if err == nil || !errors.Is(err, ooErr) {
			t.Fatalf("want combined error wrapping ooErr, got %v", err)
		}
	})
}

func TestResolveFreeTx(t *testing.T) {
	ooTx := &SwapTransaction{Quote: SwapQuote{Provider: ProviderOpenOcean}}
	ksTx := &SwapTransaction{Quote: SwapQuote{Provider: ProviderKyberSwap}}
	ooErr := errors.New("openocean 403")
	ksErr := errors.New("kyberswap 500")

	t.Run("OpenOcean ok → OpenOcean tx", func(t *testing.T) {
		tx, err := resolveFreeTx(ooTx, nil, false, func() (*SwapTransaction, error) { t.Fatal("should not call ks"); return nil, nil })
		if err != nil || tx.Quote.Provider != ProviderOpenOcean {
			t.Fatalf("want OpenOcean tx, got tx=%v err=%v", tx, err)
		}
	})
	t.Run("OpenOcean fail + KyberSwap supported ok → KyberSwap fallback (fee 0)", func(t *testing.T) {
		tx, err := resolveFreeTx(nil, ooErr, true, func() (*SwapTransaction, error) { return ksTx, nil })
		if err != nil {
			t.Fatalf("want fallback success, got err=%v", err)
		}
		if tx.Quote.Provider != ProviderKyberSwap || tx.Quote.RouteType != "standard-fallback" || tx.Quote.FeeRate != "0" || tx.Quote.FeeAmount != "0" {
			t.Fatalf("want KyberSwap fallback tx w/ zero fee, got %+v", tx.Quote)
		}
	})
	t.Run("OpenOcean fail + KyberSwap unsupported → error", func(t *testing.T) {
		_, err := resolveFreeTx(nil, ooErr, false, func() (*SwapTransaction, error) { t.Fatal("should not call ks"); return nil, nil })
		if err == nil {
			t.Fatalf("want error when ks unsupported")
		}
	})
	t.Run("both fail → combined error wrapping ooErr", func(t *testing.T) {
		_, err := resolveFreeTx(nil, ooErr, true, func() (*SwapTransaction, error) { return nil, ksErr })
		if err == nil || !errors.Is(err, ooErr) {
			t.Fatalf("want combined error wrapping ooErr, got %v", err)
		}
	})
}
