#!/bin/bash

# Log viewer utility
# Shows recent logs and allows filtering

LOG_DIR="$HOME/Library/Logs/ArcSign"

if [ ! -d "$LOG_DIR" ]; then
    echo "No logs directory found at $LOG_DIR"
    exit 1
fi

echo "=== ArcSign Development Logs ==="
echo "Log directory: $LOG_DIR"
echo ""

# List available log files
echo "Available log files:"
ls -lht "$LOG_DIR"/*.log 2>/dev/null | head -10

echo ""
echo "=== Latest Combined Log ==="
LATEST_LOG=$(ls -t "$LOG_DIR"/combined-*.log 2>/dev/null | head -1)

if [ -z "$LATEST_LOG" ]; then
    echo "No combined log files found"
    exit 1
fi

echo "File: $LATEST_LOG"
echo "Size: $(du -h "$LATEST_LOG" | cut -f1)"
echo ""

# Show options
echo "Options:"
echo "  1. View full log"
echo "  2. View last 50 lines"
echo "  3. View last 100 lines"
echo "  4. Search for errors"
echo "  5. Search for 'is_first_time_setup'"
echo "  6. Search for 'unlock'"
echo "  7. Follow live (tail -f)"
echo "  8. Open in editor"
echo ""
read -p "Choose option (1-8): " choice

case $choice in
    1)
        less "$LATEST_LOG"
        ;;
    2)
        tail -50 "$LATEST_LOG"
        ;;
    3)
        tail -100 "$LATEST_LOG"
        ;;
    4)
        grep -i "error\|failed\|panic" "$LATEST_LOG" || echo "No errors found"
        ;;
    5)
        grep -i "is_first_time_setup" "$LATEST_LOG" || echo "Not found"
        ;;
    6)
        grep -i "unlock" "$LATEST_LOG" || echo "Not found"
        ;;
    7)
        tail -f "$LATEST_LOG"
        ;;
    8)
        open "$LATEST_LOG"
        ;;
    *)
        echo "Invalid option"
        ;;
esac
