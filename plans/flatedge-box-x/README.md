# Mission: FLATEDGE end-box x-placement parity (dot)

## Objective
Fix the non-adjacent flat-edge routing divergence isolated by the
flat-edge-routing-241 diagnosis: `make_flat_edge`'s flat-END box (via
`makeFlatEnd` -> begin/endpath FLATEDGE) is placed at the node EDGE
(`coord.x +/- rw/lw`) in the port vs the node CENTRE (`coord.x`) in C — an
~rw (27pt) x-shift. This corrupts the routing corridor for non-adjacent
same-rank compass-port edges (`1:se->6:sw`, `5:ne->8:nw` in `tests/241_0.dot`)
and drives much of #241_0's bbox shift. Faithful-port fidelity fix in the
FLATEDGE begin/endpath box construction; no data-model / API / dependency
change. The adjacent `make_flat_adj_edges` curl is a SEPARATE follow-on (#2),
out of scope here.

## Branch / merge
- Branch `fix/flatedge-box-x` off `main`.
- Merge back with a **merge commit** (preserves per-task commit IDs).

## Execution model
Run with **opus** (`claude-opus-4-8`, native 1M context). Fable 5 is disabled.

## Oracle + harness (already in place)
- Native `dot`: `~/git/graphviz/build/cmd/dot/dot`, `GVBINDIR=/tmp/gvplugins`.
- Survey: `test/corpus/` (`survey.ts` -> `parity.json`, `dashboard.ts`). Oracle
  SVG cache under `$TMPDIR/dot-corpus-oracle/`.
- Per-input check: `npx tsx test/corpus/render-one.ts <input> dot` vs the cached
  oracle SVG (reuse `test/golden/compare.ts`).
- C instrumentation recipe: rebuild `gvplugin_dot_layout`, copy the plugin to
  `/tmp/gvplugins` (NOT libgvc) — memory `recover-slack-and-c-harness`. Restore
  the clean plugin when done (the oracle cache must stay native-C-faithful).

## Quality gates (run after every task)
```
- command: npx tsc --noEmit
  pass: exit 0 ; on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0, 0 failures, the 128 curated goldens BYTE-IDENTICAL
  on_fail: fix_and_rerun  (any golden change -> STOP — esp. a regular-edge
           golden, which means the FLATEDGE gating failed; do not regenerate)
- command: npx tsx test/corpus/survey.ts && npx tsx test/corpus/dashboard.ts
  pass: exit 0 ; then per-id verdict diff vs the pre-task parity.json snapshot
        shows 0 regressions and 241_0's non-adjacent flat edges improve
  on_fail: fix_and_rerun
- command: lizard <changed files> -C 10 -L 30 -a 5
  pass: no violations (30 lines/fn, CCN 10, 5 params, 500 lines/file)
  on_fail: fix_and_rerun
- command: git diff --name-only main
  pass: within the task's declared (T1-determined) write-set ; on_fail: stop
```

## Batches
| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | T1 diagnose: pin the FLATEDGE box-x line (instrument C) | [x] |
| 2 | T2 fix | STOP (premise invalid — see below) |

- [decisions.md](decisions.md) — locked architecture decisions (AD-1..AD-5)
- [batch-1/overview.md](batch-1/overview.md) · [T1](batch-1/T1-diagnose.md)
- [batch-2/overview.md](batch-2/overview.md) · [T2](batch-2/T2-fix.md)
- [diagrams/data-flow.md](diagrams/data-flow.md)
- [decision-journal.md](decision-journal.md)

## Stop conditions
STOP and wait for human input when:
- A fix needs files outside the (T1-determined) write-set.
- ANY curated golden changes — ESPECIALLY a regular-edge golden, which signals
  the FLATEDGE gating (AD-5) failed. Never modify or regenerate refs.
- 2 consecutive gate failures on the same check; or the same code location is
  changed 3x without resolving the same failing check.
- **AD-4/AD-5:** the box-x reference cannot be corrected FLATEDGE-gated without
  touching regular-edge box construction -> report as a follow-on.
- C instrumentation cannot isolate the cause.

## Push-forward with judgment
- Test naming/location; lizard helper splits.
- A fix simpler than estimated (log a decision-journal entry).

## Prior diagnosis (from flat-edge-routing-241, on main)
T1 of that mission established: nodes + cardinal edges match C exactly;
non-adjacent flat edges have matching vspace/stepx/stepy (36/9/18); the
flat-END box is x-shifted by ~rw — C `[99,109]` (node centre) vs port
`[126,136]` (node edge). Begin-side helpers in `splines-path-begin.ts` use
`coord.x + rw`/`coord.x - lw` references (e.g. line 56). See that mission's
decision-journal.md for the C/port box dumps.

## Operational readiness
N/A — dev/test fidelity work; the browser library's layout/render path is
unchanged in shape (no SLIs, dashboards, traces, on-call). **Rollback:
Reversible** (revert the merge commit). No API/schema/contract/backwards-compat
impact.

## Mission outcome (2026-06-19) — STOPPED at T1: premise invalid
T1 (no `src/` change) dumped C `ND_coord(n).x` directly and found the port's
internal node x-coords are **uniformly +27** vs C (node1: 72 in C, 99 in port;
likewise all nodes). Both compute the flat-end box `LL.x = coord.x + rw` with
the SAME formula — so the +27 box-x delta this mission targeted is a
**compensating internal-frame offset**, cancelled by the emit-time translate,
NOT a bug. Proof: `1:se->6:sw`'s final X is conformant to the oracle
(`M114.02 ... 374.6 ... 432.62`); only **Y** differs (0 vs -7.88).

**Correction to the prior diagnosis:** flat-edge-routing-241 T1 read internal
box coords (`[99,109]` vs `[126,136]`) and mis-attributed the +27 to a box-x
bug; it is the node-frame offset.

**Recommendation:** the real #241_0 divergence is **Y-only** (bbox height /
curl extent), dominated by the adjacent `make_flat_adj_edges` curl. Replace
follow-ons #1 and #2 with a SINGLE mission targeting flat-edge Y/curl geometry.
See decision-journal.md T1 rows.
