# Decision Journal

| # | Batch/Task | Decision | Rationale |
|---|---|---|---|
| 0 | planning | Harness fix over per-file quarantine | User-selected; root/general fix at the oracle-usability site (see decisions.md AD-1) |
| 1 | T1 | Placed `isWellFormedSvg` just above `diffVerdict`; msg `oracle not well-formed XML: <N>B` | Push-forward (message/placement left open by brief). PII-free — length only, no raw oracle bytes. TDD: red → green, 3 unit tests pass, tsc clean. |
| 2 | T2 | Ran survey via npx-cached tsx (`TSX_BIN` set) — local `node_modules/.bin/tsx` absent, npm script's bare `tsx` hit `command not found` (127) | Env quirk, not a code issue. Cached tsx is byte-identical binary; recipe env preserved (GVBINDIR=/tmp/ghl, PARITY_OUT=parity-rules.json, Estimate measurer). |
| 3 | T2 | Accepted PARITY.md drift for 2471/1879 as pre-existing dashboard staleness | parity.json delta = 0 maxDelta changes, only 1472 verdict changed. Committed PARITY.md predated its own parity.json; dashboard is a pure fn of parity.json, so regen corrects it. Not caused by T1 (those oracles are well-formed → untouched path). |
| 4 | batch-1 gate | All gates PASS | tsc exit 0; survey.test.ts 3/3; survey:gate 0 regressions; only 1472 changed bucket; write-set = 5 declared files, no src/ change; 2 commits (one per task). |
