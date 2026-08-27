package clearsign

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
)

//go:embed data/snapshot.json
var embeddedSnapshot []byte

// Snapshot is the on-disk container for a set of descriptors, produced by
// scripts/build-erc7730-snapshot.sh.
type Snapshot struct {
	Version     string            `json:"version"`
	Source      string            `json:"source"`
	Descriptors []json.RawMessage `json:"descriptors"`
}

// lookupKey identifies one (chain, contract, function) triple.
type lookupKey struct {
	chainID  int64
	address  string // lowercase
	selector string // 0x-prefixed 4 bytes
}

type lookupEntry struct {
	format     *DisplayFormat
	descriptor *Descriptor
}

// Registry is an indexed, read-only set of descriptors.
//
// The index is built once at construction; Lookup is a map read. Registry is
// safe for concurrent reads and is never mutated after NewRegistry returns.
type Registry struct {
	version string
	index   map[lookupKey]lookupEntry
	count   int
}

// NewRegistry indexes descriptors for lookup. Later descriptors covering the
// same (chain, address, selector) win, which lets a future local-supplement
// layer override the upstream registry without changing this code.
func NewRegistry(version string, descriptors []*Descriptor) *Registry {
	r := &Registry{
		version: version,
		index:   make(map[lookupKey]lookupEntry),
		count:   len(descriptors),
	}
	for _, d := range descriptors {
		if d == nil {
			continue
		}
		for _, dep := range d.Context.Contract.Deployments {
			for _, f := range d.Display.Formats {
				if f == nil || f.Selector == "" {
					continue
				}
				r.index[lookupKey{
					chainID:  dep.ChainID,
					address:  strings.ToLower(dep.Address),
					selector: strings.ToLower(f.Selector),
				}] = lookupEntry{format: f, descriptor: d}
			}
		}
	}
	return r
}

// LoadEmbeddedSnapshot parses the snapshot compiled into the binary. This is
// the default, fully-offline descriptor source.
func LoadEmbeddedSnapshot() (*Registry, error) {
	return LoadSnapshot(embeddedSnapshot)
}

// LoadSnapshot parses a snapshot from raw JSON. A descriptor that fails to
// parse is skipped rather than failing the whole load — one bad entry must not
// disable clear signing for everything else.
func LoadSnapshot(raw []byte) (*Registry, error) {
	var s Snapshot
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, fmt.Errorf("erc7730: snapshot: %w", err)
	}
	out := make([]*Descriptor, 0, len(s.Descriptors))
	for _, rawDesc := range s.Descriptors {
		d, err := ParseDescriptor(rawDesc)
		if err != nil {
			continue
		}
		out = append(out, d)
	}
	return NewRegistry(s.Version, out), nil
}

// Lookup finds the display format for a (chain, contract, selector) triple.
func (r *Registry) Lookup(chainID int64, address, selector string) (*DisplayFormat, *Descriptor, bool) {
	e, ok := r.index[lookupKey{
		chainID:  chainID,
		address:  strings.ToLower(address),
		selector: strings.ToLower(selector),
	}]
	if !ok {
		return nil, nil, false
	}
	return e.format, e.descriptor, true
}

// Count reports how many descriptors were loaded.
func (r *Registry) Count() int { return r.count }

// Version reports the snapshot version (an ISO date).
func (r *Registry) Version() string { return r.version }
