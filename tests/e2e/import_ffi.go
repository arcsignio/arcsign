//go:build e2e

// End-to-end wallet import against the REAL built dylib, through the same C
// ABI the Tauri Rust layer calls.
//
// This exists because a shipped bug made wallet import completely unusable
// while every layered test stayed green: the frontend's bip39 package needed
// Node's Buffer, which Tauri's WebView lacks, so every phrase was reported as
// an invalid checksum. Diagnosing it was slow because nothing proved which
// layer was at fault — there was no test that ran the whole path.
//
// The cgo entry points cannot be exercised by `go test`: the package is
// `main` with `import "C"`, and Go cannot call its own //export symbols from a
// test in that package. So this is a separate program that dlopens the built
// artifact, which is also what makes it a real end-to-end check rather than a
// re-test of internal functions.
//
// Run:  make test-e2e     (builds the dylib, mounts a volume, runs this)
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

/*
#cgo LDFLAGS: -larcsign
#include <stdlib.h>
char* ImportWallet(char* params);
void GoFree(char* str);
*/
import "C"
import "unsafe"

func importWallet(in any) map[string]any {
	b, _ := json.Marshal(in)
	cs := C.CString(string(b))
	defer C.free(unsafe.Pointer(cs))

	out := C.ImportWallet(cs)
	defer C.GoFree(out)

	var m map[string]any
	if err := json.Unmarshal([]byte(C.GoString(out)), &m); err != nil {
		return map[string]any{"error": "unparseable response: " + C.GoString(out)}
	}
	return m
}

func main() {
	// The FFI requires a USB-shaped path; the harness is given a real mounted
	// volume rather than faking one, so this exercises the same branch the app
	// does.
	usbRoot := os.Getenv("ARCSIGN_E2E_USB")
	if usbRoot == "" {
		fmt.Println("FAIL: set ARCSIGN_E2E_USB to a mounted volume (see make test-e2e)")
		os.Exit(1)
	}

	usb := filepath.Join(usbRoot, "e2e")
	if err := os.MkdirAll(usb, 0o755); err != nil {
		fmt.Println("FAIL: mkdir:", err)
		os.Exit(1)
	}
	defer os.RemoveAll(usb)

	failures := 0

	// Published BIP39 test vectors. Not anyone's wallet.
	valid := map[string]string{
		"12-word": "legal winner thank year wave sausage worth useful legal winner thank yellow",
		"24-word": "legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title",
	}

	for name, phrase := range valid {
		res := importWallet(map[string]any{
			"walletName": "E2E " + name,
			"mnemonic":   phrase,
			"password":   "ValidP@ssw0rd123",
			"usbPath":    usb,
		})

		if res["success"] != true {
			fmt.Printf("FAIL [%s]: import rejected a valid phrase: %v\n", name, res["error"])
			failures++
			continue
		}

		data, _ := res["data"].(map[string]any)
		id, _ := data["walletId"].(string)
		if id == "" {
			fmt.Printf("FAIL [%s]: no walletId in response: %v\n", name, res["data"])
			failures++
			continue
		}
		if _, err := os.Stat(filepath.Join(usb, id)); err != nil {
			fmt.Printf("FAIL [%s]: wallet directory not written: %v\n", name, err)
			failures++
			continue
		}
		fmt.Printf("PASS [%s]: imported and written to disk\n", name)
	}

	// The checksum gate must still reject a wrong phrase at this layer: the
	// frontend check is a convenience, not the guarantee.
	bad := "legal winner thank year wave sausage worth useful legal winner thank yard"
	if res := importWallet(map[string]any{
		"walletName": "E2E bad-checksum",
		"mnemonic":   bad,
		"password":   "ValidP@ssw0rd123",
		"usbPath":    usb,
	}); res["success"] == true {
		fmt.Println("FAIL [bad-checksum]: backend ACCEPTED an invalid phrase")
		failures++
	} else {
		fmt.Println("PASS [bad-checksum]: correctly refused")
	}

	if failures > 0 {
		fmt.Printf("\n%d failure(s)\n", failures)
		os.Exit(1)
	}
	fmt.Println("\nALL PASS")
}
