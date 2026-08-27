// Package clearsign implements ERC-7730 descriptor handling: parsing the
// registry's JSON descriptors, resolving calldata against them, and rendering
// human-readable fields.
//
// SECURITY: descriptors affect DISPLAY ONLY. No code in this package feeds
// blacklist checks, RequiresAcknowledge, or any signing gate. A fully
// compromised descriptor can at worst mislabel a transaction — it can never
// disable a safety check. See internal/security/txguard for the real gate.
package clearsign

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"golang.org/x/crypto/sha3"
)

// Deployment is one (chainId, address) pair a descriptor applies to.
type Deployment struct {
	ChainID int64  `json:"chainId"`
	Address string `json:"address"` // normalized to lowercase on parse
}

// Contract holds the deployments a descriptor covers.
type Contract struct {
	Deployments []Deployment `json:"deployments"`
}

// Context identifies what the descriptor describes.
type Context struct {
	ID       string   `json:"$id"`
	Contract Contract `json:"contract"`
}

// Info is optional provenance metadata.
type Info struct {
	DeploymentDate string `json:"deploymentDate"`
	URL            string `json:"url"`
}

// Metadata names the protocol that owns the contract.
type Metadata struct {
	Owner        string `json:"owner"`
	ContractName string `json:"contractName"`
	Info         Info   `json:"info"`
}

// DisplayField is one row shown to the user.
type DisplayField struct {
	Path    string         `json:"path"`
	Label   string         `json:"label"`
	Format  string         `json:"format"`
	Params  map[string]any `json:"params"`
	Visible any            `json:"visible"` // "always" | bool | absent
}

// DisplayFormat describes how to render one function's calldata.
type DisplayFormat struct {
	ID     string         `json:"$id"`
	Intent string         `json:"intent"`
	Fields []DisplayField `json:"fields"`

	// Signature is the map key it was found under (a full human-readable
	// signature, e.g. "transfer(address _to, uint256 _value)"), kept so the
	// selector can be computed. Populated by ParseDescriptor, not by JSON.
	Signature string `json:"-"`
	// Selector is the 4-byte selector derived from Signature, e.g. "0xa9059cbb".
	Selector string `json:"-"`
}

// Display holds every function format in a descriptor.
type Display struct {
	Formats map[string]*DisplayFormat `json:"formats"`
}

// Descriptor is one parsed ERC-7730 file.
type Descriptor struct {
	Context  Context  `json:"context"`
	Metadata Metadata `json:"metadata"`
	Display  Display  `json:"display"`
}

// paramNamePattern strips parameter names from a human-readable signature:
// "transfer(address _to, uint256 _value)" -> "transfer(address,uint256)".
// Only the canonical form hashes to the correct 4-byte selector.
//
// Go's regexp is RE2 and has no lookahead, so unlike a PCRE `(?=[,)])` this
// captures the trailing delimiter in group 1 and puts it back in the
// replacement instead of merely asserting it.
var paramNamePattern = regexp.MustCompile(`\s+[A-Za-z_$][A-Za-z0-9_$]*\s*([,)])`)

// CanonicalSignature reduces a human-readable signature to its canonical form
// (types only, no names, no spaces) as required for selector computation.
func CanonicalSignature(sig string) string {
	// Drop tuple component names inside nested parens as well; the regex is
	// applied to the whole string so "(bytes path, address to) params" collapses
	// to "(bytes,address)".
	s := paramNamePattern.ReplaceAllString(sig, "$1")
	s = strings.ReplaceAll(s, ", ", ",")
	s = strings.ReplaceAll(s, " ", "")
	return s
}

// SelectorForSignature returns the 0x-prefixed 4-byte selector for a
// human-readable function signature.
func SelectorForSignature(sig string) string {
	h := sha3.NewLegacyKeccak256()
	h.Write([]byte(CanonicalSignature(sig)))
	return fmt.Sprintf("0x%x", h.Sum(nil)[:4])
}

// ParseDescriptor decodes one ERC-7730 JSON file. Deployment addresses are
// lowercased and each format's selector is precomputed so lookups are cheap.
func ParseDescriptor(raw []byte) (*Descriptor, error) {
	var d Descriptor
	if err := json.Unmarshal(raw, &d); err != nil {
		return nil, fmt.Errorf("erc7730: parse: %w", err)
	}
	for i := range d.Context.Contract.Deployments {
		dep := &d.Context.Contract.Deployments[i]
		dep.Address = strings.ToLower(dep.Address)
	}
	for sig, f := range d.Display.Formats {
		if f == nil {
			continue
		}
		f.Signature = sig
		f.Selector = SelectorForSignature(sig)
	}
	return &d, nil
}

