#!/bin/bash
# Watch Go debug logs
mkdir -p /Volumes/arcsign/logs
touch /Volumes/arcsign/logs/go_debug.log
echo "Watching Go debug logs at /Volumes/arcsign/logs/go_debug.log"
echo "Waiting for logs..."
echo ""
tail -f /Volumes/arcsign/logs/go_debug.log
