<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 2 — Verify + baseline refresh

Sequential. Confirms the fix is net-positive with 0 regressions, checks perf, and
refreshes the committed survey artifacts + comparison pages.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T2.1 | Full survey + gate (0-regression); judge any changed goldens per-id vs fresh oracle; perf check (no >2× native on previously-passing inputs); document flips | sonnet→opus | `comparisons/T2-survey-verification.md` | T1.2 (+T1.3/T1.4 if done) | [x] gate PASS, 0 regr |
| T2.2 | Refresh `parity.json` (pango/LUT baseline) + `parity-rules.json` + `PARITY.md`; write comparison page; close mission summary | sonnet→opus | `test/corpus/parity.json`, `test/corpus/parity-rules.json`, `test/corpus/PARITY.md`, `README.md` (summary) | T2.1 | [x] |

## Quality gates
```
- command: npm run typecheck && npm test
  pass: exit 0
  on_fail: fix_and_rerun
- command: npm run survey && npm run survey:gate && npm run survey:dashboard
  pass: 0 regressions; ldbxtried flips diverged → structural/byte; gate PASS
  on_fail: stop
- perf: node test/corpus/bench.mjs (or PERF.md procedure)
  pass: no previously-passing input > 2× its native time
  on_fail: stop (perf regression — corridor routing too costly)
```

## Oracle-cache hygiene (mandatory)
Use a FRESH/isolated oracle cache when surveying — the cache key is now namespaced
by binary+GVBINDIR+mtime (`[[concentrate-arrowhead-done]]`), but after any C
rebuild confirm regressions vs a fresh oracle (render port vs
`GVBINDIR=/tmp/ghl dot` directly). Run the rules survey and the pango baseline
with isolated `ORACLE_CACHE` dirs (do not share between oracles).

## Write-set conflict check
T2.1 = verification doc. T2.2 = regenerated artifacts + README summary. Disjoint.
