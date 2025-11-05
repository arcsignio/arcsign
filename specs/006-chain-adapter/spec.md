# Feature Specification: ChainAdapter - Cross-Chain Transaction Interface

**Feature Branch**: `006-chain-adapter`
**Created**: 2025-11-03
**Status**: Draft
**Input**: User description: "ChainAdapter 的需求：提供跨鏈一致的交易生命周期介面（build/estimate/sign/broadcast/derive），把各鏈差異（地址格式、nonce/sequence、gas/fee 制度、腳本/備註欄位、鏈 ID、編碼與序列化）封裝在實作內，對上層輸入統一的標準交易描述（含來源/目標、資產、金額、備註、約束與偏好），輸出可驗證的中間產物（可重建的 unsigned tx、規範化的費用與估算範圍、可追蹤的 tx hash/ids）。介面需具冪等與可重試性（尤其 estimate/broadcast）、明確錯誤分類（可重試/不可重試/使用者介入）、版本化能力與特性探測（capabilities，如是否支援 EIP-1559、memo、多人簽名、代扣費等）。derive 必須能從標準金鑰來源（xpub、mnemonic、硬體簽名器抽象）產出鏈特定地址/路徑；sign 支援離線與外部簽名器並保留可審計簽名原文；estimate 對波動鏈費有上下界與信心指標；build 能處理鏈特有欄位而不破壞通用結構；broadcast 提供提交回執與狀態查詢鉤子。所有方法需可注入假 RPC/簽名器以利單元測試，並暴露必要的觀測訊號（計時、RPC 失敗率、鏈健康標誌）給健康檢查器；擴展新鏈時不需改動 UI/服務層，只需新增一個符合介面的實作與最小化設定。成功判準：新增任一鏈只改 Adapter；同一筆交易在不同實作下輸出一致的標準化結果；錯誤能被正確分類並指引重試；在不穩定網路/鏈負載下仍可預測費用與可靠廣播。"

## Clarifications

### Session 2025-11-03

- Q: What is the primary implementation language for ChainAdapter? → A: Go 1.21+ (aligns with project constitution and existing codebase)
- Q: How should RPC endpoint reliability be handled? → A: Multiple RPC endpoints with automatic failover
- Q: Which chains should be implemented initially? → A: Bitcoin and Ethereum only (covers both UTXO and account-based paradigms)
- Q: How should RPC communication be structured for one-time vs continuous operations? → A: Support both HTTP for one-time operations and WebSocket for continuous updates
- Q: What state storage is needed for broadcast idempotency? → A: Transaction hash lookup and retry count (minimal state, in-memory or file-based)

## User Scenarios & Testing

### User Story 1 - Unified Transaction Building Across Chains (Priority: P1)

As a wallet developer, I need to build transactions for different blockchain networks (Bitcoin, Ethereum, Cosmos, etc.) using a unified interface, so that I don't have to write chain-specific logic in my application layer.

**Why this priority**: This is the core abstraction that enables the entire ChainAdapter architecture. Without it, each new chain requires modifications across the entire codebase.

**Independent Test**: Can be fully tested by building a simple transfer transaction on 2+ chains (e.g., Bitcoin and Ethereum) through the same interface and verifying that both produce valid unsigned transactions.

**Acceptance Scenarios**:

1. **Given** a standard transaction request (from, to, amount, asset), **When** building a transaction for Bitcoin, **Then** produces a valid unsigned PSBT
2. **Given** the same transaction request, **When** building for Ethereum, **Then** produces a valid unsigned EIP-1559 transaction
3. **Given** a transaction with memo field, **When** building for Bitcoin, **Then** gracefully handles unsupported memo by returning error with ErrorClassification=NonRetryable

---

### User Story 2 - Fee Estimation with Confidence Bounds (Priority: P1)

As a wallet user, I need to see fee estimates with upper and lower bounds and confidence levels, so that I can make informed decisions about when to send transactions, especially during network congestion.

**Why this priority**: Fee estimation is critical for user experience and prevents transactions from being stuck due to insufficient fees or overpaying significantly.

**Independent Test**: Can be tested by calling estimate on multiple chains during different network conditions and verifying that estimates include min/max bounds and confidence scores.

**Acceptance Scenarios**:

1. **Given** a transaction request, **When** estimating fees during normal network conditions, **Then** returns fee estimate with narrow bounds (e.g., ±10%) and high confidence (>90%)
2. **Given** a transaction request, **When** estimating during network congestion, **Then** returns fee estimate with wider bounds (e.g., ±30%) and lower confidence (60-80%)
3. **Given** a failed RPC call during estimation, **When** retrying, **Then** uses cached/fallback estimates and marks confidence as low (<50%)

---

### User Story 3 - Idempotent Transaction Broadcasting (Priority: P1)

As a wallet application, I need to safely retry transaction broadcasts without risk of double-spending, so that network failures don't result in lost transactions or duplicate sends.

**Why this priority**: Network reliability issues are common, and safe retry logic is essential for production systems.

**Independent Test**: Can be tested by broadcasting the same signed transaction multiple times and verifying that only one transaction appears on-chain with consistent transaction hash.

**Acceptance Scenarios**:

1. **Given** a signed transaction, **When** broadcasting for the first time, **Then** returns transaction hash and submission receipt
2. **Given** the same signed transaction, **When** broadcasting again (simulating network retry), **Then** returns the same transaction hash without error
3. **Given** a transaction that's already confirmed, **When** attempting to broadcast again, **Then** returns already-confirmed status with block number

---

### User Story 4 - Address Derivation from Multiple Key Sources (Priority: P2)

As a wallet developer, I need to derive chain-specific addresses from standard key sources (mnemonic, xpub, hardware wallet), so that users can manage multiple chains from a single seed.

**Why this priority**: Multi-chain support from a single seed is a key feature for modern wallets, but not required for basic transaction functionality.

**Independent Test**: Can be tested by deriving addresses for Bitcoin and Ethereum from the same BIP39 mnemonic and verifying correct derivation paths and address formats.

**Acceptance Scenarios**:

1. **Given** a BIP39 mnemonic and derivation path m/44'/0'/0'/0/0, **When** deriving Bitcoin address, **Then** produces valid P2WPKH address
2. **Given** the same mnemonic and path m/44'/60'/0'/0/0, **When** deriving Ethereum address, **Then** produces valid checksummed 0x address
3. **Given** a hardware wallet abstraction, **When** deriving address, **Then** delegates to hardware device and returns signed address proof

---

### User Story 5 - Capability Detection and Versioning (Priority: P2)

As a wallet UI developer, I need to detect what features each chain supports (EIP-1559, memos, multi-sig, fee delegation), so that I can show/hide relevant UI elements dynamically.

**Why this priority**: Provides better UX by adapting interface to chain capabilities, but basic transactions work without it.

**Independent Test**: Can be tested by querying capabilities for different chain adapters and verifying correct feature flags (e.g., Ethereum returns supportsEIP1559=true, Bitcoin returns supportsMemo=false).

**Acceptance Scenarios**:

1. **Given** an Ethereum chain adapter, **When** querying capabilities, **Then** returns {supportsEIP1559: true, supportsMemo: false, supportsMultiSig: false}
2. **Given** a Bitcoin chain adapter, **When** querying capabilities, **Then** returns {supportsEIP1559: false, supportsMemo: false, supportsMultiSig: false}
3. **Given** any chain adapter, **When** querying unsupported capability, **Then** returns false without error

---

### User Story 6 - Offline Signing with Audit Trail (Priority: P2)

As a security-conscious user, I need to sign transactions offline or with external signers while maintaining an audit trail of what was signed, so that I can verify transaction contents before broadcasting.

**Why this priority**: Important for security and transparency, but transactions can work with online signing for MVP.

**Independent Test**: Can be tested by building a transaction, serializing it for signing, signing offline, and verifying the signature matches the transaction content.

**Acceptance Scenarios**:

1. **Given** an unsigned transaction, **When** preparing for offline signing, **Then** returns human-readable signing payload (JSON/text) and binary payload
2. **Given** a signing payload, **When** signing with external signer, **Then** produces valid signature that can be verified against original transaction
3. **Given** a signed transaction, **When** auditing, **Then** can reconstruct original unsigned transaction and verify signature

---

### User Story 7 - Observable Metrics for Health Monitoring (Priority: P3)

As a DevOps engineer, I need to monitor RPC health, transaction success rates, and timing metrics, so that I can detect and respond to chain connectivity issues.

**Why this priority**: Important for production operations but not required for core functionality.

**Independent Test**: Can be tested by performing transactions and querying exposed metrics (RPC response times, failure rates, chain sync status).

**Acceptance Scenarios**:

1. **Given** multiple RPC calls, **When** querying metrics, **Then** returns average response time, success rate, and last successful call timestamp
2. **Given** RPC failures, **When** threshold exceeded, **Then** health check reports degraded status
3. **Given** chain adapter operations, **When** integrated with monitoring system, **Then** exposes Prometheus/StatsD compatible metrics

---

### Edge Cases

- What happens when a chain adapter encounters an unsupported transaction type (e.g., smart contract deployment on Bitcoin)?
- How does the system handle RPC endpoints that return inconsistent nonce/sequence values?
- What happens when fee estimates vary wildly between multiple RPC providers?
- How does the system handle chain forks or reorganizations during transaction broadcasting?
- What happens when a hardware signer times out or is disconnected during signing?
- How are transactions handled when chain-specific fields exceed size limits (e.g., Bitcoin OP_RETURN data)?
- What happens when a transaction is valid on one chain but the same parameters would be invalid on another?

## Requirements

### Functional Requirements

#### Core Interface (build/estimate/sign/broadcast/derive)

- **FR-001**: System MUST provide a unified ChainAdapter interface with five core methods: Build, Estimate, Sign, Broadcast, Derive
- **FR-002**: Each method MUST accept standardized input types (TransactionRequest, SigningRequest, etc.) that are chain-agnostic
- **FR-003**: Each method MUST return standardized output types (UnsignedTransaction, FeeEstimate, SignedTransaction, BroadcastReceipt, Address)
- **FR-004**: System MUST encapsulate all chain-specific logic (address formats, nonce/sequence, gas/fee models, encoding) within adapter implementations

#### Transaction Building

- **FR-005**: Build method MUST accept standard transaction description with: from, to, asset, amount, memo/data, constraints, preferences
- **FR-006**: Build method MUST produce reconstructible unsigned transactions with all chain-specific fields populated
- **FR-007**: Build method MUST support chain-specific extensions (e.g., Ethereum contract calls, Bitcoin UTXO selection) without breaking standard interface
- **FR-008**: Build method MUST validate transaction parameters and return clear validation errors for invalid inputs

#### Fee Estimation

- **FR-009**: Estimate method MUST return fee estimates with minimum, maximum, and recommended values
- **FR-010**: Estimate method MUST include confidence indicator (0-100%) based on network stability and data freshness
- **FR-011**: Estimate method MUST be idempotent and support retry without side effects
- **FR-012**: Estimate method MUST support fee preference levels (slow/normal/fast) that map to chain-specific fee markets
- **FR-013**: System MUST support WebSocket subscriptions for real-time fee estimate updates during volatile network conditions
- **FR-014**: Fee estimate updates via WebSocket MUST include timestamp and reason for update (e.g., network congestion change, base fee spike)

#### Transaction Signing

- **FR-015**: Sign method MUST support offline signing by accepting pre-built unsigned transactions
- **FR-016**: Sign method MUST support external signers (hardware wallets) through abstraction interface
- **FR-017**: Sign method MUST preserve auditable signing payload (human-readable and binary forms)
- **FR-018**: Sign method MUST validate signatures against expected public keys before returning

#### Transaction Broadcasting

- **FR-019**: Broadcast method MUST be idempotent (broadcasting same signed tx multiple times returns same result)
- **FR-020**: Broadcast method MUST return submission receipt with transaction hash/ID
- **FR-021**: System MUST maintain transaction hash lookup table with retry counts for idempotency enforcement
- **FR-022**: Transaction state storage MAY use in-memory cache or file-based persistence (no database dependency required)
- **FR-023**: Broadcast method MUST check transaction hash lookup before submitting to RPC to prevent double-spending
- **FR-024**: Broadcast method MUST increment retry count for each broadcast attempt and include in observability metrics
- **FR-025**: Broadcast method MUST provide status query hooks for checking transaction confirmation (via HTTP polling or WebSocket subscription)
- **FR-026**: System MUST support WebSocket subscriptions for real-time transaction status updates (pending → confirmed → finalized)
- **FR-027**: Broadcast method MUST detect and report already-broadcast or already-confirmed transactions

#### Address Derivation

- **FR-028**: Derive method MUST support BIP39 mnemonic as key source
- **FR-029**: Derive method MUST support extended public keys (xpub) as key source
- **FR-030**: Derive method MUST support hardware wallet abstraction as key source
- **FR-031**: Derive method MUST return chain-specific addresses with proper encoding (P2WPKH, checksummed 0x, bech32, etc.)
- **FR-032**: Derive method MUST use chain-appropriate BIP44/SLIP44 derivation paths

#### Error Handling and Classification

- **FR-033**: System MUST classify errors into three categories: Retryable, NonRetryable, UserIntervention
- **FR-034**: Retryable errors MUST include: temporary network failures, RPC timeouts, WebSocket disconnections, nonce conflicts (for automatic retry)
- **FR-035**: NonRetryable errors MUST include: invalid transaction format, insufficient balance, unsupported operation
- **FR-036**: UserIntervention errors MUST include: insufficient fee during congestion, multi-sig approval needed, hardware wallet approval needed
- **FR-037**: Each error MUST include human-readable message, error code, and retry guidance

#### Capability Detection and Versioning

- **FR-038**: Each chain adapter MUST expose Capabilities() method returning supported features
- **FR-039**: Capabilities MUST include flags for: EIP-1559 support, memo field support, multi-signature support, fee delegation support, WebSocket support
- **FR-040**: Adapters MUST declare interface version for backward compatibility
- **FR-041**: System MUST gracefully handle adapters with different capability sets

#### RPC Endpoint Management

- **FR-042**: Each chain adapter MUST support configuration of multiple RPC endpoints (both HTTP and WebSocket)
- **FR-043**: System MUST automatically failover to backup RPC endpoint when primary fails (timeout, error response, or unavailable)
- **FR-044**: RPC client MUST track per-endpoint health metrics (response time, success rate, last successful call)
- **FR-045**: Failover logic MUST be transparent to adapter method callers (no error propagation until all endpoints exhausted)
- **FR-046**: HTTP endpoints MUST be used for one-time operations: Build, Sign, Broadcast (initial submission), Derive
- **FR-047**: WebSocket endpoints MUST be used for continuous updates: transaction status monitoring, real-time fee estimation updates, chain health streaming
- **FR-048**: WebSocket connections MUST implement automatic reconnection with exponential backoff on disconnection
- **FR-049**: System MUST gracefully degrade to HTTP polling if WebSocket connection fails or is unavailable

#### Testing and Observability

- **FR-050**: All adapter methods MUST support dependency injection of RPC clients (both HTTP and WebSocket) for unit testing
- **FR-051**: All adapter methods MUST support dependency injection of signers for unit testing
- **FR-052**: All adapter methods MUST support dependency injection of transaction state storage for testing idempotency
- **FR-053**: System MUST expose observable metrics: RPC response times, failure rates, chain health status, failover events, WebSocket reconnection events, broadcast retry counts
- **FR-054**: System MUST provide timing instrumentation for each adapter method call
- **FR-055**: WebSocket subscriptions MUST be mockable for testing real-time update scenarios

#### Extensibility

- **FR-056**: Adding a new chain MUST only require: creating new adapter implementation and minimal configuration
- **FR-057**: Adding a new chain MUST NOT require changes to: UI layer, service layer, or other adapters
- **FR-058**: Adapter registry MUST support dynamic adapter loading and chain selection

### Technical Constraints

- **TC-001**: ChainAdapter core implementation MUST use Go 1.21+ (per project constitution backend-first policy)
- **TC-002**: Implementation MUST follow Go standard library conventions and idiomatic patterns
- **TC-003**: All chain-specific libraries MUST have Go bindings or CGO wrappers where necessary
- **TC-004**: Code MUST compile with Go 1.21+ without external system dependencies beyond standard toolchain
- **TC-005**: Transaction state storage MUST NOT require external database (in-memory or file-based only per project constitution)

### Initial Implementation Scope

- **SCOPE-001**: Initial implementation MUST include Bitcoin adapter (UTXO-based paradigm)
- **SCOPE-002**: Initial implementation MUST include Ethereum adapter (account-based paradigm with EIP-1559 support)
- **SCOPE-003**: Bitcoin adapter MUST support P2WPKH addresses and PSBT transaction format
- **SCOPE-004**: Ethereum adapter MUST support EIP-1559 transactions and checksummed addresses
- **SCOPE-005**: Architecture MUST support adding additional chains (e.g., Cosmos, Solana) in future iterations without breaking changes

### Key Entities

- **ChainAdapter**: The core interface defining build/estimate/sign/broadcast/derive methods with standardized inputs/outputs
- **TransactionRequest**: Standardized transaction description (from, to, asset, amount, memo, constraints, preferences)
- **UnsignedTransaction**: Chain-agnostic representation of an unsigned transaction with reconstruction capability
- **FeeEstimate**: Fee estimate with min/max/recommended amounts, confidence indicator, and timestamp
- **SignedTransaction**: Signed transaction with signature, signing payload, and verification data
- **BroadcastReceipt**: Transaction submission receipt with hash/ID, submission timestamp, and status query method
- **Address**: Derived address with chain-specific encoding and derivation path metadata
- **Capabilities**: Feature flags indicating what a chain adapter supports (EIP-1559, memo, multi-sig, WebSocket support, etc.)
- **ErrorClassification**: Error type (Retryable/NonRetryable/UserIntervention) with retry guidance
- **ChainMetrics**: Observable metrics for adapter health (RPC response times, failure rates, chain status)
- **TransactionStateStore**: Persistent or in-memory storage for transaction hash lookup and retry count tracking (for broadcast idempotency)
- **RPCClient**: Abstraction for HTTP and WebSocket RPC communication with automatic failover support
- **WebSocketSubscription**: Real-time subscription interface for fee updates, transaction status, and chain health events

## Success Criteria

### Measurable Outcomes

- **SC-001**: Adding a new chain requires changes only to adapter implementation code, with zero changes to UI or service layers
- **SC-002**: Same transaction request produces semantically equivalent results across different chain adapters (same amounts, recipients, etc. accounting for chain differences)
- **SC-003**: 100% of errors are correctly classified into Retryable/NonRetryable/UserIntervention categories
- **SC-004**: Fee estimates on volatile chains (e.g., Ethereum during congestion) provide bounds within 20% of actual on-chain fees 95% of the time
- **SC-005**: Broadcasting the same signed transaction 10 times produces identical transaction hashes without double-spending
- **SC-006**: Adapter health metrics correctly identify degraded RPC endpoints within 60 seconds of failure threshold
- **SC-007**: Offline signing workflow successfully reconstructs and verifies transactions with 100% accuracy
- **SC-008**: Capability detection allows UI to dynamically show/hide features without hardcoded chain checks
- **SC-009**: Unit tests achieve 90%+ coverage using injected mock RPC and signer dependencies
- **SC-010**: Address derivation from same mnemonic produces identical addresses to industry-standard wallets (e.g., MetaMask, Bitcoin Core)
