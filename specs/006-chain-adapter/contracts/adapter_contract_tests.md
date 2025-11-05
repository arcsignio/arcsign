# ChainAdapter Contract Tests

**Feature**: 006-chain-adapter
**Purpose**: Define contract test specifications that MUST pass for all ChainAdapter implementations

## Overview

These contract tests verify that ChainAdapter implementations fulfill the guarantees specified in the interface contract. All tests MUST be implemented and MUST pass before an adapter is considered production-ready.

---

## Test Suite 1: Idempotency Contracts

### TC-001: Build Idempotency

**Requirement**: FR-006 - Build method MUST be deterministic

**Test**:
```go
func TestBuildIdempotency(t *testing.T, adapter ChainAdapter) {
    req := &TransactionRequest{
        From: "test_address_1",
        To: "test_address_2",
        Amount: big.NewInt(100000),
        Asset: adapter.ChainID(),
        FeeSpeed: FeeSpeedNormal,
    }

    unsigned1, err1 := adapter.Build(context.Background(), req)
    unsigned2, err2 := adapter.Build(context.Background(), req)

    assert.NoError(t, err1)
    assert.NoError(t, err2)
    assert.Equal(t, unsigned1.ID, unsigned2.ID)
    assert.Equal(t, unsigned1.SigningPayload, unsigned2.SigningPayload)
}
```

**Success Criteria**: Same TransactionRequest MUST produce identical UnsignedTransaction ID and SigningPayload

---

### TC-002: Broadcast Idempotency

**Requirement**: FR-019 - Broadcast MUST be idempotent

**Test**:
```go
func TestBroadcastIdempotency(t *testing.T, adapter ChainAdapter) {
    signed := createSignedTransaction(t, adapter)

    receipt1, err1 := adapter.Broadcast(context.Background(), signed)
    receipt2, err2 := adapter.Broadcast(context.Background(), signed)
    receipt3, err3 := adapter.Broadcast(context.Background(), signed)

    assert.NoError(t, err1)
    assert.NoError(t, err2)
    assert.NoError(t, err3)
    assert.Equal(t, receipt1.TxHash, receipt2.TxHash)
    assert.Equal(t, receipt1.TxHash, receipt3.TxHash)
}
```

**Success Criteria**: Broadcasting same SignedTransaction 3+ times MUST return identical TxHash without errors

---

## Test Suite 2: Error Classification Contracts

### TC-003: Error Classification Correctness

**Requirement**: FR-033 - Errors MUST be correctly classified

**Test**:
```go
func TestErrorClassification(t *testing.T, adapter ChainAdapter) {
    testCases := []struct{
        name string
        req *TransactionRequest
        expectedClass ErrorClassification
    }{
        {"Invalid Address", &TransactionRequest{From: "invalid", ...}, NonRetryable},
        {"Zero Amount", &TransactionRequest{Amount: big.NewInt(0), ...}, NonRetryable},
        {"Unsupported Asset", &TransactionRequest{Asset: "INVALID", ...}, NonRetryable},
    }

    for _, tc := range testCases {
        t.Run(tc.name, func(t *testing.T) {
            _, err := adapter.Build(context.Background(), tc.req)
            chainErr, ok := err.(*ChainError)
            assert.True(t, ok, "Error must be ChainError")
            assert.Equal(t, tc.expectedClass, chainErr.Classification)
        })
    }
}
```

**Success Criteria**: Errors MUST be classified correctly as Retryable/NonRetryable/UserIntervention

---

## Test Suite 3: Fee Estimation Contracts

### TC-004: Fee Bounds Validation

**Requirement**: FR-009, SC-004 - Fee estimates MUST have valid bounds

**Test**:
```go
func TestFeeBoundsValidity(t *testing.T, adapter ChainAdapter) {
    req := &TransactionRequest{
        From: "valid_address_1",
        To: "valid_address_2",
        Amount: big.NewInt(50000),
        Asset: adapter.ChainID(),
        FeeSpeed: FeeSpeedNormal,
    }

    estimate, err := adapter.Estimate(context.Background(), req)

    assert.NoError(t, err)
    assert.NotNil(t, estimate)

    // MinFee ≤ Recommended ≤ MaxFee
    assert.True(t, estimate.MinFee.Cmp(estimate.Recommended) <= 0,
        "MinFee must be ≤ Recommended")
    assert.True(t, estimate.Recommended.Cmp(estimate.MaxFee) <= 0,
        "Recommended must be ≤ MaxFee")

    // Confidence range [0, 100]
    assert.GreaterOrEqual(t, estimate.Confidence, 0)
    assert.LessOrEqual(t, estimate.Confidence, 100)
}
```

**Success Criteria**: MinFee ≤ Recommended ≤ MaxFee AND Confidence ∈ [0, 100]

---

### TC-005: Estimate Idempotency

**Requirement**: FR-011 - Estimate MUST be idempotent

**Test**:
```go
func TestEstimateIdempotency(t *testing.T, adapter ChainAdapter) {
    req := &TransactionRequest{...}

    estimate1, _ := adapter.Estimate(context.Background(), req)
    estimate2, _ := adapter.Estimate(context.Background(), req)

    // Estimates should be similar (within 10% due to network variability)
    diff := new(big.Int).Sub(estimate1.Recommended, estimate2.Recommended)
    diff.Abs(diff)
    threshold := new(big.Int).Div(estimate1.Recommended, big.NewInt(10)) // 10%

    assert.True(t, diff.Cmp(threshold) <= 0,
        "Consecutive estimates should be within 10%")
}
```

**Success Criteria**: Consecutive estimates MUST be within 10% (accounting for network volatility)

---

## Test Suite 4: Address Derivation Contracts

### TC-006: Derivation Determinism

**Requirement**: FR-028 - Derive MUST be deterministic

**Test**:
```go
func TestDerivationDeterminism(t *testing.T, adapter ChainAdapter) {
    keySource := createTestMnemonic(t, "abandon abandon abandon...")
    path := "m/44'/0'/0'/0/0" // Bitcoin
    if adapter.ChainID() == "ethereum" {
        path = "m/44'/60'/0'/0/0"
    }

    addr1, _ := adapter.Derive(context.Background(), keySource, path)
    addr2, _ := adapter.Derive(context.Background(), keySource, path)

    assert.Equal(t, addr1.Address, addr2.Address)
    assert.Equal(t, addr1.PublicKey, addr2.PublicKey)
}
```

**Success Criteria**: Same KeySource + path MUST always produce identical address

---

### TC-007: Cross-Wallet Compatibility

**Requirement**: SC-010 - Addresses MUST match industry-standard wallets

**Test**:
```go
func TestCrossWalletCompatibility(t *testing.T, adapter ChainAdapter) {
    // Test vectors from BIP39/BIP44 specification
    testVectors := []struct{
        mnemonic string
        path string
        expectedAddress string // From MetaMask/Bitcoin Core
    }{
        {"abandon abandon abandon...", "m/44'/0'/0'/0/0", "bc1q..."},
        {"abandon abandon abandon...", "m/44'/60'/0'/0/0", "0x..."},
    }

    for _, tv := range testVectors {
        keySource := createMnemonicKeySource(t, tv.mnemonic)
        addr, err := adapter.Derive(context.Background(), keySource, tv.path)

        assert.NoError(t, err)
        assert.Equal(t, tv.expectedAddress, addr.Address,
            "Address must match reference wallet")
    }
}
```

**Success Criteria**: Derived addresses MUST match MetaMask (Ethereum) or Bitcoin Core (Bitcoin) for same mnemonic

---

## Test Suite 5: RPC Failover Contracts

### TC-008: Transparent Failover

**Requirement**: FR-045 - Failover MUST be transparent

**Test**:
```go
func TestRPCFailover(t *testing.T, adapter ChainAdapter) {
    // Configure adapter with primary and secondary endpoints
    // Primary endpoint is mocked to fail

    req := &TransactionRequest{...}
    unsigned, err := adapter.Build(context.Background(), req)

    assert.NoError(t, err, "Should succeed with secondary RPC")
    assert.NotNil(t, unsigned)
}
```

**Success Criteria**: RPC failure MUST automatically failover to backup without returning error

---

### TC-009: All Endpoints Exhausted

**Requirement**: FR-045 - Error only when all endpoints fail

**Test**:
```go
func TestAllEndpointsExhausted(t *testing.T, adapter ChainAdapter) {
    // Configure all RPC endpoints to fail

    req := &TransactionRequest{...}
    _, err := adapter.Build(context.Background(), req)

    chainErr, ok := err.(*ChainError)
    assert.True(t, ok)
    assert.Equal(t, Retryable, chainErr.Classification)
    assert.Contains(t, chainErr.Message, "all RPC endpoints failed")
}
```

**Success Criteria**: Error only after exhausting ALL configured RPC endpoints

---

## Test Suite 6: Signing Contracts

### TC-010: Signature Verification

**Requirement**: FR-018 - Sign MUST validate signature

**Test**:
```go
func TestSignatureVerification(t *testing.T, adapter ChainAdapter) {
    unsigned := createUnsignedTransaction(t, adapter)
    signer := createLocalSigner(t, unsigned.From)

    signed, err := adapter.Sign(context.Background(), unsigned, signer)

    assert.NoError(t, err)
    assert.Equal(t, unsigned.From, signed.SignedBy)

    // Verify signature is valid
    valid := verifySIgnature(signed.UnsignedTx.SigningPayload,
        signed.Signature, signed.SignedBy)
    assert.True(t, valid, "Signature must be cryptographically valid")
}
```

**Success Criteria**: Returned signature MUST be cryptographically valid for SigningPayload

---

### TC-011: Address Mismatch Rejection

**Requirement**: FR-018 - Sign MUST validate SignedBy == From

**Test**:
```go
func TestAddressMismatchRejection(t *testing.T, adapter ChainAdapter) {
    unsigned := createUnsignedTransaction(t, adapter)
    // Signer with DIFFERENT address than unsigned.From
    wrongSigner := createLocalSigner(t, "different_address")

    _, err := adapter.Sign(context.Background(), unsigned, wrongSigner)

    chainErr, ok := err.(*ChainError)
    assert.True(t, ok)
    assert.Equal(t, NonRetryable, chainErr.Classification)
    assert.Contains(t, chainErr.Message, "address mismatch")
}
```

**Success Criteria**: Sign MUST reject if Signer.GetAddress() ≠ UnsignedTx.From

---

## Test Suite 7: WebSocket Contracts

### TC-012: WebSocket Reconnection

**Requirement**: FR-048 - WebSocket MUST reconnect automatically

**Test**:
```go
func TestWebSocketReconnection(t *testing.T, adapter ChainAdapter) {
    txHash := broadcastTestTransaction(t, adapter)

    statusChan, err := adapter.SubscribeStatus(context.Background(), txHash)
    assert.NoError(t, err)

    // Simulate WebSocket disconnection
    simulateWSDisconnect(t)

    // Wait for reconnection
    time.Sleep(5 * time.Second)

    // Should still receive status updates
    select {
    case status := <-statusChan:
        assert.NotNil(t, status)
    case <-time.After(10 * time.Second):
        t.Fatal("No status update after reconnection")
    }
}
```

**Success Criteria**: WebSocket MUST reconnect and continue sending updates after disconnection

---

### TC-013: Graceful Degradation to HTTP

**Requirement**: FR-049 - MUST degrade to HTTP polling if WebSocket fails

**Test**:
```go
func TestGracefulDegradation(t *testing.T, adapter ChainAdapter) {
    // Disable WebSocket endpoints

    txHash := broadcastTestTransaction(t, adapter)
    statusChan, err := adapter.SubscribeStatus(context.Background(), txHash)

    assert.NoError(t, err, "Should fallback to HTTP polling")

    // Verify updates are received via HTTP polling
    select {
    case status := <-statusChan:
        assert.NotNil(t, status)
    case <-time.After(15 * time.Second):
        t.Fatal("No status update via HTTP polling")
    }
}
```

**Success Criteria**: MUST fallback to HTTP polling if WebSocket unavailable

---

## Test Suite 8: State Storage Contracts

### TC-014: Transaction Hash Lookup

**Requirement**: FR-021 - MUST maintain tx hash lookup for idempotency

**Test**:
```go
func TestTransactionHashLookup(t *testing.T, adapter ChainAdapter) {
    signed := createSignedTransaction(t, adapter)

    receipt1, _ := adapter.Broadcast(context.Background(), signed)

    // Verify state store was updated
    state, err := adapter.GetTxState(signed.TxHash)
    assert.NoError(t, err)
    assert.Equal(t, 1, state.RetryCount)

    // Broadcast again
    receipt2, _ := adapter.Broadcast(context.Background(), signed)

    // Verify retry count incremented
    state2, _ := adapter.GetTxState(signed.TxHash)
    assert.Equal(t, 2, state2.RetryCount)
    assert.Equal(t, receipt1.TxHash, receipt2.TxHash)
}
```

**Success Criteria**: State store MUST track retry counts and prevent duplicate submissions

---

## Test Suite 9: Capabilities Contracts

### TC-015: Capabilities Accuracy

**Requirement**: FR-038 - Capabilities MUST accurately reflect adapter features

**Test**:
```go
func TestCapabilitiesAccuracy(t *testing.T, adapter ChainAdapter) {
    caps := adapter.Capabilities()

    if adapter.ChainID() == "bitcoin" {
        assert.False(t, caps.SupportsEIP1559)
        assert.False(t, caps.SupportsMemo) // Bitcoin OP_RETURN not considered "memo"
        assert.True(t, caps.SupportsRBF)
    }

    if adapter.ChainID() == "ethereum" {
        assert.True(t, caps.SupportsEIP1559)
        assert.False(t, caps.SupportsRBF)
        assert.True(t, caps.SupportsWebSocket)
    }
}
```

**Success Criteria**: Capabilities MUST accurately match adapter implementation

---

## Test Execution Requirements

### Mandatory Tests

All 15 contract tests (TC-001 through TC-015) MUST pass for an adapter to be considered production-ready.

### Test Environment

- **Bitcoin**: Regtest network with btcd node
- **Ethereum**: Geth --dev mode with prefunded accounts
- **Mock RPC**: For failover and error classification tests
- **Docker**: All test nodes run in containers

### Coverage Requirements

- Unit test coverage: ≥ 90% (per FR-052)
- Integration test coverage: All user stories
- Contract test coverage: 100% of these 15 tests

### Success Criteria Summary

| Suite | Tests | Pass Criteria |
|-------|-------|---------------|
| Idempotency | 2 | Same input → Same output |
| Error Classification | 1 | Correct classification for all error types |
| Fee Estimation | 2 | Valid bounds + Reasonable estimates |
| Address Derivation | 2 | Deterministic + Cross-wallet compatible |
| RPC Failover | 2 | Transparent failover + Exhaustion handling |
| Signing | 2 | Valid signature + Address validation |
| WebSocket | 2 | Auto-reconnection + Graceful degradation |
| State Storage | 1 | Idempotency enforcement via state |
| Capabilities | 1 | Accurate feature flags |

**Total**: 15 contract tests MUST pass before production deployment.
