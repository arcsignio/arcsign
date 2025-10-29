# Performance Benchmark Tests

**Feature**: 005-go-cli-shared - Backend Communication Architecture Upgrade
**Tasks**: T060-T062 - Performance benchmarks and regression testing
**Created**: 2025-10-29

## Overview

This directory contains performance benchmark tests for the FFI (Foreign Function Interface) implementation. These tests validate that the Go shared library integration provides significant performance improvements over the previous subprocess-based CLI approach.

## Success Criteria

| Metric | Target | Baseline (Subprocess) |
|--------|--------|----------------------|
| Single operation | <100ms | 250ms |
| 10 consecutive ops | <1s | 2.5s |
| 20 consecutive ops | <2s | 5s |
| Performance improvement | ≥60% reduction | N/A |

## Test Files

### `ffi_benchmark_test.go`

Comprehensive benchmark suite including:

- **T060**: `TestConsecutive10Operations` - Validates 10 consecutive operations complete in <1s
- **T061**: `TestConsecutive20Operations` - Validates 20 consecutive operations complete in <2s
- **T061**: `TestRapidSuccessiveOperations` - Verifies no startup overhead between operations
- **T062**: `TestPerformanceRegression` - Placeholder for CI/CD regression detection

## Running Tests

### Prerequisites

```bash
# Build the Go shared library first
make build-shared-lib

# Or manually:
cd /Users/jnr350/Desktop/Yansiang/arcSignv2/internal/lib
CGO_ENABLED=1 go build -buildmode=c-shared -o libarcsign.dylib
```

### Run Performance Tests

```bash
# Run all performance tests
go test -v ./tests/performance/

# Run specific test
go test -v ./tests/performance/ -run TestConsecutive10Operations

# Run benchmarks
go test -bench=. ./tests/performance/

# Run with timing details
go test -v -timeout 30s ./tests/performance/ 2>&1 | grep -E "(PASS|FAIL|took|Average|Total)"
```

### Interpreting Results

**Good Performance:**
```
Operation 1: 15ms
Operation 2: 12ms
...
Total time for 10 operations: 150ms
Average operation time: 15ms
Operations per second: 66.67
PASS
```

**Performance Degradation:**
```
Operation 1: 15ms
Operation 10: 150ms  # ⚠️ Slowdown detected
Total time for 10 operations: 800ms  # ⚠️ Above target
FAIL
```

## Performance Regression Detection (T062)

### Baseline Metrics

Baseline metrics should be established after initial FFI implementation:

1. Run benchmarks on clean build
2. Record average times for 10 and 20 operations
3. Store in `baseline_metrics.json`

Example baseline:
```json
{
  "operation_count": 10,
  "total_time": "150ms",
  "avg_time": "15ms",
  "min_time": "12ms",
  "max_time": "25ms",
  "timestamp": "2025-10-29T10:00:00Z"
}
```

### CI/CD Integration

Performance tests run automatically on:
- Pull requests to `main`/`master`
- Commits to feature branches matching `*/go-cli-shared`
- Weekly schedule (to detect gradual degradation)

See `.github/workflows/performance-tests.yml` for configuration.

### Regression Thresholds

- **Warning**: Performance degrades by >20%
- **Failure**: Performance degrades by >30%
- **Critical**: Any operation exceeds 100ms

## Troubleshooting

### Tests Skip with "FFI library must be built first"

**Solution**: Build the shared library:
```bash
cd internal/lib
CGO_ENABLED=1 go build -buildmode=c-shared -o libarcsign.dylib
```

### Library Load Errors

**macOS**: Check library path and code signing:
```bash
ls -la internal/lib/libarcsign.dylib
codesign -v internal/lib/libarcsign.dylib
```

**Linux**: Check library permissions and dependencies:
```bash
ldd internal/lib/libarcsign.so
chmod +x internal/lib/libarcsign.so
```

### Slow Performance

1. **Check Debug Mode**: Release builds are 3-5x faster
2. **Check USB Speed**: Use USB 3.0+ for storage tests
3. **Check System Load**: Close other applications
4. **Check Logging**: Disable verbose logging in production

## Metrics Collection

### Manual Metrics

```bash
# Run benchmark and extract metrics
go test -v ./tests/performance/ -run TestConsecutive10Operations 2>&1 | \
  grep -E "(Average|Total|Operations per second)"
```

### Automated Metrics (Future)

- Integration with Prometheus for metrics export
- Grafana dashboard for visualization
- Historical trend analysis

## Related Documentation

- [Feature Specification](../../specs/005-go-cli-shared/spec.md)
- [Implementation Tasks](../../specs/005-go-cli-shared/tasks.md)
- [FFI API Contract](../../specs/005-go-cli-shared/contracts/ffi-api.md)

## Notes

- All tests use `GetVersion` as the baseline operation (fastest, most reliable)
- Actual wallet operations (CreateWallet, ImportWallet) will be slightly slower
- Performance targets are conservative; real-world performance may exceed targets
- Tests are skipped by default - remove `t.Skip()` once library is ready
