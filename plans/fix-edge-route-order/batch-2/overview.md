<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 2 — Verify + baseline refresh

Sequential. Confirms the fix is net-positive with 0 regressions, checks perf, and
refreshes the committed survey artifacts + comparison pages.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T2.1 | Full survey + gate (0-regression); judge changed goldens per-id vs fresh oracle; perf check (no >2× native on previously-passing inputs); document flips (esp. ldbxtried `n0->n1`) | sonnet | `comparisons/T2-survey-verification.md` | T1.2 (+T1.3 if done) | [ ] |
| T2.2 | Refresh `parity.json` (pango/LUT baseline) + `parity-rules.json` + `PARITY.md`; write comparison page; close mission summary | sonnet | `test/corpus/parity.json`, `test/corpus/parity-rules.json`, `test/corpus/PARITY.md`, `README.md` (summary) | T2.1 | [ ] |

## Quality gates
```
- command: npm run typecheck && npm test
  pass: exit 0
  on_fail: fix_and_rerun
- command: npm run survey && npm run survey:gate && npm run survey:dashboard
  pass: 0 regressions; ldbxtried n0->n1 flips to corridor; gate PASS
  on_fail: stop
- perf: node test/corpus/bench.mjs (or PERF.md procedure)
  pass: no previously-passing input > 2× its native time
  on_fail: stop (perf regression)
```

## Survey hygiene (mandatory)
The survey now has a DYNAMIC timeout floor (5× slowest native) and
`npm run survey:fast` (`SURVEY_MAX_PORT_MS`, skip >60s graphs). Use a
FRESH/isolated oracle after any C rebuild; the cache key is namespaced by
binary+GVBINDIR+mtime (`[[concentrate-arrowhead-done]]`). Run the pango baseline
with `GV_TEXT_MEASURER=lut GVBINDIR=/tmp/gvplugins` and an isolated `ORACLE_CACHE`.
GOTCHA: `BENCH_IDS=... bench.mjs` OVERWRITES perf.json — restore with
`git checkout test/corpus/perf.json`.

## Write-set conflict check
T2.1 = verification doc. T2.2 = regenerated artifacts + README summary. Disjoint.
