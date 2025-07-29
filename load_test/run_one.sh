#!/bin/bash

# Script to select an app from apps.json and run run-ppa-test.sh

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

APPS=($(jq -r 'keys[]' "$APPS_JSON"))

echo "Select an app to test:"
if [[ -z "$1" ]]; then
  echo "❗ Please provide the app name as an argument."
  echo "Available apps: ${APPS[*]}"
  exit 1
fi

APP="$1"
if [[ ! " ${APPS[@]} " =~ " $APP " ]]; then
  echo "❗ Invalid app name: $APP"
  echo "Available apps: ${APPS[*]}"
  exit 1
fi

ENDPOINT=$(jq -r --arg app "$APP" '.[$app]' "$APPS_JSON")
echo "▶️ Running test for $APP ($ENDPOINT)"
bash "$SCRIPT" "$APP" "$ENDPOINT"