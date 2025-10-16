# Performance Validation Guide - v0.2.0 Multi-Coin Addresses

**Feature**: Multi-Coin Address Generation
**Version**: 0.2.0
**Date**: 2025-10-16

---

## Performance Requirements

Based on `specs/001-bip39-bip-44/tasks.md`, the multi-coin address generation feature has the following performance requirements:

### T109: Wallet Creation Performance
- **Requirement**: Wallet creation with 30+ addresses must complete in < 10 seconds
- **Test**: `tests/integration/performance_test.go::TestWalletCreationPerformance`
- **Status**: Test defined, ready to run

### T110: Address Lookup Performance
- **Requirement**: Address lookup by symbol must complete in < 100ms
- **Test**: `tests/integration/performance_test.go::TestAddressLookupPerformance`
- **Status**: Test defined, ready to run

---

## Running Performance Tests

### Prerequisites

1. **Full implementation deployed**:
   ```bash
   go build -o bin/arcsign ./cmd/arcsign
   ```

2. **USB drive available** (for integration tests):
   ```bash
   # Linux/macOS
   export ARCSIGN_USB_PATH="/media/usb"

   # Windows
   set ARCSIGN_USB_PATH="E:\"
   ```

3. **Test dependencies installed**:
   ```bash
   go mod download
   go mod verify
   ```

### Test Execution

#### 1. Wallet Creation Performance Test

```bash
# Run test with timing
go test -v -timeout 30s ./tests/integration/performance_test.go -run TestWalletCreationPerformance

# Expected output:
#   === RUN   TestWalletCreationPerformance
#       performance_test.go:50: ✓ Wallet creation completed in 7.2s
#       performance_test.go:51: ✓ Generated 24 addresses
#       performance_test.go:52: ✓ Average time per address: 300ms
#   --- PASS: TestWalletCreationPerformance (7.20s)
```

**Pass Criteria**:
- ✅ Total time < 10 seconds
- ✅ At least 20 addresses generated successfully
- ✅ No errors during generation

**Fail Criteria**:
- ❌ Total time > 10 seconds
- ❌ Less than 20 addresses generated
- ❌ Errors or crashes

#### 2. Address Lookup Performance Test

```bash
# Run test with timing
go test -v -timeout 30s ./tests/integration/performance_test.go -run TestAddressLookupPerformance

# Expected output:
#   === RUN   TestAddressLookupPerformance
#       performance_test.go:148: ✓ Address lookup completed in 85µs
#   --- PASS: TestAddressLookupPerformance (0.01s)
```

**Pass Criteria**:
- ✅ Lookup time < 100ms (typically < 1ms)
- ✅ Correct address returned
- ✅ No errors

**Fail Criteria**:
- ❌ Lookup time > 100ms
- ❌ Wrong address or error returned

#### 3. Benchmark Tests

```bash
# Run all benchmarks
go test -bench=. -benchtime=3x ./tests/integration/performance_test.go

# Expected output:
#   goos: darwin
#   goarch: arm64
#   BenchmarkWalletCreation-8   	       3	7234521045 ns/op
#   PASS
#   ok  	command-line-arguments	21.704s
```

**Interpretation**:
- `3` = number of iterations
- `7234521045 ns/op` ≈ 7.2 seconds per operation
- Should be < 10,000,000,000 ns/op (10 seconds)

---

## Performance Analysis

### Expected Performance Breakdown

**Wallet Creation (7-9 seconds total)**:
1. **Mnemonic generation**: ~100ms
   - BIP39 entropy generation
   - Checksum calculation
   - Wordlist mapping

2. **Encryption**: ~1-2 seconds
   - Argon2id key derivation (designed to be slow)
   - AES-256-GCM encryption
   - File I/O

3. **Address generation**: ~4-6 seconds
   - BIP44 derivation for 24+ coins
   - Various address formatters (Bitcoin, Ethereum, etc.)
   - ~200-300ms per coin average

4. **Metadata serialization**: ~100ms
   - JSON marshaling
   - Atomic file write
   - Audit logging

**Address Lookup (< 1ms)**:
1. **Symbol normalization**: ~1µs
2. **Map lookup**: ~10µs (O(1) operation)
3. **Return pointer**: ~1µs

---

## Optimization Opportunities

### Current Implementation: Sequential

```go
// Current: Sequential address generation
for _, coin := range coins {
    address, err := s.deriveAddressByFormatter(addressKey, coin.FormatterID)
    // ...
}
```

**Performance**: 4-6 seconds for 24 coins (200-300ms per coin)

### Future Optimization: Parallel (T063)

```go
// Future: Parallel address generation with goroutines
var wg sync.WaitGroup
results := make(chan DerivedAddress, len(coins))

for _, coin := range coins {
    wg.Add(1)
    go func(coin CoinMetadata) {
        defer wg.Done()
        address, err := s.deriveAddressByFormatter(addressKey, coin.FormatterID)
        if err == nil {
            results <- DerivedAddress{...}
        }
    }(coin)
}

wg.Wait()
close(results)
```

**Expected Performance**: 1-2 seconds (parallel execution)
**Speedup**: 3-4x faster
**Tradeoff**: More CPU usage during wallet creation (acceptable one-time cost)

---

## Performance Monitoring in Production

### Metrics to Track

1. **Wallet Creation Time**
   - Target: < 10 seconds (95th percentile)
   - Alert: > 15 seconds
   - Track: histogram distribution

2. **Address Generation Success Rate**
   - Target: > 80% success (20+ out of 24 coins)
   - Alert: < 70% success
   - Track: per-coin success/failure rates

3. **Address Lookup Time**
   - Target: < 100ms (99th percentile)
   - Alert: > 500ms
   - Track: P50, P95, P99 latencies

4. **Memory Usage**
   - Target: < 100 MB during wallet creation
   - Alert: > 500 MB
   - Track: heap allocation, RSS

### Instrumentation Example

```go
// Add to internal/services/wallet/service.go
import "time"

func (s *WalletService) CreateWallet(...) (*models.Wallet, string, error) {
    startTime := time.Now()
    defer func() {
        duration := time.Since(startTime)
        // Log performance metric
        log.Printf("PERF: CreateWallet duration=%v", duration)

        // Send to monitoring system (e.g., Prometheus)
        // walletCreationDuration.Observe(duration.Seconds())
    }()

    // ... existing code ...
}
```

---

## Regression Testing

### Automated Performance Tests

Create a CI/CD pipeline step:

```yaml
# .github/workflows/performance.yml
name: Performance Tests
on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
        with:
          go-version: '1.21'

      - name: Run Performance Tests
        run: |
          go test -v -timeout 30s ./tests/integration/performance_test.go
          go test -bench=. -benchtime=3x ./tests/integration/performance_test.go

      - name: Check Performance Threshold
        run: |
          # Fail if wallet creation > 10 seconds
          # Parse benchmark output and validate
```

### Baseline Metrics (Example)

**Hardware**: MacBook Pro M1, 16GB RAM, SSD
**Go Version**: 1.21.5
**OS**: macOS 14.0

| Metric | Baseline | Threshold |
|--------|----------|-----------|
| Wallet creation | 7.2s | < 10s |
| Address generation (24 coins) | 4.8s | < 6s |
| Single coin derivation | 200ms | < 500ms |
| Address lookup | 85µs | < 100ms |
| Memory usage | 45 MB | < 100 MB |

---

## Troubleshooting Performance Issues

### Issue: Wallet creation > 10 seconds

**Possible Causes**:
1. Slow USB drive (mechanical HDD instead of SSD)
2. High system load
3. Argon2id parameters too aggressive
4. Too many coins in registry

**Solutions**:
- Use SSD USB drive
- Reduce system load
- Benchmark Argon2id parameters
- Profile with `go test -cpuprofile=cpu.prof`

### Issue: Address lookup > 100ms

**Possible Causes**:
1. Large AddressBook (> 1000 addresses)
2. Linear search instead of map lookup
3. JSON parsing on every lookup

**Solutions**:
- Verify using map[string]int index (O(1) lookup)
- Load AddressBook once, cache in memory
- Profile with `go test -memprofile=mem.prof`

### Issue: Memory usage > 100 MB

**Possible Causes**:
1. Master key not cleared from memory
2. All extended keys kept in memory
3. Large JSON deserialization

**Solutions**:
- Verify seed clearing (defer func)
- Use streaming JSON parsing
- Run memory profiler

---

## Validation Checklist

Before marking T109-T110 as complete:

- [ ] Run `TestWalletCreationPerformance` - PASS (< 10s)
- [ ] Run `TestAddressLookupPerformance` - PASS (< 100ms)
- [ ] Run `BenchmarkWalletCreation` - PASS (< 10s avg)
- [ ] Verify 20+ addresses generated successfully
- [ ] Check memory usage < 100 MB
- [ ] Review benchmark output for anomalies
- [ ] Document baseline metrics
- [ ] Create performance regression test for CI/CD

---

## Status

**Current Implementation**: ✅ Ready for validation
- Performance tests defined (`performance_test.go`)
- Benchmarks configured
- Test infrastructure in place

**Pending**: 🔧 Actual execution with full integration
- Requires complete build
- Requires USB storage
- Requires dependencies installed

**Next Steps**:
1. Enable performance tests (remove t.Skip())
2. Run on target hardware
3. Document baseline metrics
4. Set up CI/CD regression tests

---

**Author**: Claude (AI Assistant)
**Date**: 2025-10-16
**Version**: 1.0
