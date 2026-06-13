#!/usr/bin/env bash
# test/golden/gates.sh — Final quality gates for graphviz-ts
# Run from the repository root: bash test/golden/gates.sh
set -euo pipefail

GATE_PASS=0
GATE_FAIL=0

gate_pass() {
  echo "PASS [$1]"
  GATE_PASS=$((GATE_PASS + 1))
}

gate_fail() {
  echo "FAIL [$1]: $2"
  GATE_FAIL=$((GATE_FAIL + 1))
  exit 1
}

# --- Gate 1: TypeScript type check ---
echo ""
echo "=== Gate 1: TypeScript type check ==="
npx tsc --noEmit && gate_pass "Gate 1" || gate_fail "Gate 1" "tsc --noEmit failed"

# --- Gate 2: Vitest test suite ---
echo ""
echo "=== Gate 2: Vitest test suite ==="
npx vitest run && gate_pass "Gate 2" || gate_fail "Gate 2" "vitest run failed"

# --- Gate 3: Golden-file tests (50/50) ---
echo ""
echo "=== Gate 3: Golden-file tests ==="
output=$(bash test/golden/run.sh test/golden/manifest.json 2>&1)
echo "$output"
echo "$output" | grep -q "50 passed, 0 failed" \
  && gate_pass "Gate 3" \
  || gate_fail "Gate 3" "golden-file tests did not pass 50/50"

# --- Gate 4: No file over 600 lines ---
echo ""
echo "=== Gate 4: File length (max 600 lines) ==="
violations=$(find src -name '*.ts' \
  | xargs wc -l 2>/dev/null \
  | awk '$1 > 600 && $2 != "total" { print $2 ": " $1 " lines" }')
if [ -n "$violations" ]; then
  echo "Files over 600 lines:"
  echo "$violations"
  gate_fail "Gate 4" "files exceed line limit"
fi
gate_pass "Gate 4"

# --- Gate 5: Bundle size < 500 KB gzipped ---
echo ""
echo "=== Gate 5: Bundle size ==="
npx esbuild src/index.ts \
  --bundle --minify --platform=node \
  --outfile=dist/bundle.js --format=cjs \
  --log-level=warning

bundle_gz=$(gzip -c dist/bundle.js | wc -c)
limit=$((500 * 1024))
echo "Bundle size (gzipped): ${bundle_gz} bytes (limit: ${limit} bytes)"
[ "$bundle_gz" -lt "$limit" ] \
  && gate_pass "Gate 5" \
  || gate_fail "Gate 5" "bundle ${bundle_gz} bytes >= limit ${limit} bytes"

# --- Summary ---
echo ""
echo "================================"
echo "Quality gates: ${GATE_PASS} passed, ${GATE_FAIL} failed"
echo "================================"
