#!/bin/bash

# Development script with logging
# Captures both frontend and backend logs for debugging

set -e

# Create logs directory
LOG_DIR="$HOME/Library/Logs/ArcSign"
mkdir -p "$LOG_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Log files
FRONTEND_LOG="$LOG_DIR/frontend-$TIMESTAMP.log"
BACKEND_LOG="$LOG_DIR/backend-$TIMESTAMP.log"
COMBINED_LOG="$LOG_DIR/combined-$TIMESTAMP.log"

echo "=== ArcSign Development Mode with Logging ==="
echo "Frontend log: $FRONTEND_LOG"
echo "Backend log:  $BACKEND_LOG"
echo "Combined log: $COMBINED_LOG"
echo ""

# Navigate to dashboard directory
cd "$(dirname "$0")/dashboard"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "=== Stopping development servers ==="
    # Kill all child processes
    pkill -P $$ || true
    exit 0
}

trap cleanup INT TERM

# Start Tauri dev with logging
echo "Starting Tauri development server..."
npm run tauri dev 2>&1 | tee -a "$BACKEND_LOG" "$COMBINED_LOG" &

# Wait for servers to start
echo "Waiting for servers to initialize..."
sleep 3

# Monitor logs in real-time
echo ""
echo "=== Monitoring logs (Ctrl+C to stop) ==="
tail -f "$COMBINED_LOG"
