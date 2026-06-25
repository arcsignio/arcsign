package openocean

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDoRequest_SendsUserAgent(t *testing.T) {
	var gotUA string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotUA = r.Header.Get("User-Agent")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{}`))
	}))
	defer srv.Close()

	c := NewClient()
	c.baseURL = srv.URL // same-package test can set unexported field

	_, err := c.doRequest(context.Background(), http.MethodGet, srv.URL+"/ping")
	if err != nil {
		t.Fatalf("doRequest error: %v", err)
	}
	if gotUA == "" || strings.Contains(gotUA, "Go-http-client") {
		t.Fatalf("expected a browser-like User-Agent, got %q", gotUA)
	}
	if !strings.Contains(gotUA, "ArcSign") {
		t.Fatalf("expected UA to identify ArcSign, got %q", gotUA)
	}
}
