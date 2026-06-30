/**
 * WebSocket Server Module
 *
 * Provides WebSocket server for external wallet connections (e.g., mint-page).
 * Only listens on 127.0.0.1:9527 for security (localhost only).
 *
 * Protocol:
 * - JSON-RPC style messages
 * - Methods: get_accounts, sign_transaction, sign_and_broadcast
 */

mod server;
mod handler;
#[allow(dead_code)] // wired into server.rs in Task 9
mod pairing;
pub mod protocol;

#[allow(unused_imports)] // wired in Task 9
pub(crate) use pairing::{PairingState, VerifyResult};

pub use server::WebSocketServer;
pub use handler::{PendingTxSender, PendingTxReceiver, PendingMsgSender, PendingMsgReceiver};
pub use protocol::{
    WsRequest, WsResponse, WsMethod, PendingTransaction,
    TransactionResult, PendingTransactionWithChannel,
    // Message signing types
    PendingMessageSign, PendingMessageSignWithChannel, MessageSignResult, MessageSignType,
    // Developer mode types
    DevSession,
};
