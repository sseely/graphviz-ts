<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 1 — fix + verify

Single batch, two sequential tasks (T2 depends on T1's code change). No parallel
work; one writer per file.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | Port `conc_opp_flag` branch into `arrowFlags` + opposing-edge helper; add `b135`/`167` goldens (TDD: golden red → fix green) | sonnet | `src/common/splines-clip.ts`, `src/common/splines-clip.test.ts` (create), `test/golden/manifest.json`, `test/golden/inputs/*`, `test/golden/refs/*` | — | [x] |
| T2 | Regenerate survey + dashboard; confirm predicted flips and **0 regressions**; document any residual b15/b69 x-coord note | sonnet | `docs/known-divergences.md`, `comparisons/T2-survey-verification.md` (tracked parity artifacts left stale-by-design; see journal) | T1 | [x] |

## Quality gates (run after each task)

```
- command: npm run typecheck
  pass: exit 0
  on_fail: fix_and_rerun
- command: npm test
  pass: exit 0  (golden suite green; b135 golden passes)
  on_fail: fix_and_rerun
- command: npm run survey && npm run survey:dashboard
  pass: 0 regressions vs prior verdicts; b135/167/2087/2825/1453 improve
  on_fail: stop   # a regression here means the fix leaked outside concentrate
```

## Write-set conflict check
T1 and T2 share no files. `parity.json`/`PARITY.md` are regenerated artifacts
owned solely by T2. Clean.
