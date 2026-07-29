#!/usr/bin/env bash
# EAS preBuildHook: ensure google-services.json is in place before expo prebuild.
#
# The file may come from one of:
#   1. Git-tracked ./google-services.json (preferred when committed)
#   2. EAS env var GOOGLE_SERVICES_JSON (file-type env var, set via `eas env:set`)
#   3. EAS env var GOOGLE_SERVICES_JSON_BASE64 (base64-encoded fallback)
#
# This script guarantees the file exists at ./google-services.json so the
# expo-notifications plugin + Gradle google-services plugin can find it.
set -euo pipefail

TARGET="./google-services.json"

if [ -f "$TARGET" ]; then
  echo "[eas-prebuild] $TARGET already exists ($(wc -c < "$TARGET") bytes), skipping."
  exit 0
fi

echo "[eas-prebuild] $TARGET missing — restoring from EAS env var..."

if [ -n "${GOOGLE_SERVICES_JSON:-}" ] && [ -f "$GOOGLE_SERVICES_JSON" ]; then
  cp "$GOOGLE_SERVICES_JSON" "$TARGET"
  echo "[eas-prebuild] Restored from GOOGLE_SERVICES_JSON env var ($(wc -c < "$TARGET") bytes)."
  exit 0
fi

if [ -n "${GOOGLE_SERVICES_JSON_BASE64:-}" ]; then
  echo "$GOOGLE_SERVICES_JSON_BASE64" | base64 -d > "$TARGET"
  echo "[eas-prebuild] Restored from GOOGLE_SERVICES_JSON_BASE64 env var ($(wc -c < "$TARGET") bytes)."
  exit 0
fi

echo "[eas-prebuild] ERROR: No source for google-services.json found."
echo "[eas-prebuild] Either commit the file to git, or set one of:"
echo "[eas-prebuild]   - GOOGLE_SERVICES_JSON (file-type EAS env var)"
echo "[eas-prebuild]   - GOOGLE_SERVICES_JSON_BASE64 (string-type EAS env var)"
exit 1
