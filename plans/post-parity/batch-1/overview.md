# Batch 1 — Coverage baseline, new goldens, guard tests

Three independent tasks, disjoint write-sets, run in parallel.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Coverage tooling + baseline report ([T1-coverage-baseline.md](T1-coverage-baseline.md)) | sonnet | package.json, package-lock.json, vitest.config.ts, plans/post-parity/coverage-baseline.md | — | [x] |
| T2 | ~12–15 new golden tests ([T2-new-goldens.md](T2-new-goldens.md)) | sonnet | test/golden/inputs/* (new), test/golden/refs/* (new), test/golden/quarantine/* (new), manifest.json, suite.test.ts, run.sh | — | [x] |
| T3 | Guard tests for unported-path throws ([T3-guard-tests.md](T3-guard-tests.md)) | sonnet | co-located src/**/*.test.ts (new files only) | — | [x] |

Note (2026-06-11): run.sh already derived its pass count from the manifest
via jq — the "hardcoded 50" premise in T2 was stale; no run.sh edit was
needed. T2 triggered the mission stop condition (9/16 quarantined); see
decision-journal.md.

Write-set conflict check: T1 owns package.json/vitest.config.ts; T2 owns
test/golden/*; T3 creates only NEW test files next to guarded modules.
No overlaps.
