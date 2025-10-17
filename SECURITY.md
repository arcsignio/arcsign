# Security Policy

## Overview

ArcSign takes security seriously. This document outlines the security measures implemented in the wallet, best practices for users, and how to report security vulnerabilities.

## Security Features

### 1. Encryption

#### AES-256-GCM
- **Algorithm**: Advanced Encryption Standard with 256-bit keys
- **Mode**: Galois/Counter Mode (GCM) for authenticated encryption
- **Authentication**: Built-in message authentication prevents tampering
- **Nonce**: 12-byte random nonce generated for each encryption operation
- **Implementation**: Go standard library `crypto/aes` and `crypto/cipher`

#### Key Derivation Function (Argon2id)
- **Algorithm**: Argon2id (winner of Password Hashing Competition)
- **Parameters** (OWASP-recommended):
  - Time cost: 4 iterations
  - Memory cost: 256 MiB (262,144 KB)
  - Parallelism: 4 threads
  - Salt: 16 bytes (randomly generated per wallet)
  - Output: 32 bytes (256 bits)
- **Purpose**: Derives encryption key from user password
- **Resistance**: Memory-hard algorithm resistant to:
  - GPU attacks
  - ASIC attacks
  - Side-channel attacks

### 2. Password Security

#### Password Requirements
Enforced by `internal/utils/validators.go`:
- Minimum length: 12 characters
- Complexity: Must contain at least 3 of the following:
  - Uppercase letters (A-Z)
  - Lowercase letters (a-z)
  - Numbers (0-9)
  - Special characters (!@#$%^&*()-_=+[{]}\|;:'",<.>/?)

#### Password Storage
- **Never stored**: Passwords are never written to disk
- **Memory clearing**: Passwords are cleared from memory after use (where possible)
- **Encrypted at rest**: Only the encrypted mnemonic is stored

### 3. Rate Limiting

#### Brute-Force Protection
Implementation: `internal/services/ratelimit/limiter.go`

- **Limit**: 3 failed password attempts per wallet per minute
- **Window**: Sliding window algorithm
- **Reset**: Automatic reset on successful authentication
- **Storage**: In-memory (resets on restart for security)
- **Purpose**: Prevents automated brute-force attacks

#### Rate Limit Behavior
```
Attempt 1: Failed → Allowed
Attempt 2: Failed → Allowed
Attempt 3: Failed → Allowed
Attempt 4: BLOCKED for 60 seconds
```

### 4. Audit Logging

#### Log Format
- **Format**: NDJSON (Newline-Delimited JSON)
- **Location**: `{wallet_id}/audit.log`
- **Append-only**: Prevents tampering with historical records

#### Logged Events
```json
{
  "timestamp": "2025-10-16T15:30:45Z",
  "event_type": "WALLET_CREATED",
  "wallet_id": "3c3e0aba-91e1-44d4-8b29-ec066d5acf0b",
  "details": {
    "word_count": 12,
    "uses_passphrase": false
  }
}

{
  "timestamp": "2025-10-16T15:35:12Z",
  "event_type": "RESTORE_SUCCESS",
  "wallet_id": "3c3e0aba-91e1-44d4-8b29-ec066d5acf0b"
}

{
  "timestamp": "2025-10-16T15:40:30Z",
  "event_type": "RESTORE_FAILURE",
  "wallet_id": "3c3e0aba-91e1-44d4-8b29-ec066d5acf0b",
  "details": {
    "reason": "wrong_password"
  }
}
```

### 5. USB-Only Storage

#### Design Principles
- **No local storage**: Wallet data never touches the computer's hard drive
- **Removable security**: Disconnect USB when not in use
- **Physical control**: You control where your wallet lives
- **Air-gap capable**: Use with offline computers

#### Atomic File Operations
- **Temp-then-rename**: Files written to `.tmp` first, then renamed
- **Crash-safe**: Prevents corruption from power loss or crashes
- **fsync**: Ensures data is physically written to USB before returning

### 6. Mnemonic Security

#### BIP39 Implementation
- **Entropy sources**: Cryptographically secure random number generator (CSPRNG)
- **Wordlist**: Standard English BIP39 wordlist (2048 words)
- **Checksum**: Last word contains checksum to detect errors
- **Passphrase**: Optional 25th word for additional security

#### Mnemonic Handling
- **Display once**: Shown only during wallet creation
- **User confirmation**: Requires user to acknowledge backup
- **Never logged**: Never written to audit logs
- **Encrypted storage**: Always encrypted at rest

### 7. Key Derivation (BIP32/BIP44)

#### Hardened Derivation
- **Purpose**: Prevents parent key exposure from child keys
- **Levels**: First 3 levels are hardened (purpose, coin_type, account)
- **Notation**: Indicated by apostrophe (e.g., `44'`)
- **Index**: 0x80000000 + index (2^31 + index)

#### Path Structure
```
m / 44' / coin_type' / account' / change / address_index
│   │     │            │          │        │
│   │     │            │          │        └─ Unhardened (0-2^31-1)
│   │     │            │          └────────── 0=external, 1=internal
│   │     │            └───────────────────── Hardened (0-2^31-1)
│   │     └────────────────────────────────── Hardened (per SLIP-44)
│   └──────────────────────────────────────── Hardened (always 44)
└──────────────────────────────────────────── Master key
```

## Threat Model

### In Scope

#### Threats We Protect Against
1. **Malware on user's computer**
   - Mitigation: USB-only storage, no local caching
2. **Hard drive forensics**
   - Mitigation: No wallet data on hard drive
3. **Brute-force attacks**
   - Mitigation: Rate limiting, strong KDF
4. **Password guessing**
   - Mitigation: Strong password requirements, Argon2id
5. **Data tampering**
   - Mitigation: Authenticated encryption (GCM)
6. **Accidental file corruption**
   - Mitigation: Atomic file operations, fsync

### Out of Scope

#### Threats We Don't Protect Against
1. **Physical access to unlocked USB**
   - User responsibility: Keep USB secure
2. **Keyloggers on compromised system**
   - User responsibility: Use trusted computers
3. **Screen recording malware**
   - User responsibility: Use secure environment for wallet operations
4. **Lost mnemonic phrase**
   - User responsibility: Backup and secure mnemonic
5. **Forgotten BIP39 passphrase**
   - No recovery possible by design
6. **Social engineering**
   - User responsibility: Never share mnemonic or passwords

## Best Practices for Users

### Wallet Creation
1. **Use a secure computer**
   - Preferably offline or air-gapped
   - Fresh OS installation recommended
   - Run antivirus scan before wallet creation

2. **Generate strong passwords**
   - Use a password manager
   - Minimum 16 characters recommended
   - Avoid common words or patterns
   - Don't reuse passwords

3. **Secure mnemonic backup**
   - Write on paper, never digitally
   - Use archival-quality paper and ink
   - Consider metal backup solutions
   - Store in multiple secure locations
   - Test recovery before adding funds

4. **BIP39 passphrase considerations**
   - Only use if you understand the implications
   - Write down separately from mnemonic
   - Test recovery with passphrase
   - Consider: forgotten passphrase = lost funds

### Wallet Usage
1. **USB drive security**
   - Dedicated USB for wallet use only
   - Never use on untrusted computers
   - Disconnect when not in use
   - Store in secure location

2. **Password hygiene**
   - Never write down encryption password
   - Don't share with anyone
   - Change if potentially compromised
   - Use unique password for each wallet

3. **Operational security**
   - Check for surveillance (cameras, people)
   - Use privacy screens
   - Clear clipboard after use
   - Restart computer after wallet operations

### Address Derivation
1. **Verify addresses**
   - Double-check before receiving funds
   - Use multiple derivation attempts to verify determinism
   - Test with small amounts first

2. **Account management**
   - Use account 0 for primary holdings
   - Use additional accounts for separation
   - Document account purposes

## Security Audit Checklist

### For Auditors

#### Cryptography Review
- [ ] Verify Argon2id parameters match OWASP recommendations
- [ ] Check AES-256-GCM implementation uses standard library
- [ ] Confirm nonce is randomly generated and never reused
- [ ] Verify salt is randomly generated per wallet
- [ ] Check key derivation uses constant-time comparison

#### File I/O Review
- [ ] Verify atomic file operations (temp-then-rename)
- [ ] Check file permissions (0600 for sensitive files)
- [ ] Confirm fsync is called after writes
- [ ] Verify no sensitive data in temporary files

#### Password Handling
- [ ] Confirm password complexity requirements
- [ ] Verify passwords never written to disk
- [ ] Check memory clearing after use
- [ ] Confirm no password logging

#### Rate Limiting
- [ ] Verify 3-attempt limit per minute
- [ ] Check sliding window implementation
- [ ] Confirm reset on success
- [ ] Test concurrent access handling

#### Mnemonic Handling
- [ ] Verify BIP39 implementation correctness
- [ ] Check entropy source is cryptographically secure
- [ ] Confirm mnemonic never logged
- [ ] Verify encryption before storage

#### Key Derivation
- [ ] Verify BIP32 implementation correctness
- [ ] Check hardened derivation levels
- [ ] Confirm path parsing handles edge cases
- [ ] Verify no key leakage

## Known Limitations

### 1. Memory Attacks
- **Issue**: Sensitive data may remain in RAM
- **Risk**: Cold boot attacks, memory dumps
- **Mitigation**: Limited (OS-level concern)
- **Recommendation**: Use on dedicated, secure computers

### 2. Side-Channel Attacks
- **Issue**: Timing attacks, power analysis
- **Risk**: Theoretical in normal usage
- **Mitigation**: Standard library uses constant-time operations where possible
- **Recommendation**: Don't use on compromised hardware

### 3. Clipboard Attacks
- **Issue**: Addresses copied to clipboard
- **Risk**: Clipboard monitoring malware
- **Mitigation**: None (OS-level concern)
- **Recommendation**: Clear clipboard after use

### 4. Screen Recording
- **Issue**: Mnemonic displayed on screen
- **Risk**: Screen recording malware
- **Mitigation**: None (application can't prevent)
- **Recommendation**: Use secure environment

## Reporting Security Vulnerabilities

### Responsible Disclosure

If you discover a security vulnerability in ArcSign, please report it responsibly.

#### Contact
- **Email**: security@example.com
- **PGP Key**: [Link to PGP key]
- **Response Time**: Within 48 hours

#### Information to Include
1. Description of the vulnerability
2. Steps to reproduce
3. Proof of concept (if applicable)
4. Suggested fix (if any)
5. Your name/handle for credit (optional)

#### What NOT to Do
- ❌ Do not publicly disclose until patch is released
- ❌ Do not exploit the vulnerability
- ❌ Do not share with others before disclosure

#### Our Commitment
- Acknowledge receipt within 48 hours
- Investigate and assess severity
- Develop and test fix
- Release patch with advisory
- Credit reporter (if desired)

### Vulnerability Severity Levels

#### Critical
- Remote code execution
- Private key extraction
- Mnemonic exposure

#### High
- Encryption bypass
- Rate limiting bypass
- Authentication bypass

#### Medium
- Information disclosure
- Denial of service
- Audit log manipulation

#### Low
- Cosmetic issues
- Minor information leaks
- Non-security bugs

## Security Update Policy

### Update Frequency
- **Critical vulnerabilities**: Emergency patch within 24-48 hours
- **High vulnerabilities**: Patch within 7 days
- **Medium vulnerabilities**: Patch in next release
- **Low vulnerabilities**: Patch when convenient

### Update Notification
- Security advisories published on GitHub
- Email notification to registered users (if applicable)
- Version number increment follows semantic versioning

## Compliance

### Standards
- **OWASP**: Password Storage Cheat Sheet
- **BIP39**: Mnemonic code for generating deterministic keys
- **BIP32**: Hierarchical Deterministic Wallets
- **BIP44**: Multi-Account Hierarchy for Deterministic Wallets
- **NIST**: FIPS 197 (AES), SP 800-132 (Password-Based Key Derivation)

### Cryptographic Libraries
- **Go Standard Library**: crypto/aes, crypto/cipher, crypto/rand
- **golang.org/x/crypto**: argon2, scrypt (for legacy support)
- **btcsuite**: BIP32/BIP44 implementation (audited)
- **tyler-smith/go-bip39**: BIP39 implementation (widely used)

## Security Checklist for Developers

### Before Committing
- [ ] No hardcoded secrets
- [ ] No debug logging of sensitive data
- [ ] Proper error handling (don't expose internals)
- [ ] Input validation on all user inputs
- [ ] Secure random number generation (crypto/rand)
- [ ] Constant-time comparisons for sensitive data
- [ ] File permissions set correctly (0600)
- [ ] Atomic file operations used
- [ ] Memory clearing after use (where possible)
- [ ] Test coverage for security-critical code

### Before Releasing
- [ ] All tests passing (202+ tests)
- [ ] Security audit completed
- [ ] Dependency vulnerabilities scanned
- [ ] Code review by second developer
- [ ] Test on multiple platforms
- [ ] Documentation updated
- [ ] CHANGELOG updated
- [ ] Version number incremented

## References

### Standards Documents
- [BIP39 Specification](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [BIP32 Specification](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [BIP44 Specification](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [SLIP-44 Coin Types](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [RFC 5869: HKDF](https://tools.ietf.org/html/rfc5869)
- [RFC 8018: PKCS #5](https://tools.ietf.org/html/rfc8018)

### Research Papers
- [Argon2: The Password Hashing Competition Winner](https://github.com/P-H-C/phc-winner-argon2)
- [AES-GCM Security Proof](https://csrc.nist.gov/publications/detail/sp/800-38d/final)

### Security Advisories
- Check GitHub Security Advisories tab for known vulnerabilities
- Subscribe to security mailing list for updates

---

**Last Updated**: 2025-10-16
**Version**: 0.1.0
**Maintainer**: ArcSign Security Team
