/**
 * WebSocket Server Implementation
 *
 * Listens on 127.0.0.1:9527 for external wallet connections.
 * Only accepts connections from localhost for security.
 */

use super::handler::{handle_request, HandlerContext, PendingTxSender, PendingMsgSender};
use super::protocol::{WsMethod, WsRequest, WsResponse, DevSession};
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
    /// FFI wallet queue for session-based signing
    wallet_queue: Option<LazyWalletQueue>,
    /// Developer session state (shared across connections)
    dev_session: Arc<RwLock<Option<DevSession>>>,
    /// Shutdown signal
    shutdown_tx: Option<mpsc::Sender<()>>,
}

impl WebSocketServer {
    /// Create a new WebSocket server
    pub fn new(pending_tx_sender: PendingTxSender, pending_msg_sender: PendingMsgSender) -> Self {
        Self {
            accounts: Arc::new(RwLock::new(Vec::new())),
            usb_path: Arc::new(RwLock::new(None)),
            pending_tx_sender,
            pending_msg_sender,
            wallet_queue: None,
            dev_session: Arc::new(RwLock::new(None)),
            shutdown_tx: None,
        }
    }

    /// Create a new WebSocket server with FFI wallet queue for auto-signing
    pub fn with_wallet_queue(
        pending_tx_sender: PendingTxSender,
        pending_msg_sender: PendingMsgSender,
        wallet_queue: LazyWalletQueue,
    ) -> Self {
        Self {
            accounts: Arc::new(RwLock::new(Vec::new())),
            usb_path: Arc::new(RwLock::new(None)),
            pending_tx_sender,
            pending_msg_sender,
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
    if ALLOWED_ORIGINS.contains(&origin) {
        return true;
    }
    #[cfg(feature = "dev-mode")]
    {
        if origin.is_empty() || origin.starts_with("http://localhost:") {
            return true;
        }
    }
    false
}

/// Handle a single WebSocket connection
async fn handle_connection(
    stream: TcpStream,
    peer_addr: SocketAddr,
    accounts: Arc<RwLock<Vec<String>>>,
    usb_path: Arc<RwLock<Option<String>>>,
    pending_tx_sender: PendingTxSender,
    pending_msg_sender: PendingMsgSender,
    wallet_queue: Option<LazyWalletQueue>,
    dev_session: Arc<RwLock<Option<DevSession>>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let ws_stream = accept_hdr_async(stream, |req: &Request, response: Response| {
        let origin = req
            .headers()
            .get("Origin")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

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

    tracing::info!("WebSocket connection established with {}", peer_addr);

    // Authentication: unauthenticated connections can only use read-only methods.
    // Clients must send a Ping request first to establish the session before
    // using write methods (sign, broadcast, etc.). This prevents arbitrary
    // local processes from immediately invoking signing operations.
    let mut authenticated = false;

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

                // Read-only methods are always allowed
                let is_read_only = matches!(
                    request.method,
                    WsMethod::GetAccounts | WsMethod::Ping | WsMethod::GetBalance
                );

                // Ping also serves as the authentication handshake
                if request.method == WsMethod::Ping && !authenticated {
                    authenticated = true;
                    tracing::info!("WebSocket client {} authenticated via Ping", peer_addr);
                }

                if !authenticated && !is_read_only {
                    tracing::warn!(
                        "WebSocket client {} attempted {:?} without authentication",
                        peer_addr,
                        request.method
                    );
                    let error_response = WsResponse::error(
                        request.id,
                        "Authentication required. Send a Ping request first.".to_string(),
                    );
                    let response_text = serde_json::to_string(&error_response)?;
                    ws_sender.send(Message::Text(response_text)).await?;
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
