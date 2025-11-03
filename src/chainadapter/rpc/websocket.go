// Package rpc - WebSocket JSON-RPC client implementation
package rpc

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

// WebSocketRPCClient implements RPCClient using WebSocket transport with automatic reconnection.
type WebSocketRPCClient struct {
	url           string
	conn          *websocket.Conn
	connMu        sync.RWMutex
	requestID     atomic.Int64
	pendingCalls  map[int64]chan *RPCResponse
	pendingMu     sync.RWMutex
	subscriptions map[string]chan json.RawMessage
	subsMu        sync.RWMutex
	reconnecting  atomic.Bool
	closed        atomic.Bool
	closeChan     chan struct{}

	// Reconnection settings
	maxReconnectInterval time.Duration
	reconnectBackoff     time.Duration
}

// NewWebSocketRPCClient creates a new WebSocket RPC client with auto-reconnection.
//
// Parameters:
// - url: WebSocket endpoint (e.g., "wss://mainnet.infura.io/ws/v3/YOUR-PROJECT-ID")
func NewWebSocketRPCClient(url string) (*WebSocketRPCClient, error) {
	client := &WebSocketRPCClient{
		url:                  url,
		pendingCalls:         make(map[int64]chan *RPCResponse),
		subscriptions:        make(map[string]chan json.RawMessage),
		closeChan:            make(chan struct{}),
		maxReconnectInterval: 60 * time.Second,
		reconnectBackoff:     1 * time.Second,
	}

	// Initial connection
	if err := client.connect(); err != nil {
		return nil, fmt.Errorf("failed to connect to WebSocket: %w", err)
	}

	// Start read loop
	go client.readLoop()

	return client, nil
}

// Call executes a single JSON-RPC method call via WebSocket.
func (c *WebSocketRPCClient) Call(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	if c.closed.Load() {
		return nil, fmt.Errorf("WebSocket client is closed")
	}

	reqID := c.requestID.Add(1)

	// Create response channel
	respChan := make(chan *RPCResponse, 1)
	c.pendingMu.Lock()
	c.pendingCalls[reqID] = respChan
	c.pendingMu.Unlock()

	defer func() {
		c.pendingMu.Lock()
		delete(c.pendingCalls, reqID)
		c.pendingMu.Unlock()
	}()

	// Build JSON-RPC request
	rpcReq := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      reqID,
		"method":  method,
		"params":  params,
	}

	// Send request
	c.connMu.RLock()
	conn := c.conn
	c.connMu.RUnlock()

	if conn == nil {
		return nil, fmt.Errorf("WebSocket not connected")
	}

	if err := conn.WriteJSON(rpcReq); err != nil {
		// Trigger reconnection
		go c.reconnect()
		return nil, fmt.Errorf("failed to send WebSocket request: %w", err)
	}

	// Wait for response or timeout
	select {
	case resp := <-respChan:
		if resp.Error != nil {
			return nil, fmt.Errorf("JSON-RPC error: %s", resp.Error.Message)
		}
		return resp.Result, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-c.closeChan:
		return nil, fmt.Errorf("WebSocket client closed")
	}
}

// CallBatch is not supported for WebSocket (WebSocket doesn't have true batch support).
func (c *WebSocketRPCClient) CallBatch(ctx context.Context, requests []RPCRequest) ([]json.RawMessage, error) {
	return nil, fmt.Errorf("batch calls not supported for WebSocket RPC")
}

// Subscribe subscribes to a WebSocket event stream.
//
// Parameters:
// - ctx: Context for cancellation
// - method: Subscription method (e.g., "eth_subscribe")
// - params: Subscription parameters
//
// Returns:
// - Channel receiving subscription notifications
// - Error if subscription fails
func (c *WebSocketRPCClient) Subscribe(ctx context.Context, method string, params interface{}) (<-chan json.RawMessage, error) {
	// Call subscription method
	result, err := c.Call(ctx, method, params)
	if err != nil {
		return nil, fmt.Errorf("subscription failed: %w", err)
	}

	// Extract subscription ID
	var subID string
	if err := json.Unmarshal(result, &subID); err != nil {
		return nil, fmt.Errorf("failed to parse subscription ID: %w", err)
	}

	// Create notification channel
	notifChan := make(chan json.RawMessage, 100)

	c.subsMu.Lock()
	c.subscriptions[subID] = notifChan
	c.subsMu.Unlock()

	return notifChan, nil
}

// Close closes the WebSocket connection.
func (c *WebSocketRPCClient) Close() error {
	if c.closed.Swap(true) {
		return nil // Already closed
	}

	close(c.closeChan)

	c.connMu.Lock()
	defer c.connMu.Unlock()

	if c.conn != nil {
		return c.conn.Close()
	}

	return nil
}

// connect establishes WebSocket connection.
func (c *WebSocketRPCClient) connect() error {
	conn, _, err := websocket.DefaultDialer.Dial(c.url, nil)
	if err != nil {
		return err
	}

	c.connMu.Lock()
	c.conn = conn
	c.connMu.Unlock()

	return nil
}

// reconnect attempts to reconnect with exponential backoff.
func (c *WebSocketRPCClient) reconnect() {
	if !c.reconnecting.CompareAndSwap(false, true) {
		return // Already reconnecting
	}
	defer c.reconnecting.Store(false)

	backoff := c.reconnectBackoff

	for {
		select {
		case <-c.closeChan:
			return
		case <-time.After(backoff):
			if err := c.connect(); err != nil {
				// Increase backoff (exponential)
				backoff *= 2
				if backoff > c.maxReconnectInterval {
					backoff = c.maxReconnectInterval
				}
				continue
			}

			// Reconnected successfully, restart read loop
			go c.readLoop()
			return
		}
	}
}

// readLoop continuously reads messages from WebSocket.
func (c *WebSocketRPCClient) readLoop() {
	c.connMu.RLock()
	conn := c.conn
	c.connMu.RUnlock()

	if conn == nil {
		return
	}

	for {
		select {
		case <-c.closeChan:
			return
		default:
			var msg json.RawMessage
			if err := conn.ReadJSON(&msg); err != nil {
				// Connection error, trigger reconnection
				go c.reconnect()
				return
			}

			// Parse message to determine type (response or notification)
			var partial struct {
				ID     *int64          `json:"id"`
				Method string          `json:"method"`
				Params json.RawMessage `json:"params"`
			}

			if err := json.Unmarshal(msg, &partial); err != nil {
				continue
			}

			if partial.ID != nil {
				// JSON-RPC response
				var resp RPCResponse
				if err := json.Unmarshal(msg, &resp); err != nil {
					continue
				}

				c.pendingMu.RLock()
				respChan, exists := c.pendingCalls[*partial.ID]
				c.pendingMu.RUnlock()

				if exists {
					respChan <- &resp
				}
			} else if partial.Method != "" {
				// Subscription notification
				var notification struct {
					Params struct {
						Subscription string          `json:"subscription"`
						Result       json.RawMessage `json:"result"`
					} `json:"params"`
				}

				if err := json.Unmarshal(msg, &notification); err != nil {
					continue
				}

				c.subsMu.RLock()
				notifChan, exists := c.subscriptions[notification.Params.Subscription]
				c.subsMu.RUnlock()

				if exists {
					select {
					case notifChan <- notification.Params.Result:
					default:
						// Channel full, drop notification
					}
				}
			}
		}
	}
}
