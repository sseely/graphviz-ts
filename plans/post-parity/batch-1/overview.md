# Batch 1 — Coverage baseline, new goldens, guard tests

Three independent tasks, disjoint write-sets, run in parallel.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Coverage tooling + baseline report ([T1-coverage-baseline.md](T1-coverage-baseline.md)) | sonnet | package.json, package-lock.json, vitest.config.ts, plans/post-parity/coverage-baseline.md | — | [ ] |
| T2 | ~12–15 new golden tests ([T2-new-goldens.md](T2-new-goldens.md)) | sonnet | test/golden/inputs/* (new), test/golden/refs/* (new), test/golden/quarantine/* (new), manifest.json, suite.test.ts, run.sh | — | [ ] |
| T3 | Guard tests for unported-path throws ([T3-guard-tests.md](T3-guard-tests.md)) | sonnet | co-located src/**/*.test.ts (new files only) | — | [ ] |

Write-set conflict check: T1 owns package.json/vitest.config.ts; T2 owns
test/golden/*; T3 creates only NEW test files next to guarded modules.
No overlaps.
