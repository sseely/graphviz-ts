#!/usr/bin/env bash
# test/golden/run.sh — drive golden-file comparison using the TS port CLI
set -euo pipefail

# require jq
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required but not found on PATH" >&2
  exit 2
fi

MANIFEST="${1:-test/golden/manifest.json}"
PASS=0; FAIL=0

while IFS= read -r entry; do
  input=$(echo "$entry" | jq -r '.input')
  ref=$(echo "$entry" | jq -r '.reference')
  engine=$(echo "$entry" | jq -r '.engine')
  tol=$(echo "$entry" | jq -r '.toleranceClass')

  actual=$(mktemp /tmp/graphviz-ts-XXXXXX.svg)
  node dist/cli.js -K "$engine" -Tsvg "$input" > "$actual"

  if node dist/test/golden/compare.js "$actual" "$ref" "$tol"; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $input ($engine)"
  fi
  rm -f "$actual"
done < <(jq -c '.[]' "$MANIFEST")

echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
