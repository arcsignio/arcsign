package provider

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestGetNFTsOutputSerializesUnavailable(t *testing.T) {
	out := GetNFTsOutput{
		NFTs:                 []SimplifiedNFT{},
		UnavailableProviders: []ProviderUnavailable{{Provider: "alchemy", Reason: "missing_key"}},
	}
	b, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	s := string(b)
	if !strings.Contains(s, `"unavailableProviders"`) || !strings.Contains(s, `"missing_key"`) {
		t.Errorf("expected unavailableProviders in JSON, got %s", s)
	}
}

func TestGetNFTsOutputOmitsEmptyUnavailable(t *testing.T) {
	out := GetNFTsOutput{NFTs: []SimplifiedNFT{}}
	b, _ := json.Marshal(out)
	if strings.Contains(string(b), "unavailableProviders") {
		t.Errorf("empty unavailable should be omitted (omitempty), got %s", b)
	}
}
