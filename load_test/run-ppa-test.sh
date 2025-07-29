#!/bin/bash

# ✅ USAGE:
# ./run-ppa-test.sh <app_name> <endpoint_url>
# Example:
# ./run-ppa-test.sh ppa-dotnet http://localhost:5000/api/mixed-tasks

APP_NAME=$1
ENDPOINT=$2

if [[ -z "$APP_NAME" || -z "$ENDPOINT" ]]; then
  echo "❗ Usage: ./run-ppa-test.sh <app_name> <endpoint_url>"
  exit 1
fi

# Config
MAX_VUS=1000000
START_VUS=10
TEST_DURATION="10s"

# Timestamped result folder
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULT_DIR="results/${APP_NAME}/${TIMESTAMP}"
mkdir -p "$RESULT_DIR"

echo "🚀 Starting adaptive load test for [$APP_NAME]"
echo "📍 Endpoint: $ENDPOINT"
echo "📂 Results will be saved in: $RESULT_DIR"

# Create temp K6 script
K6_SCRIPT=$(mktemp)

cat <<EOF > "$K6_SCRIPT"
import http from 'k6/http';
import { check, sleep } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

let endpoint = '${ENDPOINT}';

export let options = {
  vus: __ENV.VUS,
  duration: '${TEST_DURATION}',
  thresholds: {
    http_req_duration: ['p(95)<15000'],
    http_req_failed: ['rate<0.01'],
  },
};

let allResults = [];

export default function () {
  const res = http.get(endpoint);
  const passed = check(res, {
    'status is 200': (r) => r.status === 200,
    'has CpuResults': (r) => r.body.includes("CpuResults"),
  });

  allResults.push({
    timestamp: new Date().toISOString(),
    vus: __VU,
    status: res.status,
    duration: res.timings.duration,
    success: passed,
  });

  sleep(1);
}

export function handleSummary(data) {
  let file = '${RESULT_DIR}/vus-' + __ENV.VUS + '.json';
  return {
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
    [file]: JSON.stringify({ summary: data, details: allResults }, null, 2),
  };
}
EOF

# Load test loop
VUS=$START_VUS
while [ $VUS -le $MAX_VUS ]
do
  echo "➡️ Running with $VUS VUs..."

  k6 run --env VUS=$VUS "$K6_SCRIPT"

  if [ $? -ne 0 ]; then
    echo "❌ Load test aborted due to error or threshold breach."
    break
  fi

  VUS=$((VUS * 10))
done

rm "$K6_SCRIPT"

echo "✅ Test complete. Results in: $RESULT_DIR"
