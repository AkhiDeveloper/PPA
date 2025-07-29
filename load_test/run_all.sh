#!/bin/bash

# This script runs run-ppa-test.sh for each app in apps.json

if ! command -v jq &> /dev/null; then
  echo "❗ 'jq' is required but not installed."
  exit 1
fi

APPS_JSON="apps.json"
SCRIPT="run-ppa-test.sh"

if [[ ! -f "$APPS_JSON" ]]; then
  echo "❗ $APPS_JSON not found!"
  exit 1
fi

for APP in $(jq -r 'keys[]' "$APPS_JSON"); do
  ENDPOINT=$(jq -r --arg app "$APP" '.[$app]' "$APPS_JSON")
  echo "=============================="
  echo "▶️ Running test for $APP ($ENDPOINT)"
  bash "$SCRIPT" "$APP" "$ENDPOINT"
  echo "==============================