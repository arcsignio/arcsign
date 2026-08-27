package clearsign

import "testing"

const uniswapSample = `{
  "context": {
    "$id": "Uniswap v3 Router 2",
    "contract": {
      "deployments": [{ "chainId": 1, "address": "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45" }]
    }
  },
  "metadata": { "owner": "Uniswap Labs", "contractName": "Uniswap v3 Router 2" },
  "display": {
    "formats": {
      "exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum) params)": {
        "$id": "exactInput",
        "intent": "Swap",
        "fields": [
          { "path": "params.amountIn", "label": "Amount to Send", "format": "tokenAmount",
            "params": { "tokenPath": "params.path.[0:20]" }, "visible": "always" },
          { "path": "params.recipient", "label": "Beneficiary", "format": "addressName" }
        ]
      }
    }
  }
}`

func TestParseDescriptor(t *testing.T) {
	d, err := ParseDescriptor([]byte(uniswapSample))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if d.Metadata.Owner != "Uniswap Labs" {
		t.Errorf("owner = %q, want Uniswap Labs", d.Metadata.Owner)
	}
	if len(d.Context.Contract.Deployments) != 1 {
		t.Fatalf("deployments = %d, want 1", len(d.Context.Contract.Deployments))
	}
	dep := d.Context.Contract.Deployments[0]
	if dep.ChainID != 1 {
		t.Errorf("chainId = %d, want 1", dep.ChainID)
	}
	// 地址一律正規化為小寫，比對時才不會因大小寫漏掉
	if dep.Address != "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45" {
		t.Errorf("address = %q, want lowercase", dep.Address)
	}

	var fmtEntry *DisplayFormat
	for _, f := range d.Display.Formats {
		if f.ID == "exactInput" {
			fmtEntry = f
		}
	}
	if fmtEntry == nil {
		t.Fatal("exactInput format not found")
	}
	if fmtEntry.Intent != "Swap" {
		t.Errorf("intent = %q, want Swap", fmtEntry.Intent)
	}
	if len(fmtEntry.Fields) != 2 {
		t.Fatalf("fields = %d, want 2", len(fmtEntry.Fields))
	}
	if fmtEntry.Fields[0].Params["tokenPath"] != "params.path.[0:20]" {
		t.Errorf("tokenPath not preserved: %v", fmtEntry.Fields[0].Params)
	}
}

func TestParseDescriptorRejectsGarbage(t *testing.T) {
	if _, err := ParseDescriptor([]byte("not json")); err == nil {
		t.Error("want error on malformed JSON")
	}
}

func TestSelectorForSignature(t *testing.T) {
	// display.formats 的 key 是完整簽章（含參數名與空白），
	// 必須先正規化成 canonical form 才能算出正確的 4-byte selector。
	got := SelectorForSignature("transfer(address _to, uint256 _value)")
	if got != "0xa9059cbb" {
		t.Errorf("selector = %s, want 0xa9059cbb (transfer(address,uint256))", got)
	}
}
