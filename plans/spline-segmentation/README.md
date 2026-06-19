# Mission: spline-segmentation — dot edge bezier-fit parity

## Objective

Close the **clean** subset of the dot parity survey's `path-structure` bucket:
edges whose `@d` path has the same command letters (`M` + cubic beziers) but a
**different number of bezier control points** than the native `dot` oracle, with
the overlapping coordinates matching (Δ≈0). This is a piecewise-bezier
**segmentation / spline-fit** mismatch in the dot edge router, NOT a
routing-position bug. Three distinct inputs: `graphs/jcctree.gv`, `graphs/p2.gv`,
`graphs/pm2way.gv` (each with share/windows variants → 6 corpus ids).

Then (Batch 2) tackle 1–2 **issue-numbered** `path-structure` routing cases,
using the GitLab issue + closing MR to recover intent before porting.

This is a faithful-port fidelity fix. No data-model / API / dependency change.

## Branch / merge
- Branch `fix/spline-segmentation` off `main`.
- Merge back with a **merge commit** (preserves per-task commit IDs).

## Execution model
Run with **opus** (`claude-opus-4-8`, native 1M context). Fable 5 is disabled.

## Oracle + harness (already in place)
- Native `dot`: `~/git/graphviz/build/cmd/dot/dot`, `GVBINDIR=/tmp/gvplugins`.
- Survey: `test/corpus/` (`survey.ts` → `parity.json`, `dashboard.ts`). Oracle
  SVG cache under `$TMPDIR/dot-corpus-oracle/`.
- Per-input check: `npx tsx test/corpus/render-one.ts <input> dot` vs the cached
  oracle SVG (reuse `test/golden/compare.ts`).
- Diagnosis recipe: rebuild `gvplugin_dot_layout` and copy to `/tmp/gvplugins`
  to instrument C (NOT libgvc) — see memory `recover-slack-and-c-harness`.

## Quality gates (run after every task)
```
- command: npx tsc --noEmit
  pass: exit 0 ; on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0, 0 failures, the 128 curated goldens BYTE-IDENTICAL
  on_fail: fix_and_rerun  (any golden change → STOP, do not regenerate)
- command: npx tsx test/corpus/survey.ts && npx tsx test/corpus/dashboard.ts
  pass: exit 0 ; then per-id verdict diff vs the pre-task parity.json snapshot
        shows 0 regressions and the target inputs improve
  on_fail: fix_and_rerun
- command: npx lizard <changed files> -C 10 -L 30 -a 5
  pass: no violations (30 lines/fn, CCN 10, 5 params, 500 lines/file)
  on_fail: fix_and_rerun
- command: git diff --name-only <base>
  pass: within the task's declared write-set ; on_fail: stop
```

## Batches
| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | T1 diagnose (instrument C), T2 fix segmentation | [x] |
| 2 | T3 diagnose (issue+MR), T4 fix routing case | STOP |

> Batch 1 result: only jcctree was a segmentation/emission bug (svgEdgePath
> emitted the over-allocated bz.list instead of bz.size). Fixed → 4 cases
> byte/structural-match, 0 regressions. p2/pm2way were routing-POSITION
> divergences (out of scope per STOP condition; logged as follow-on).
>
> Batch 2 STOPPED at T3 (no fix applied): no isolated issue-numbered dot
> routing case with a *missing* MR fix exists. The smallest candidates are
> poor fits — #2168's MR is fdp/neato ortho (not dot); #241's MR
> (routespl.c horizontal/vertical) is already ported (splines-routespl.ts).
> The rest are deep subsystems (ortho/cluster/compound/known-hang). Per the
> Batch 2 STOP condition, the routing-position remainder is recommended as a
> dedicated future mission. See decision-journal.md T3 rows.

- [decisions.md](decisions.md) — locked architecture decisions
- [batch-1/overview.md](batch-1/overview.md) · [T1](batch-1/T1-diagnose.md) · [T2](batch-1/T2-fix.md)
- [batch-2/overview.md](batch-2/overview.md) · [T3](batch-2/T3-diagnose.md) · [T4](batch-2/T4-fix.md)
- [diagrams/data-flow.md](diagrams/data-flow.md)
- [decision-journal.md](decision-journal.md)

## Stop conditions
STOP and wait for human input when:
- A fix needs files outside the (T1-determined) write-set.
- 2 consecutive gate failures on the same check; or the same code location is
  changed 3× without resolving the same failing check.
- ANY curated golden (`suite.test.ts` / `manifest.json`) changes — these are the
  byte-exactness backstop; never modify them or regenerate refs.
- The divergence turns out to be a large-delta routing-POSITION difference (not
  segmentation) — report it as a separate follow-on; do NOT expand scope.
- The C instrumentation cannot isolate the cause.

## Push-forward with judgment
- Which issue-numbered case to pick for Batch 2 (choose the most isolated).
- Test naming/location; lizard-driven helper splits.
- A fix simpler than estimated (log a decision-journal entry).

## Operational readiness
N/A — dev/test fidelity work; the browser library's layout/render path is
unchanged in shape (no SLIs, dashboards, traces, on-call). **Rollback:
Reversible** (revert the merge commit). No API/schema/contract/backwards-compat
impact.

## Mission summary (2026-06-19)
- **Batch 1 — DONE.** T1 diagnosed jcctree as an emission bug (svgEdgePath
  mapped the over-allocated `bz.list` instead of the first `bz.size` points;
  the over-allocation is faithful to C `new_spline`+`clip_and_install`). T2
  fixed svgEdgePath to slice to `bz.size` + added regression test AC-T2.
  Result: 4 corpus cases improved (graphs/share/windows-jcctree → byte-match,
  b68 → structural-match), **0 regressions**, 128 goldens byte-identical.
  p2/pm2way confirmed routing-POSITION (out of scope, logged).
- **Batch 2 — STOPPED at T3 (no fix).** No isolated issue-numbered dot routing
  case with a *missing* MR fix exists among the tractable candidates: #2168's
  MR is fdp/neato ortho (not dot); #241's MR (routespl.c horizontal/vertical)
  is already ported; the rest are deep subsystems. Per the Batch 2 STOP
  condition, the routing-position remainder is recommended as a dedicated
  future mission. No `src/` change in Batch 2.
- **Quality gates (final):** `tsc --noEmit` 0; `vitest` 1990 passed / 128
  goldens byte-identical; `lizard` clean; survey per-id delta +4 / −0.
- **Decisions:** 6 journal rows; 1 STOP, 3 follow-on flags.
- **Follow-ups:** (a) routing-position bucket as its own mission; (b) latent
  sibling emit sites (svg-edge-split.ts:68, svg-parallel-edge.ts, map.ts:98)
  also read `list.length` — bound them to `bz.size` if a multi-color/map
  corpus case ever exercises a clipped spline.
