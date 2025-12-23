/**
 * WebSocket Server Implementation
 *
 * Listens on 127.0.0.1:9527 for external wallet connections.
 * Only accepts connections from localhost for security.
 */

use super::handler::{handle_request, HandlerContext, PendingTxSender};
use super::protocol::{WsRequest, WsResponse};
use futures_util::{SinkExt, StreamExt};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, RwLock};
use tokio_tungstenite::{accept_async, tungstenite::Message};

/// WebSocket server port
const WS_PORT: u16 = 9527;

/// WebSocket server state
pub struct WebSocketServer {
    /// Currently connected addresses (from loaded wallet)
    accounts: Arc<RwLock<Vec<String>>>,
    /// Channel for pending transactions
    pending_tx_sender: PendingTxSender,
    /// Shutdown signal
    shutdown_tx: Option<mpsc::Sender<()>>,
}

impl WebSocketServer {
    /// Create a new WebSocket server
    pub fn new(pending_tx_sender: PendingTxSender) -> Self {
        Self {
            accounts: Arc::new(RwLock::new(Vec::new())),
            pending_tx_sender,
            shutdown_tx: None,
        }
    }

    /// Update the list of available BSC addresses
    pub async fn update_accounts(&self, accounts: Vec<String>) {
        let mut acc = self.accounts.write().await;
        *acc = accounts;
        tracing::info!("WebSocket server: updated {} BSC addresses", acc.len());
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
        let pending_tx_sender = self.pending_tx_sender.clone();

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
                                let pending_tx_sender = pending_tx_sender.clone();

                                tokio::spawn(async move {
                                    if let Err(e) = handle_connection(
                                        stream,
                                        peer_addr,
                                        accounts,
                                        pending_tx_sender,
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

/// Handle a single WebSocket connection
async fn handle_connection(
    stream: TcpStream,
    peer_addr: SocketAddr,
    accounts: Arc<RwLock<Vec<String>>>,
    pending_tx_sender: PendingTxSender,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let ws_stream = accept_async(stream).await?;
    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    tracing::info!("WebSocket connection established with {}", peer_addr);

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

                // Get current accounts
                let acc = accounts.read().await.clone();

                // Create handler context
                let context = HandlerContext::new(pending_tx_sender.clone(), acc);

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
