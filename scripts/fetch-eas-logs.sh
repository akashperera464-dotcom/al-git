#!/usr/bin/env bash
# Fetch fresh EAS build logs and extract the actual Gradle error
set -euo pipefail
BUILD_ID="8d419657-eae0-4c84-994b-953c243cdb82"
PROJECT_DIR="/home/z/my-project/verda-erp/app"
LOG_DIR="/tmp/eas-logs"
mkdir -p "$LOG_DIR"

cd "$PROJECT_DIR"

echo "=== Fetching fresh build metadata (gives new signed URL)... ==="
npx eas-cli@latest build:view "$BUILD_ID" --json > "$LOG_DIR/build.json" 2>/dev/null

# Extract log URLs (there can be multiple)
echo ""
echo "=== Log file URLs found: ==="
python3 -c "
import json
with open('$LOG_DIR/build.json') as f:
    data = json.load(f)
logs = data.get('logFiles', [])
for i, url in enumerate(logs):
    print(f'Log {i}: {url[:120]}...')
    with open('$LOG_DIR/url_{i}.txt', 'w') as u:
        u.write(url)
"

echo ""
echo "=== Downloading each log file ==="
for url_file in "$LOG_DIR"/url_*.txt; do
    idx=$(basename "$url_file" .txt | sed 's/url_//')
    url=$(cat "$url_file")
    echo "--- Downloading log $idx ---"
    curl -sL "$url" -o "$LOG_DIR/raw_$idx.bin"
    file "$LOG_DIR/raw_$idx.bin"
    
    # Try multiple decompression methods
    if file "$LOG_DIR/raw_$idx.bin" | grep -q "gzip"; then
        gunzip -c "$LOG_DIR/raw_$idx.bin" > "$LOG_DIR/log_$idx.txt" 2>/dev/null || true
    elif file "$LOG_DIR/raw_$idx.bin" | grep -q "XML\|HTML"; then
        # Might be an error response
        cp "$LOG_DIR/raw_$idx.bin" "$LOG_DIR/log_$idx.txt"
    else
        cp "$LOG_DIR/raw_$idx.bin" "$LOG_DIR/log_$idx.txt"
    fi
    echo "  Size: $(wc -c < "$LOG_DIR/log_$idx.txt") bytes"
done

echo ""
echo "=== Combined log search for errors ==="
for log_file in "$LOG_DIR"/log_*.txt; do
    echo ""
    echo "=========================================="
    echo "=== Errors in $log_file ==="
    echo "=========================================="
    grep -iE "(error|fail|exception|fatal|caused by)" "$log_file" | head -50 || echo "(no matches)"
done
