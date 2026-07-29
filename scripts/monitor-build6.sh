#!/usr/bin/env bash
# Poll build #6 every 30s, capture logs the moment it errors
set -e
export EXPO_TOKEN="3UwNBbRzzSvkBduCXuowN699kuBocq-f8WyqHzpq"
BUILD_ID="fdb4928f-611e-43cc-bee1-2a5c8ffebdc1"
LOG_DIR="/tmp/eas-build6"
mkdir -p "$LOG_DIR"
cd /home/z/my-project/verda-erp/app

START=$(date +%s)
for i in $(seq 1 120); do  # max 60 min
  sleep 30
  ELAPSED=$(( ($(date +%s) - START) / 60 ))
  STATUS_LINE=$(timeout 25 eas build:view "$BUILD_ID" 2>&1 | grep -E "^Status" | head -1)
  STATUS=$(echo "$STATUS_LINE" | sed 's/Status\s*//; s/ //g')
  echo "[$(date +%H:%M:%S) | ${ELAPSED}m] Poll $i: $STATUS"
  
  if [[ "$STATUS" =~ [Ee]rrored ]]; then
    echo ""
    echo "=== ⚠️ BUILD ERRORED — fetching logs NOW (URL valid 15 min) ==="
    timeout 60 eas build:view "$BUILD_ID" --json > "$LOG_DIR/build.json" 2>/dev/null
    python3 << 'PYEOF'
import json, subprocess, os
log_dir = "/tmp/eas-build6"
with open(f"{log_dir}/build.json") as f: d = json.load(f)
err = d.get('error', {})
print(f'Error code: {err.get("errorCode")}')
print(f'Message: {err.get("message")}')
logs = d.get('logFiles', [])
print(f'Log files: {len(logs)}')
for i, url in enumerate(logs):
    print(f'\nDownloading log {i}...')
    subprocess.run(['curl', '-sL', url, '-o', f'{log_dir}/raw_{i}.bin'])
    ftype = subprocess.run(['file', f'{log_dir}/raw_{i}.bin'], capture_output=True, text=True).stdout
    print(f'  Type: {ftype.strip()[:80]}')
    if 'gzip' in ftype:
        os.system(f'gunzip -c {log_dir}/raw_{i}.bin > {log_dir}/log_{i}.txt 2>/dev/null')
    else:
        os.system(f'cp {log_dir}/raw_{i}.bin {log_dir}/log_{i}.txt')
    print(f'  Size: {os.path.getsize(f"{log_dir}/log_{i}.txt")} bytes')
PYEOF
    echo ""
    echo "=== EXTRACTING GRADLE ERROR ==="
    for f in "$LOG_DIR"/log_*.txt; do
        echo ""
        echo "=================== $f (errors + last 60 lines) ==================="
        grep -inE "(FAILURE:|> Task.*FAILED|What went wrong|Caused by|Execution failed|Could not|Exception)" "$f" 2>/dev/null | head -30
        echo ""
        echo "--- Last 60 lines: ---"
        tail -60 "$f" 2>/dev/null
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
done

echo "=== Still in progress after 60 min — check dashboard ==="
