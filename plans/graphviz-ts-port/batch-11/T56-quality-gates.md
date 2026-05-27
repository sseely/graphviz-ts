# T56 — Final Quality Gates

## Context

Stack: TypeScript 5.x strict, Vitest, esbuild, EPL-2.0.

This task writes `test/golden/gates.sh`, the final quality gate script
run after all 11 batches complete. It validates five project-wide
invariants: type coverage, test suite, golden-file pass rate, file
length ceiling, and bundle size budget.

Depends on T55 (the golden-file suite must pass before the gates script
is written to ensure the gates will succeed on a clean checkout).

## Task

Write `test/golden/gates.sh` as an executable shell script. The script:
- Runs all five gates in sequence
- Reports pass/fail for each gate with a clear name
- Exits non-zero immediately on the first failure
- Prints a final summary when all gates pass

### Gate 1 — TypeScript type check

```bash
echo "[Gate 1] tsc --noEmit"
npx tsc --noEmit
```

Pass: exit code 0.
Fail: any exit code other than 0. Print the tsc error output.

### Gate 2 — Unit and integration test suite

```bash
echo "[Gate 2] vitest run"
npx vitest run
```

Pass: exit code 0.
Fail: any exit code other than 0. Print test failure summary.

### Gate 3 — Golden-file comparison (50/50)

```bash
echo "[Gate 3] golden-file tests (50/50)"
bash test/golden/run.sh test/golden/manifest.json
```

Pass: exit code 0 and script output contains `50 passed, 0 failed`.
Fail: exit code 1 from `run.sh`, or output does not contain `50 passed`.

Implementation: capture run.sh output, grep for `50 passed, 0 failed`:
```bash
output=$(bash test/golden/run.sh test/golden/manifest.json 2>&1)
echo "$output"
if ! echo "$output" | grep -q "50 passed, 0 failed"; then
  echo "FAIL [Gate 3]: golden-file tests did not pass 50/50"
  exit 1
fi
echo "PASS [Gate 3]"
```

### Gate 4 — No file over 600 lines

```bash
echo "[Gate 4] file length check (max 600 lines)"
```

Check all `.ts` files under `src/`:
```bash
violations=$(find src -name '*.ts' | xargs wc -l 2>/dev/null \
  | awk '$1 > 600 && $2 != "total" { print $2 ": " $1 " lines" }')

if [ -n "$violations" ]; then
  echo "FAIL [Gate 4]: files over 600 lines:"
  echo "$violations"
  exit 1
fi
echo "PASS [Gate 4]"
```

Pass: no `.ts` file in `src/` exceeds 600 lines.
Fail: one or more files exceed 600 lines. Print the offending filenames
and line counts.

Do NOT apply this check to `test/` files — only `src/`.

### Gate 5 — Bundle size check (< 500 KB gzipped)

Build the bundle with esbuild then check gzip size:
```bash
echo "[Gate 5] bundle size (< 500 KB gzipped)"

npx esbuild src/index.ts \
  --bundle \
  --minify \
  --platform=node \
  --outfile=dist/bundle.js \
  --format=cjs

bundle_gz=$(gzip -c dist/bundle.js | wc -c)
limit=$((500 * 1024))

echo "Bundle size (gzipped): ${bundle_gz} bytes (limit: ${limit} bytes)"

if [ "$bundle_gz" -ge "$limit" ]; then
  echo "FAIL [Gate 5]: bundle too large: ${bundle_gz} >= ${limit} bytes"
  exit 1
fi
echo "PASS [Gate 5]"
```

Pass: gzipped bundle is strictly less than 512000 bytes (500 × 1024).
Fail: gzipped bundle ≥ 512000 bytes.

### Full script structure

```bash
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

# --- Gate 1 ---
echo ""
echo "=== Gate 1: TypeScript type check ==="
npx tsc --noEmit && gate_pass "Gate 1" || gate_fail "Gate 1" "tsc --noEmit failed"

# --- Gate 2 ---
echo ""
echo "=== Gate 2: Vitest test suite ==="
npx vitest run && gate_pass "Gate 2" || gate_fail "Gate 2" "vitest run failed"

# --- Gate 3 ---
echo ""
echo "=== Gate 3: Golden-file tests ==="
output=$(bash test/golden/run.sh test/golden/manifest.json 2>&1)
echo "$output"
echo "$output" | grep -q "50 passed, 0 failed" \
  && gate_pass "Gate 3" \
  || gate_fail "Gate 3" "golden-file tests did not pass 50/50"

# --- Gate 4 ---
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

# --- Gate 5 ---
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
```

Make the script executable: `chmod +x test/golden/gates.sh`.

### Exit behavior

The script uses `set -euo pipefail` combined with `gate_fail` calling
`exit 1`. On the first gate failure:
- The failing gate name is printed
- The specific failure reason is printed
- The script exits with code 1 immediately

All 5 gates must pass for the script to exit 0.

## Write-Set

- `test/golden/gates.sh`

## Read-Set

- `test/golden/run.sh` — to verify the `50 passed, 0 failed` output
  format used in Gate 3 grep
- `test/golden/manifest.json` — to confirm 50 entries (Gate 3
  assertion is 50/50, not N/N)
- `package.json` — to confirm `vitest` and `tsc` are available via npx
  or direct binary

## Architecture Decisions

No architecture decisions from the locked list apply directly.

## Interface Contracts

Gate 3 depends on `run.sh` printing a line matching `50 passed, 0 failed`
on success. If T53's `run.sh` uses a different output format, this task
must adapt the grep pattern accordingly. Read `test/golden/run.sh`
before finalizing Gate 3's grep.

## Acceptance Criteria

1. `gates.sh` runs all 5 checks: running `bash test/golden/gates.sh`
   on a passing codebase prints exactly 5 `PASS [Gate N]` lines and
   exits 0.

2. Non-zero exit on any failure: inject a deliberate type error into
   a source file, run `gates.sh`, verify exit code is 1 and the output
   contains `FAIL [Gate 1]`. Undo the injection.

3. Gate 4 names the offending file: when a source file exceeds 600
   lines, the output must contain the filename and line count (not just
   "too long"). Verify by inspecting the awk output format in the
   script.

4. Gate 5 reports bytes: the output must include the phrase `Bundle
   size (gzipped):` followed by a byte count. No KB/MB shorthand —
   raw bytes only (makes scripted thresholds unambiguous).

## Observability

N/A

## Rollback

Reversible. `test/golden/gates.sh` is a new file. Nothing runs it
automatically until CI configuration is added (out of scope for this
task).

## Quality Bar

- `bash -n test/golden/gates.sh` exits 0 (bash syntax check)
- `bash test/golden/gates.sh` exits 0 on a passing codebase
- The script is executable (`-x` permission set)
- All 5 gate names appear in the output of a successful run
