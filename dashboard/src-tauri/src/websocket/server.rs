/**
 * WebSocket Server Implementation
 *
 * Listens on 127.0.0.1:9527 for external wallet connections.
 * Only accepts connections from localhost for security.
 */

use super::handler::{handle_request, HandlerContext, PendingTxSender, PendingMsgSender};
use super::protocol::{WsMethod, WsRequest, WsResponse, DevSession};
use super::{PairingState, VerifyResult};
use crate::ffi::LazyWalletQueue;
use futures_util::{SinkExt, StreamExt};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, RwLock};
use tokio_tungstenite::{
    accept_hdr_async,
    tungstenite::{
        handshake::server::{Request, Response, ErrorResponse},
        http::StatusCode,
        Message,
    },
};

/// WebSocket server port
const WS_PORT: u16 = 9527;

/// A pairing prompt pushed to the desktop UI: the connection asked to pair,
/// the app shows this 8-digit code for the user to type into the requesting page.
#[derive(Clone, serde::Serialize)]
pub struct PairingPrompt {
    /// "1234-5678" display form of the fresh pairing code.
    pub code_display: String,
    /// Requesting Origin header, shown for context.
    pub origin: String,
}

/// Channel for sending pairing prompts to the UI. Mirrors the pending-tx
/// `mpsc::UnboundedSender` flavor so the call sites stay symmetric.
pub type PairingPromptSender = mpsc::UnboundedSender<PairingPrompt>;

/// WebSocket server state
pub struct WebSocketServer {
    /// Currently connected addresses (from loaded wallet)
    accounts: Arc<RwLock<Vec<String>>>,
    /// USB device path (for reading dev settings)
    usb_path: Arc<RwLock<Option<String>>>,
    /// Channel for pending transactions
    pending_tx_sender: PendingTxSender,
    /// Channel for pending message sign requests
    pending_msg_sender: PendingMsgSender,
    /// Channel for pushing pairing prompts to the UI
    pending_pairing_sender: PairingPromptSender,
    /// FFI wallet queue for session-based signing
    wallet_queue: Option<LazyWalletQueue>,
    /// Developer session state (shared across connections)
    dev_session: Arc<RwLock<Option<DevSession>>>,
    /// Shutdown signal
    shutdown_tx: Option<mpsc::Sender<()>>,
}

impl WebSocketServer {
    /// Create a new WebSocket server
    pub fn new(
        pending_tx_sender: PendingTxSender,
        pending_msg_sender: PendingMsgSender,
        pending_pairing_sender: PairingPromptSender,
    ) -> Self {
        Self {
            accounts: Arc::new(RwLock::new(Vec::new())),
            usb_path: Arc::new(RwLock::new(None)),
            pending_tx_sender,
            pending_msg_sender,
            pending_pairing_sender,
            wallet_queue: None,
            dev_session: Arc::new(RwLock::new(None)),
            shutdown_tx: None,
        }
    }

    /// Create a new WebSocket server with FFI wallet queue for auto-signing
    pub fn with_wallet_queue(
        pending_tx_sender: PendingTxSender,
        pending_msg_sender: PendingMsgSender,
        pending_pairing_sender: PairingPromptSender,
        wallet_queue: LazyWalletQueue,
    ) -> Self {
        Self {
            accounts: Arc::new(RwLock::new(Vec::new())),
            usb_path: Arc::new(RwLock::new(None)),
            pending_tx_sender,
            pending_msg_sender,
            pending_pairing_sender,
            wallet_queue: Some(wallet_queue),
            dev_session: Arc::new(RwLock::new(None)),
            shutdown_tx: None,
        }
    }

    /// Get shared dev session state
    pub fn dev_session(&self) -> Arc<RwLock<Option<DevSession>>> {
        Arc::clone(&self.dev_session)
    }

    /// Update dev session (called from Tauri commands)
    pub async fn set_dev_session(&self, session: Option<DevSession>) {
        let mut s = self.dev_session.write().await;
        if let Some(ref sess) = session {
            tracing::info!(
                "WebSocket server: session SET - enabled={}, expires_at={}, networks={:?}, token={:?}",
                sess.enabled,
                sess.expires_at,
                sess.trusted_networks,
                sess.session_token.as_ref().map(|t| format!("{}...", &t[..8.min(t.len())]))
            );
        } else {
            tracing::info!("WebSocket server: session CLEARED");
        }
        *s = session;
    }

    /// Update the list of available BSC addresses
    pub async fn update_accounts(&self, accounts: Vec<String>) {
        let mut acc = self.accounts.write().await;
        *acc = accounts;
        tracing::info!("WebSocket server: updated {} BSC addresses", acc.len());
    }

    /// Update the USB device path
    pub async fn update_usb_path(&self, path: Option<String>) {
        let mut usb = self.usb_path.write().await;
        *usb = path.clone();
        if let Some(ref p) = path {
            tracing::info!("WebSocket server: USB path set to {}", p);
        } else {
            tracing::info!("WebSocket server: USB path cleared");
        }
    }

    /// Start the WebSocket server
    pub async fn start(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let addr = SocketAddr::from(([127, 0, 0, 1], WS_PORT));

        let listener = TcpListener::bind(&addr).await?;
        tracing::info!("WebSocket server listening on ws://{}", addr);

        // Create shutdown channel
        let (shutdown_tx, mut shutdown_rx) = mpsc::channel::<()>(1);
        self.shutdown_tx = Some(shutdown_tx);

        let accounts = Arc::clone(&self.accounts);
        let usb_path = Arc::clone(&self.usb_path);
        let pending_tx_sender = self.pending_tx_sender.clone();
        let pending_msg_sender = self.pending_msg_sender.clone();
        let pending_pairing_sender = self.pending_pairing_sender.clone();
        let wallet_queue = self.wallet_queue.clone();
        let dev_session = Arc::clone(&self.dev_session);

        // Spawn the accept loop
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    // Accept new connections
                    result = listener.accept() => {
                        match result {
                            Ok((stream, peer_addr)) => {
                                // Only accept connections from localhost
                                if !peer_addr.ip().is_loopback() {
                                    tracing::warn!(
                                        "Rejected connection from non-localhost: {}",
                                        peer_addr
                                    );
                                    continue;
                                }

                                tracing::info!("New WebSocket connection from {}", peer_addr);

                                let accounts = Arc::clone(&accounts);
                                let usb_path = Arc::clone(&usb_path);
                                let pending_tx_sender = pending_tx_sender.clone();
                                let pending_msg_sender = pending_msg_sender.clone();
                                let pending_pairing_sender = pending_pairing_sender.clone();
                                let wallet_queue = wallet_queue.clone();
                                let dev_session = Arc::clone(&dev_session);

                                tokio::spawn(async move {
                                    if let Err(e) = handle_connection(
                                        stream,
                                        peer_addr,
                                        accounts,
                                        usb_path,
                                        pending_tx_sender,
                                        pending_msg_sender,
                                        pending_pairing_sender,
                                        wallet_queue,
                                        dev_session,
                                    ).await {
                                        tracing::error!("Connection error: {}", e);
                                    }
                                });
                            }
                            Err(e) => {
                                tracing::error!("Failed to accept connection: {}", e);
                            }
                        }
                    }
                    // Shutdown signal
                    _ = shutdown_rx.recv() => {
                        tracing::info!("WebSocket server shutting down");
                        break;
                    }
                }
            }
        });

        Ok(())
    }

    /// Stop the WebSocket server
    pub async fn stop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(()).await;
        }
    }
}

/// Origins always allowed (the mint page + Tauri's own webview origins).
const ALLOWED_ORIGINS: &[&str] = &[
    "https://arcsign.io",        // mint page (production website)
    "tauri://localhost",         // Tauri production webview
    "https://tauri.localhost",   // Tauri alternative origin
];

/// Decide whether a WebSocket Origin header is allowed.
/// Production builds reject empty Origin (non-browser local processes) and
/// localhost dev ports. The `dev-mode` build additionally allows both, so the
/// Hardhat CLI (empty Origin) and a locally-served mint page work.
pub(crate) fn is_origin_allowed(origin: &str) -> bool {
    // RFC 6454: an Origin's scheme and host are case-insensitive. Compare
    // lowercased against ALLOWED_ORIGINS (already lowercase) so a case variant
    // matches instead of being wrongly rejected.
    let origin_lc = origin.to_ascii_lowercase();
    if ALLOWED_ORIGINS.contains(&origin_lc.as_str()) {
        return true;
    }
    #[cfg(feature = "dev-mode")]
    {
        if origin_lc.is_empty() || origin_lc.starts_with("http://localhost:") {
            return true;
        }
    }
    false
}

/// Before a connection is paired, only the pairing handshake + ping are allowed.
/// Everything else (account enumeration, signing) is rejected until the user
/// types the pairing code shown in the desktop app.
pub(crate) fn method_allowed_before_pairing(m: &WsMethod) -> bool {
    matches!(m, WsMethod::Ping | WsMethod::RequestPairing | WsMethod::VerifyPairing)
}

/// Normalize a submitted pairing code to digits-only. The desktop app displays
/// the code with a dash ("1234-5678") but the stored secret is 8 raw digits, so
/// strip every non-digit before the constant-time compare — otherwise the
/// displayed form could never verify (fails closed = pairing deadlock).
pub(crate) fn normalize_pairing_code(raw: &str) -> String {
    raw.chars().filter(|c| c.is_ascii_digit()).collect()
}

/// Current wall-clock time in milliseconds since the UNIX epoch.
/// (handler.rs has a `current_timestamp_ms`, but it is gated behind `dev-mode`;
/// pairing needs an always-available one.)
fn now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Handle a single WebSocket connection
async fn handle_connection(
    stream: TcpStream,
    peer_addr: SocketAddr,
    accounts: Arc<RwLock<Vec<String>>>,
    usb_path: Arc<RwLock<Option<String>>>,
    pending_tx_sender: PendingTxSender,
    pending_msg_sender: PendingMsgSender,
    pending_pairing_sender: PairingPromptSender,
    wallet_queue: Option<LazyWalletQueue>,
    dev_session: Arc<RwLock<Option<DevSession>>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // The Origin header is only visible inside the handshake callback below.
    // Lift it out via a shared cell so the pairing prompt can show which page
    // is requesting the connection.
    let captured_origin = Arc::new(std::sync::Mutex::new(String::new()));
    let origin_for_cb = Arc::clone(&captured_origin);

    let ws_stream = accept_hdr_async(stream, move |req: &Request, response: Response| {
        let origin = req
            .headers()
            .get("Origin")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        if let Ok(mut slot) = origin_for_cb.lock() {
            *slot = origin.to_string();
        }

        let allowed = is_origin_allowed(origin);

        if allowed {
            tracing::debug!("WebSocket Origin accepted: {:?}", origin);
            Ok(response)
        } else {
            tracing::warn!("WebSocket Origin rejected: {:?}", origin);
            let mut err_response = ErrorResponse::new(Some(format!("Forbidden origin: {}", origin)));
            *err_response.status_mut() = StatusCode::FORBIDDEN;
            Err(err_response)
        }
    })
    .await?;
    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    let client_origin = captured_origin.lock().map(|s| s.clone()).unwrap_or_default();

    tracing::info!("WebSocket connection established with {}", peer_addr);

    // Per-connection pairing. Until paired, only ping + the pairing handshake
    // are allowed. A fresh PairingState is created per connection (never reused
    // across reconnects), and once `paired` is true we stop calling `verify`.
    let mut pairing: Option<PairingState> = None;
    let mut paired = false;

    while let Some(msg) = ws_receiver.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                // Parse request
                let request: WsRequest = match serde_json::from_str(&text) {
                    Ok(r) => r,
                    Err(e) => {
                        let error_response = WsResponse::error(0, format!("Invalid request: {}", e));
                        let response_text = serde_json::to_string(&error_response)?;
                        ws_sender.send(Message::Text(response_text)).await?;
                        continue;
                    }
                };

                // Pairing handshake (handled here, not in the per-request handler,
                // because it mutates per-connection state).
                if request.method == WsMethod::RequestPairing {
                    // Only generate a fresh code if there isn't already an active
                    // one for this connection. Prevents a local process that
                    // passed the Origin check from spamming request_pairing to
                    // reset the 3-attempt lockout, flood the prompt channel, or
                    // pop a UI dialog per call. An expired or locked pairing may
                    // be replaced; an active one is reused.
                    let need_new = match pairing.as_ref() {
                        None => true,
                        Some(p) => p.is_expired(now_ms()) || p.is_locked(),
                    };
                    if need_new {
                        let state = PairingState::generate(
                            std::time::Duration::from_secs(60),
                            now_ms(),
                        );
                        let _ = pending_pairing_sender.send(PairingPrompt {
                            code_display: state.code_display(),
                            origin: client_origin.clone(),
                        });
                        pairing = Some(state);
                    }
                    let resp = WsResponse::success(
                        request.id,
                        serde_json::json!({"status": "pairing_started"}),
                    );
                    ws_sender.send(Message::Text(serde_json::to_string(&resp)?)).await?;
                    continue;
                }

                if request.method == WsMethod::VerifyPairing {
                    let raw = request
                        .params
                        .get("code")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    // Accept the code with or without the display dash
                    // ("1234-5678" or "12345678"): the stored secret is 8 raw
                    // digits, so strip non-digits before the constant-time compare.
                    let code = normalize_pairing_code(raw);
                    let result = match pairing.as_mut() {
                        Some(p) => p.verify(&code, now_ms()),
                        None => VerifyResult::Wrong { remaining: 0 },
                    };
                    // Single source of truth: derive the gate flag from the
                    // PairingState itself rather than a separate manual assignment.
                    paired = pairing.as_ref().map_or(false, |p| p.is_paired());
                    let (ok, msg) = match result {
                        VerifyResult::Paired => {
                            tracing::info!("WebSocket client {} paired", peer_addr);
                            (true, "paired".to_string())
                        }
                        VerifyResult::Wrong { remaining } => {
                            (false, format!("wrong code, {remaining} attempts left"))
                        }
                        VerifyResult::Locked => {
                            (false, "too many attempts, connection locked".to_string())
                        }
                        VerifyResult::Expired => {
                            (false, "pairing code expired".to_string())
                        }
                    };
                    let resp = if ok {
                        WsResponse::success(request.id, serde_json::json!({"status": msg}))
                    } else {
                        WsResponse::error(request.id, msg)
                    };
                    ws_sender.send(Message::Text(serde_json::to_string(&resp)?)).await?;
                    continue;
                }

                // Everything else requires a paired connection.
                if !paired && !method_allowed_before_pairing(&request.method) {
                    tracing::warn!(
                        "WebSocket client {} attempted {:?} before pairing",
                        peer_addr,
                        request.method
                    );
                    let resp = WsResponse::error(
                        request.id,
                        "pairing required: call request_pairing then verify_pairing".to_string(),
                    );
                    ws_sender.send(Message::Text(serde_json::to_string(&resp)?)).await?;
                    continue;
                }

                // Get current accounts and USB path
                let acc = accounts.read().await.clone();
                let usb = usb_path.read().await.clone();

                // Create handler context with session state and wallet queue
                let context = HandlerContext::with_session_and_queue(
                    pending_tx_sender.clone(),
                    pending_msg_sender.clone(),
                    acc,
                    usb,
                    Arc::clone(&dev_session),
                    wallet_queue.clone(),
                );

                // Handle request
                let response = handle_request(request, &context).await;

                // Send response
                let response_text = serde_json::to_string(&response)?;
                ws_sender.send(Message::Text(response_text)).await?;
            }
            Ok(Message::Ping(data)) => {
                ws_sender.send(Message::Pong(data)).await?;
            }
            Ok(Message::Close(_)) => {
                tracing::info!("WebSocket connection closed by {}", peer_addr);
                break;
            }
            Err(e) => {
                tracing::error!("WebSocket error from {}: {}", peer_addr, e);
                break;
            }
            _ => {}
        }
    }

    Ok(())
}

#[cfg(test)]
mod origin_tests {
    use super::is_origin_allowed;

    #[test]
    fn allows_exact_lowercase_origin() {
        assert!(is_origin_allowed("https://arcsign.io"));
    }

    #[test]
    fn allows_mixed_case_origin_rfc6454() {
        // RFC 6454: scheme/host are case-insensitive. Must still match.
        assert!(is_origin_allowed("HTTPS://ARCSIGN.IO"));
        assert!(is_origin_allowed("https://ArcSign.io"));
    }

    #[test]
    fn rejects_unknown_origin() {
        assert!(!is_origin_allowed("https://evil.example"));
    }

    #[test]
    fn mint_origin_allowed_in_all_builds() {
        assert!(is_origin_allowed("https://arcsign.io"));
    }

    #[test]
    fn tauri_webview_origins_allowed() {
        assert!(is_origin_allowed("tauri://localhost"));
        assert!(is_origin_allowed("https://tauri.localhost"));
    }

    #[test]
    fn other_website_origin_rejected() {
        assert!(!is_origin_allowed("https://evil.example"));
    }

    // Production: empty Origin (non-browser local process) rejected.
    #[cfg(not(feature = "dev-mode"))]
    #[test]
    fn empty_origin_rejected_in_production() {
        assert!(!is_origin_allowed(""));
    }

    // Production: localhost dev port rejected.
    #[cfg(not(feature = "dev-mode"))]
    #[test]
    fn localhost_dev_port_rejected_in_production() {
        assert!(!is_origin_allowed("http://localhost:5173"));
    }

    // Dev build: empty Origin (Hardhat) allowed.
    #[cfg(feature = "dev-mode")]
    #[test]
    fn empty_origin_allowed_in_dev() {
        assert!(is_origin_allowed(""));
    }

    // Dev build: localhost dev port (locally-served mint) allowed.
    #[cfg(feature = "dev-mode")]
    #[test]
    fn localhost_dev_port_allowed_in_dev() {
        assert!(is_origin_allowed("http://localhost:5173"));
    }
}

#[cfg(test)]
mod gate_tests {
    use super::{method_allowed_before_pairing, normalize_pairing_code};
    use crate::websocket::protocol::WsMethod;

    #[test]
    fn normalize_strips_display_dash() {
        // The user reads "1234-5678" off the desktop app and types it into the
        // mint page; it must normalize to the 8-digit stored secret.
        assert_eq!(normalize_pairing_code("1234-5678"), "12345678");
        assert_eq!(normalize_pairing_code("12345678"), "12345678");
        assert_eq!(normalize_pairing_code(" 1234 5678 "), "12345678");
    }

    #[test]
    fn normalized_dashed_code_verifies_against_secret() {
        // End-to-end of Issue 1: dashed display form must pair against the secret.
        use crate::websocket::pairing::{PairingState, VerifyResult};
        use std::time::Duration;
        let mut p = PairingState::new_with_code("12345678".into(), Duration::from_secs(60), 0);
        let submitted = normalize_pairing_code("1234-5678");
        assert!(matches!(p.verify(&submitted, 1_000), VerifyResult::Paired));
    }

    #[test]
    fn pairing_methods_allowed_before_pairing() {
        assert!(method_allowed_before_pairing(&WsMethod::Ping));
        assert!(method_allowed_before_pairing(&WsMethod::RequestPairing));
        assert!(method_allowed_before_pairing(&WsMethod::VerifyPairing));
    }

    #[test]
    fn account_and_sign_methods_blocked_before_pairing() {
        assert!(!method_allowed_before_pairing(&WsMethod::GetAccounts));
        assert!(!method_allowed_before_pairing(&WsMethod::SignTransaction));
    }
}
