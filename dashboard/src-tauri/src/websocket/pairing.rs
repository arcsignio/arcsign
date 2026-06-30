//! Per-connection pairing code: an 8-digit one-time code shown in the desktop
//! app and entered in the mint page, gating the connection before any
//! account/sign method is allowed. Connection-scoped, 60s TTL, 3 attempts.

use std::time::Duration;
use rand::Rng;
use subtle::ConstantTimeEq;

const MAX_ATTEMPTS: u8 = 3;

#[derive(Debug, PartialEq)]
pub enum VerifyResult {
    Paired,
    Wrong { remaining: u8 },
    Locked,
    Expired,
}

pub struct PairingState {
    code: String,          // 8 ASCII digits
    created_at_ms: u64,
    ttl: Duration,
    attempts: u8,
    paired: bool,
    locked: bool,
}

impl PairingState {
    /// Generate a fresh 8-digit code. `now_ms` is injected for testability.
    pub fn generate(ttl: Duration, now_ms: u64) -> Self {
        let mut rng = rand::thread_rng();
        let n: u32 = rng.gen_range(0..100_000_000);
        let code = format!("{:08}", n);
        Self::new_with_code(code, ttl, now_ms)
    }

    pub fn new_with_code(code: String, ttl: Duration, now_ms: u64) -> Self {
        debug_assert!(
            code.len() == 8 && code.bytes().all(|b| b.is_ascii_digit()),
            "pairing code must be exactly 8 ASCII digits"
        );
        Self { code, created_at_ms: now_ms, ttl, attempts: 0, paired: false, locked: false }
    }

    /// "1234-5678" for display.
    pub fn code_display(&self) -> String {
        format!("{}-{}", &self.code[..4], &self.code[4..])
    }

    #[cfg(test)]
    pub fn raw_code_for_test(&self) -> &str { &self.code }

    pub fn is_paired(&self) -> bool { self.paired }

    /// True once the attempt budget is exhausted (locked out).
    pub fn is_locked(&self) -> bool { self.locked }

    /// True once `now_ms` is past the creation time + TTL.
    pub fn is_expired(&self, now_ms: u64) -> bool {
        now_ms.saturating_sub(self.created_at_ms) > self.ttl.as_millis() as u64
    }

    /// `verify` expects a digits-only code (the display dash must be stripped by
    /// the caller — see `normalize_pairing_code` in server.rs).
    pub fn verify(&mut self, input: &str, now_ms: u64) -> VerifyResult {
        if self.paired {
            return VerifyResult::Paired;
        }
        if self.locked {
            return VerifyResult::Locked;
        }
        if now_ms.saturating_sub(self.created_at_ms) > self.ttl.as_millis() as u64 {
            return VerifyResult::Expired;
        }
        let ok: bool = input.as_bytes().ct_eq(self.code.as_bytes()).into();
        if ok {
            self.paired = true;
            return VerifyResult::Paired;
        }
        self.attempts += 1;
        if self.attempts >= MAX_ATTEMPTS {
            self.locked = true;
            return VerifyResult::Locked;
        }
        VerifyResult::Wrong { remaining: MAX_ATTEMPTS - self.attempts }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn code_is_8_digits() {
        let p = PairingState::new_with_code("12345678".into(), Duration::from_secs(60), 0);
        assert_eq!(p.code_display(), "1234-5678");
    }

    #[test]
    fn correct_code_pairs() {
        let mut p = PairingState::new_with_code("12345678".into(), Duration::from_secs(60), 0);
        assert!(matches!(p.verify("12345678", 1_000), VerifyResult::Paired));
        assert!(p.is_paired());
    }

    #[test]
    fn wrong_code_counts_attempt() {
        let mut p = PairingState::new_with_code("12345678".into(), Duration::from_secs(60), 0);
        assert!(matches!(p.verify("00000000", 1_000), VerifyResult::Wrong { remaining: 2 }));
        assert!(!p.is_paired());
    }

    #[test]
    fn three_wrong_locks() {
        let mut p = PairingState::new_with_code("12345678".into(), Duration::from_secs(60), 0);
        p.verify("0", 1_000);
        p.verify("0", 1_000);
        assert!(matches!(p.verify("0", 1_000), VerifyResult::Locked));
        assert!(matches!(p.verify("12345678", 1_000), VerifyResult::Locked));
    }

    #[test]
    fn expired_code_rejected() {
        let mut p = PairingState::new_with_code("12345678".into(), Duration::from_secs(60), 0);
        assert!(matches!(p.verify("12345678", 61_000), VerifyResult::Expired));
    }

    #[test]
    fn second_wrong_attempt_reports_one_remaining() {
        let mut p = PairingState::new_with_code("12345678".into(), Duration::from_secs(60), 0);
        assert!(matches!(p.verify("00000000", 1_000), VerifyResult::Wrong { remaining: 2 }));
        assert!(matches!(p.verify("00000000", 1_000), VerifyResult::Wrong { remaining: 1 }));
    }

    #[test]
    fn verify_after_paired_is_idempotent() {
        let mut p = PairingState::new_with_code("12345678".into(), Duration::from_secs(60), 0);
        assert!(matches!(p.verify("12345678", 1_000), VerifyResult::Paired));
        // A subsequent wrong code must NOT un-pair or count an attempt — stays Paired.
        assert!(matches!(p.verify("00000000", 1_000), VerifyResult::Paired));
        assert!(p.is_paired());
    }

    #[test]
    fn is_expired_boundary() {
        let p = PairingState::new_with_code("12345678".into(), Duration::from_secs(60), 0);
        // Exactly at the TTL edge is still valid; one ms past is expired.
        assert!(!p.is_expired(60_000));
        assert!(p.is_expired(60_001));
    }

    #[test]
    fn is_locked_reflects_lockout() {
        let mut p = PairingState::new_with_code("12345678".into(), Duration::from_secs(60), 0);
        assert!(!p.is_locked());
        p.verify("0", 1_000);
        p.verify("0", 1_000);
        p.verify("0", 1_000);
        assert!(p.is_locked());
    }

    #[test]
    fn generated_code_is_8_ascii_digits() {
        let p = PairingState::generate(Duration::from_secs(60), 0);
        let raw = p.raw_code_for_test();
        assert_eq!(raw.len(), 8);
        assert!(raw.chars().all(|c| c.is_ascii_digit()));
    }
}
