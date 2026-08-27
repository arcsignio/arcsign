package clearsign

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	// Upstream registry, maintained by the Ethereum Foundation.
	// Note: the default branch is master, not main — main returns 404.
	defaultAPIBase = "https://api.github.com/repos/ethereum/clear-signing-erc7730-registry"
	defaultRawBase = "https://raw.githubusercontent.com/ethereum/clear-signing-erc7730-registry/master"
	registryBranch = "master"

	// maxFileBytes caps a single descriptor download. The largest real
	// descriptor is a few tens of KB; this bounds memory against a hostile or
	// broken response without rejecting legitimate files.
	maxFileBytes = 8 << 20
)

// Fetcher downloads descriptors from the upstream registry.
//
// The hosts are fields rather than constants so tests can point them at an
// httptest server and run entirely offline. Production callers use NewFetcher,
// which pins the official hosts over TLS.
type Fetcher struct {
	APIBase string
	RawBase string
	Client  *http.Client
}

// NewFetcher returns a Fetcher pinned to the official registry over TLS.
func NewFetcher() *Fetcher {
	return &Fetcher{
		APIBase: defaultAPIBase,
		RawBase: defaultRawBase,
		Client:  &http.Client{Timeout: 60 * time.Second},
	}
}

type treeResponse struct {
	Tree []struct {
		Path string `json:"path"`
	} `json:"tree"`
}

// FetchLatest downloads every calldata descriptor covering at least one of the
// given chains.
//
// A file that fails to download or parse is skipped, not fatal: one broken
// upstream entry must not block the whole update. But a fetch that yields no
// usable descriptors IS an error — returning an empty snapshot would let the
// caller overwrite a good stored set with nothing.
func (f *Fetcher) FetchLatest(ctx context.Context, chains []int64) (*Snapshot, error) {
	want := make(map[int64]bool, len(chains))
	for _, c := range chains {
		want[c] = true
	}

	treeURL := fmt.Sprintf("%s/git/trees/%s?recursive=1", f.APIBase, registryBranch)
	var tree treeResponse
	if err := f.getJSON(ctx, treeURL, &tree); err != nil {
		return nil, fmt.Errorf("clearsign: list registry: %w", err)
	}

	snap := &Snapshot{
		Version: time.Now().UTC().Format("2006-01-02"),
		Source:  defaultAPIBase,
	}

	for _, entry := range tree.Tree {
		p := entry.Path
		if !strings.Contains(p, "/calldata-") || !strings.HasSuffix(p, ".json") {
			continue
		}
		raw, err := f.getRaw(ctx, f.RawBase+"/"+p)
		if err != nil {
			continue
		}
		d, err := ParseDescriptor(raw)
		if err != nil {
			continue
		}
		if !coversAnyChain(d, want) {
			continue
		}
		snap.Descriptors = append(snap.Descriptors, json.RawMessage(raw))
	}

	if len(snap.Descriptors) == 0 {
		return nil, fmt.Errorf("clearsign: update returned no usable descriptors")
	}
	return snap, nil
}

func coversAnyChain(d *Descriptor, want map[int64]bool) bool {
	for _, dep := range d.Context.Contract.Deployments {
		if want[dep.ChainID] {
			return true
		}
	}
	return false
}

func (f *Fetcher) getJSON(ctx context.Context, url string, out any) error {
	body, err := f.getRaw(ctx, url)
	if err != nil {
		return err
	}
	return json.Unmarshal(body, out)
}

func (f *Fetcher) getRaw(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := f.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("http %d for %s", resp.StatusCode, url)
	}
	return io.ReadAll(io.LimitReader(resp.Body, maxFileBytes))
}
