package clearsign

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// fakeRegistry serves a minimal stand-in for the upstream registry so these
// tests never touch the network.
func fakeRegistry(t *testing.T, files map[string]string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/git/trees/") {
			tree := make([]map[string]any, 0, len(files))
			for p := range files {
				tree = append(tree, map[string]any{"path": p})
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"tree": tree})
			return
		}
		for p, body := range files {
			if strings.HasSuffix(r.URL.Path, p) {
				_, _ = w.Write([]byte(body))
				return
			}
		}
		http.NotFound(w, r)
	}))
}

const otherChainDescriptor = `{"context":{"contract":{"deployments":[{"chainId":999999,"address":"0xdead"}]}},
 "metadata":{},"display":{"formats":{}}}`

func TestFetchLatestFiltersToRequestedChains(t *testing.T) {
	srv := fakeRegistry(t, map[string]string{
		"registry/a/calldata-A.json": uniswapSample,        // chainId 1
		"registry/b/calldata-B.json": otherChainDescriptor, // chainId 999999
	})
	defer srv.Close()

	f := &Fetcher{APIBase: srv.URL, RawBase: srv.URL, Client: srv.Client()}
	snap, err := f.FetchLatest(context.Background(), []int64{1})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if len(snap.Descriptors) != 1 {
		t.Fatalf("descriptors = %d, want 1 (chain filter should drop the other)", len(snap.Descriptors))
	}
	if snap.Version == "" {
		t.Error("snapshot version must be set")
	}
}

func TestFetchLatestSkipsUnparseableDescriptor(t *testing.T) {
	srv := fakeRegistry(t, map[string]string{
		"registry/a/calldata-A.json":     uniswapSample,
		"registry/bad/calldata-Bad.json": "this is not json",
	})
	defer srv.Close()

	f := &Fetcher{APIBase: srv.URL, RawBase: srv.URL, Client: srv.Client()}
	snap, err := f.FetchLatest(context.Background(), []int64{1})
	if err != nil {
		t.Fatalf("one bad file must not fail the whole fetch: %v", err)
	}
	if len(snap.Descriptors) != 1 {
		t.Errorf("descriptors = %d, want 1", len(snap.Descriptors))
	}
}

// TestFetchLatestErrorsWhenNothingUsable is the guard against silently
// overwriting a good stored snapshot with an empty one: if a fetch yields no
// usable descriptors, it must be an error so the caller keeps what it has.
func TestFetchLatestErrorsWhenNothingUsable(t *testing.T) {
	srv := fakeRegistry(t, map[string]string{
		"registry/b/calldata-B.json": otherChainDescriptor, // never matches chain 1
	})
	defer srv.Close()

	f := &Fetcher{APIBase: srv.URL, RawBase: srv.URL, Client: srv.Client()}
	if _, err := f.FetchLatest(context.Background(), []int64{1}); err == nil {
		t.Error("an empty result must be an error, not an empty snapshot")
	}
}

func TestFetchLatestPropagatesTreeFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	}))
	defer srv.Close()

	f := &Fetcher{APIBase: srv.URL, RawBase: srv.URL, Client: srv.Client()}
	if _, err := f.FetchLatest(context.Background(), []int64{1}); err == nil {
		t.Error("a failed registry listing must return an error")
	}
}

// TestNewFetcherPinsOfficialHosts guards the transport boundary: descriptors
// are only ever fetched from the official registry over TLS.
func TestNewFetcherPinsOfficialHosts(t *testing.T) {
	f := NewFetcher()
	if !strings.HasPrefix(f.APIBase, "https://api.github.com/repos/ethereum/clear-signing-erc7730-registry") {
		t.Errorf("APIBase = %q, want the official GitHub API host", f.APIBase)
	}
	if !strings.HasPrefix(f.RawBase, "https://raw.githubusercontent.com/ethereum/clear-signing-erc7730-registry") {
		t.Errorf("RawBase = %q, want the official raw host", f.RawBase)
	}
	// The upstream default branch is master, not main.
	if !strings.HasSuffix(f.RawBase, "/master") {
		t.Errorf("RawBase = %q, want it pinned to the master branch", f.RawBase)
	}
}
