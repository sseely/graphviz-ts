# Mission: DOT-1b — retire the simplified edge fitter

## Objective

After DOT-1 (mission-dot-splines), every **single** regular dot edge routes
through the faithful pathplan path, but the simplified fitter survives in two
paths that still use it. Port both to faithful primitives, then **delete the
fitter** so no non-faithful regular-edge router remains. The two surviving
paths: (1) the parallel/opposing multi-edge group router; (2) adjacent back
edges (b→a, 1 rank). Per "the C source is sacred," mirror C's
`make_regular_edge` exactly (AD-2).

Full origin analysis: `plans/mission-dot-splines/decision-journal.md` (T6 +
Mission outcome) and `plans/layout-engine-backlog/gaps/dot.md` (DOT-1b).

## Branch

`feature/dot-1b` off `main` (currently at the dot-splines merge `100249b`).
Merge back with a **merge commit** when gates pass.

## Execution model

Run with **opus** (`claude-opus-4-8`, native 1M context). T2 is a measure-first
study that de-risks T3 (the hard parallel/opposing port). Log refinements to the
decision journal.

## Quality Gates (run after every task)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0 AND failed == 0 AND passed >= 1810 AND 115 goldens byte-identical
  on_fail: fix_and_rerun
- command: npx lizard <changed files> -C 10 -L 30 -a 5
  pass: no violations (30 lines/fn, CCN 10, 5 params, 500 lines/file)
  on_fail: fix_and_rerun
- command: git diff --name-only HEAD~1
  pass: within the task's declared write-set
  on_fail: stop
```

Baseline at mission start: **1810 passed / 0 failed, 115 goldens byte-identical**
(main, 2026-06-17). Oracle: `~/git/graphviz/build/cmd/dot/dot` with
`GVBINDIR=/tmp/gvplugins`.

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | [T1 adjacent-back faithful](batch-1/T1-adjacent-back-faithful.md) · [T2 measure opposing model](batch-1/T2-measure-opposing-model.md) — **T2 done (spike)** | [x] |
| 2 (after T1) | [T3 parallel/opposing faithful](batch-2/T3-parallel-opposing-faithful.md) | [x] |
| 3 (after T1, T3) | [T4 delete the fitter](batch-3/T4-delete-fitter.md) | [ ] |

**T2 is already complete** — a pre-mission feasibility spike (2026-06-17)
instrumented the C `make_regular_edge`/`clip_and_install` and captured the exact
recipe (see `decision-journal.md` → "T2 spike recipe"). It resolved the DOT-1
puzzle: C routes group back members via `makefwdedge` + `clip_and_install` + a
separate `edge_normalize`/`swap_spline` pass, NOT by reversing the base. **T3 is
de-risked and viable** — it now implements a known recipe rather than an open
investigation. Batch 1 reduces to T1; T4 is grep-gated dead-code removal.

## Constraints (stop / push-forward)

**Stop and wait for human input when:**
- Any of the 115 goldens changes byte-for-byte (AD-3 — hard invariant; never
  regenerate or quarantine an existing golden).
- T3 cannot reach byte-exact opposing/parallel parity even with T2's recipe —
  keep that fitter path and re-scope the residual; do NOT regress.
- A fix requires changes outside the routing write-set (mincross/position) — the
  gap is positional, not routing.
- The same location is changed 3× without closing the same failing check.
- A declared architecture decision (AD-1/2/3) would be contradicted, or 2
  consecutive gate failures on the same check.

**Push forward with judgment when:**
- Sub-pixel box/index/off-by-one corrections within the routing write-set.
- A new (non-golden) case reaches the oracle within tol 0.5 → pin and move on.
- Grep-confirmed dead-code removal in T4.
- Minor faithful-path bug fixes verified against the dot oracle.

## Operational readiness

- **Observability:** N/A — browser library, no runtime services/metrics. SLI =
  "115 goldens byte-identical, oracle pins ≤0.5pt," verified by `npx vitest run`.
- **Rollback:** Reversible — revert commits; goldens stay byte-identical so no
  data/format/output migration.
- **Backwards compat:** Non-breaking — `renderSvg` output unchanged for every
  existing case; internal fitter→faithful refactor + dead-code removal.

## Links

- [decisions.md](decisions.md) — AD-1/2/3
- [decision-journal.md](decision-journal.md) — appended during execution
- [diagrams/component-map.md](diagrams/component-map.md) — routing dispatch + fitter web
- [DOT-1 decision journal](../mission-dot-splines/decision-journal.md) — origin (T6)
- [Backlog DOT-1b](../layout-engine-backlog/gaps/dot.md)
