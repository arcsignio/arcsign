//! FFI (Foreign Function Interface) module for Go shared library integration.
//!
//! This module provides safe Rust wrappers around the Go wallet library compiled
//! as a C-compatible shared library (.dll/.dylib/.so).
//!
//! Architecture:
//! - `bindings.rs`: Unsafe extern "C" declarations and safe wrappers
//! - `types.rs`: Rust types for FFI data exchange (JSON schemas)
//! - `queue.rs`: Single-threaded operation queue using Tokio channels
//!
//! Memory Management:
//! - Go allocates strings via C.CString
//! - Rust must call GoFree() on all returned pointers
//! - Pattern: call FFI → copy result → free immediately
//!
//! Thread Safety:
//! - All wallet operations serialized through WalletQueue
//! - Library loaded once at startup, never reloaded
//! - Function symbols cached to avoid repeated unsafe operations
//!
//! Feature: 005-go-cli-shared
//! Created: 2025-10-25

pub mod bindings;
pub mod types;
pub mod queue;

// Re-export main types for convenience
pub use bindings::WalletLibrary;
pub use queue::WalletQueue;
pub use types::{FFIResponse, FFIError, ErrorCode};
