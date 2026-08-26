package clearsign

// ResolvedField is one rendered row of a transaction summary.
type ResolvedField struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

// ResolvedIntent is a transaction rendered through its ERC-7730 descriptor.
type ResolvedIntent struct {
	Intent       string          `json:"intent"`       // e.g. "Swap"
	Owner        string          `json:"owner"`        // e.g. "Uniswap Labs"
	ContractName string          `json:"contractName"` // e.g. "Uniswap v3 Router 2"
	Fields       []ResolvedField `json:"fields"`
}

// Resolve renders decoded calldata through the matching descriptor.
//
// It is all-or-nothing on purpose: if ANY visible field cannot be resolved or
// formatted, Resolve returns false and the caller falls back to the existing
// calldata decoder. A partially rendered summary is worse than the plain one,
// because the user cannot tell which rows are missing.
//
// SECURITY: this affects display only. Nothing here feeds the blacklist,
// RequiresAcknowledge, or any signing gate.
func (r *Registry) Resolve(
	chainID int64,
	to string,
	selector string,
	decoded map[string]any,
	lookup TokenLookup,
) (*ResolvedIntent, bool) {
	format, desc, ok := r.Lookup(chainID, to, selector)
	if !ok {
		return nil, false
	}

	resolve := func(p string) (any, bool) { return ResolvePath(decoded, p) }

	fields := make([]ResolvedField, 0, len(format.Fields))
	for _, f := range format.Fields {
		if !isVisible(f.Visible) {
			continue
		}
		raw, ok := ResolvePath(decoded, f.Path)
		if !ok {
			return nil, false
		}
		rendered, ok := FormatValue(raw, f.Format, f.Params, resolve, lookup)
		if !ok {
			return nil, false
		}
		fields = append(fields, ResolvedField{Label: f.Label, Value: rendered})
	}

	return &ResolvedIntent{
		Intent:       format.Intent,
		Owner:        desc.Metadata.Owner,
		ContractName: desc.Metadata.ContractName,
		Fields:       fields,
	}, true
}

// isVisible reports whether a field should be shown. ERC-7730 allows "always",
// a bool, or omission; anything unrecognized defaults to visible so a field is
// never silently dropped.
func isVisible(v any) bool {
	switch t := v.(type) {
	case nil:
		return true
	case string:
		return t != "never"
	case bool:
		return t
	default:
		return true
	}
}
