# T4 — gates.sh coverage gate + stale Gate 3 fix

## Context

test/golden/gates.sh has 5 gates. Gate 3 calls test/golden/run.sh, which
invokes `node dist/cli.js` — a CLI that has never existed in this repo
(dist/ is empty; no src/cli.ts). Gate 3 currently cannot pass. Also: the
"50 passed" expectation is now stale (T2 grew the manifest), and there is
no coverage gate yet. decisions.md D5: vitest thresholds + gates.sh gate,
NO git hooks.

## Task

1. Rework Gate 3: drop the dist/cli.js path. Run the golden suite
   directly: `npx vitest run test/golden/suite.test.ts` and require exit
   0; derive the expected entry count from manifest.json (`jq length`)
   and assert the vitest output reports at least that many passing tests.
   Either fix run.sh to the same approach or fold it into gates.sh and
   delete run.sh — executor's choice; journal the call.
2. Add Gate 6 (coverage): `npm run coverage` must exit 0. While
   thresholds are off (pre-batch-3) this just proves the report runs;
   when batch 3 flips thresholds on, the same gate enforces 90/90/90
   with no further gates.sh change.
3. Keep Gates 1, 2, 4, 5 unchanged. Verify the whole script passes
   end-to-end: `bash test/golden/gates.sh`.

## Write-set

test/golden/gates.sh, test/golden/run.sh (modify or delete)

## Read-set

test/golden/gates.sh, test/golden/run.sh, test/golden/manifest.json
(count only), package.json scripts (T1's coverage script)

## Acceptance criteria

- Given the reworked script, when `bash test/golden/gates.sh`, then all
  gates pass on the current tree
- Given a deliberately broken golden (temporarily mangle a ref copy in
  /tmp — NOT the repo), when Gate 3 logic runs against it, then it fails
  (verify the gate actually detects failure, then restore)
- Given no dist/cli.js anywhere, then nothing in test/golden references it

## Observability: N/A. Rollback: Reversible.

## Quality bar

bash test/golden/gates.sh exits 0; npx tsc --noEmit clean;
npx vitest run green. Commit: `chore(T4): rework quality gates — coverage gate, fix stale cli path`
