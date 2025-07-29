#!/bin/bash

# K6 Load Test Runner

CONCURRENCY=10

if ! command -v jq &> /dev/null; then
    echo "❗ 'jq' is required but not installed."
    exit 1
fi

APPS_JSON="apps.json"

if [[ ! -f "$APPS_JSON" ]]; then
    echo "❗ $APPS_JSON not found!"
    exit 1
fi

for APP in $(jq -r 'keys[]' "$APPS_JSON"); do
    ENDPOINT=$(jq -r --arg app "$APP" '.[$app]' "$APPS_JSON")
    # Run each test in a new xterm window
    xterm -hold -e "k6 run --env CONCURRENCY=$CONCURRENCY --env ENDPOINT=\"$ENDPOINT\" ppa-loadtest.js" &
done

wait