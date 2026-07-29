#!/usr/bin/env bash
# Fast poll build #5 status
set -e
export EXPO_TOKEN="3UwNBbRzzSvkBduCXuowN699kuBocq-f8WyqHzpq"
BUILD_ID="63992e9b-bd89-4f71-b315-af42167b7eb0"
LOG_DIR="/tmp/eas-build5"
mkdir -p "$LOG_DIR"
cd /home/z/my-project/verda-erp/app

# Poll every 20 seconds, up to 30 minutes (90 polls)
for i in $(seq 1 90); do
  STATUS_LINE=$(timeout 25 eas build:view "$BUILD_ID" 2>&1 | grep -E "^Status" | head -1)
  STATUS=$(echo "$STATUS_LINE" | sed 's/Status\s*//; s/ //g')
  echo "[$(date +%H:%M:%S)] Poll $i/90: $STATUS"
  
  if [[ "$STATUS" =~ [Ee]rrored ]]; then
    echo ""
    echo "=== ⚠️ BUILD ERRORED — fetching logs NOW ==="
    # Get JSON
    timeout 60 eas build:view "$BUILD_ID" --json > "$LOG_DIR/build.json" 2>/dev/null
    # Show error code + message
    python3 -c "
import json
with open('$LOG_DIR/build.json') as f: d = json.load(f)
err = d.get('error', {})
print(f'Error code: {err.get(\"errorCode\")}')
print(f'Message: {err.get(\"message\")}')
print(f'Log files: {len(d.get(\"logFiles\", []))}')
"
    # Download each log
    python3 << 'PYEOF'
import json, subprocess, os
log_dir = "/tmp/eas-build5"
with open(f"{log_dir}/build.json") as f: d = json.load(f)
for i, url in enumerate(d.get('logFiles', [])):
    print(f"Downloading log {i}: {url[:80]}...")
    subprocess.run(['curl', '-sL', url, '-o', f'{log_dir}/raw_{i}.bin'])
    ftype = subprocess.run(['file', f'{log_dir}/raw_{i}.bin'], capture_output=True, text=True).stdout
    print(f"  File type: {ftype.strip()[:80]}")
    if 'gzip' in ftype:
        os.system(f'gunzip -c {log_dir}/raw_{i}.bin > {log_dir}/log_{i}.txt 2>/dev/null')
    else:
        os.system(f'cp {log_dir}/raw_{i}.bin {log_dir}/log_{i}.txt')
    print(f"  Size: {os.path.getsize(f'{log_dir}/log_{i}.txt')} bytes")
PYEOF
    echo ""
    echo "=== EXTRACTING GRADLE ERROR ==="
    for f in "$LOG_DIR"/log_*.txt; do
        echo ""
        echo "=================== $f ==================="
        # Search for the actual error - 5 patterns to catch most cases
        echo "--- Error patterns: ---"
        grep -inE "(FAILURE:|> Task.*FAILED|What went wrong|Caused by|Execution failed|Could not|Exception in thread|^[0-9]+ error)" "$f" 2>/dev/null | head -40
        echo ""
        echo "--- Last 80 lines: ---"
        tail -80 "$f" 2>/dev/null
    done
    exit 0
  fi
  
  if [[ "$STATUS" =~ [Ff]inished ]]; then
    echo ""
    echo "=== ✅ BUILD SUCCEEDED! ==="
    timeout 60 eas build:view "$BUILD_ID" --json > "$LOG_DIR/build.json" 2>/dev/null
    python3 -c "
import json
with open('$LOG_DIR/build.json') as f: d = json.load(f)
print('App URL:', d.get('applicationArchiveUrl'))
print('Artifacts:', d.get('artifacts'))
"
    exit 0
  fi
  
  sleep 20
done

echo "=== Still in progress after 30 min — check dashboard ==="
