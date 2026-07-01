# Mission: root-cause & fix `graphs-biglabel` edge-spline divergence

## Objective

`graphs-biglabel` (`tests/graphs/biglabel.gv`) is a `diverged` parity gap
(maxDelta **111.03**, firstDiffPath `svg/g[1]/g[5]/path[1]/@d`). Rendering both
sides proves node sizes, viewBox (654×1459), and the edge **start point** all
match the oracle exactly; the divergence is confined to the **edge spline** for
`struct1:f2 → struct3:here` — the port emits **1 cubic bezier** (4 pts, a broad
sweep) where the oracle emits **2 cubics** (7 pts, curving up-then-down around
the tall record). This is a spline-fitting / box-corridor piece-count
divergence, same family as prior `long-edge-undersegment` and
`edge-routing-order` fixes. Diagnose the first divergence origin, then apply the
faithful fix at that origin — or, if the residual is irreducible platform-libm
FP, classify it honestly (AD-3, AD-5).

`here` is a port nested 3 levels deep in struct3:
`{ b | { c | <here> d | e } | f }` (`biglabel.gv:88`).

## Branch

`fix/graphs-biglabel` (branch from `main`).

## Structure

Standard repo diagnosis pattern: **Batch 1 diagnoses** (instrumentation + notes,
no `src/` change); **Batch 2 fixes + regresses** (one pinned `src/` file, then
baseline refresh). Batch 2 is entered only if Batch 1 finds an algorithmic port
defect (AD-5).

## Constraints

**Stop conditions**
- Any file outside the declared write-set needs changing.
- Two consecutive quality-gate failures on the same check.
- An implementation would contradict a locked decision (AD-1…AD-5).
- T2 proves the divergence is oracle-side or irreducible platform-libm FP (AD-5)
  → stop with an accepted-divergence recommendation; no `src/` change.
- The origin fix regresses any other corpus id in `survey:gate` (AD-4).
- Batch 1 cannot isolate a single first-divergence origin (port diverges at
  multiple independent sites) → mis-scoped; stop.
- The same code location is changed 3+ times without resolving the divergence.

**Push-forward (decide and log)**
- Instrumentation dump format; which spline/box fields to capture.
- Whether the fix warrants a colocated unit test (logic → yes; pure geometry
  constant → golden suffices).
- Comment/commit wording; golden fixture choice.
- Root-cause artifact phrasing, provided it carries mechanism + origin
  `file:line` + causal chain + ruled-out.

## Quality gates

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run   # any tests touched by the fix
  pass: exit 0
  on_fail: fix_and_rerun
- command: npm run survey && npm run survey:gate
  pass: exit 0; graphs-biglabel improved (conformant, or structural-match per
        AD-3); NO other id regressed
  on_fail: stop
- command: git diff --name-only
  pass: only the T2-pinned src/ file (+ its .test.ts), test/corpus/parity.json,
        parity-rules.json, PARITY.md, goldens, plans/**, .agent-notes/**
  on_fail: stop
```

Note: the survey's npm scripts invoke a bare `tsx`; if `node_modules/.bin/tsx`
is absent, run via the npx-cached tsx with `TSX_BIN` set (see decisions.md
AD-1 note).

## Batches

| Batch | Status | Doc |
|---|---|---|
| 1 — diagnose (instrument oracle + port, isolate origin) | [x] | [batch-1/overview.md](batch-1/overview.md) |
| 2 — fix at origin + regression baseline | [x] | [batch-2/overview.md](batch-2/overview.md) |

## Session summary (complete)

**Status: DONE.** Both batches complete; all quality gates PASS.

**Root cause** — C's record shape `pboxfn` (`record_path`, shapes.c:3793) was
unported (`RECORD_FNS.pboxfn = null`), and `beginPath`/`endPath` took `pboxfn`
as a param every caller set to `null`. For a REGULAREDGE into a record node via
an interior port (`side==0`, e.g. `struct3:here`), C's `endpath` calls
`record_path` to build the routing box as the top-level field's full-height
vertical strip containing the port; the port fell back to the maximal bbox,
cutting the spline straight across (1 cubic) instead of hugging the port column
(2 cubics) — head endpoint ~111pt off.

**Fix (T3, `d77efa1`)** — ported `record_path` → `recordPath` (honoring GD_flip);
`RECORD_FNS.pboxfn = recordPath`; fixed `invokePboxfn` to write boxes into
`endp` in place (was discarding them); `beginPath`/`endPath` now source pboxfn
from `ND_shape(n).fns` internally (C splines.c:389/586), dropping the dead param.
Bounded blast radius: `record_path` only fires for edges with an explicit
`defined` record-field port (Center port is `defined=false`), so plain record
edges are untouched.

**Results**
- `graphs-biglabel` edge `struct1:f2→struct3:here` byte-matches the oracle
  (2 cubics); verdict `diverged → conformant`.
- `survey:gate` PASS — **0 regressions**. 5 graphs improved, 0 regressed:
  graphs-biglabel + graphs-big + share-structs + windows-structs → conformant;
  2646 → structural-match.
- Counts: conformant 574→578, structural-match 171→170, diverged 32→29.
- `tsc --noEmit` exit 0; `record-port.test.ts` 18/18 (incl. 3 new recordPath
  cases); 118 related test files (1431 tests) green.

**Not an AD-5 escape** — genuine algorithmic port defect, fixed at origin (AD-2).
Shared-primitive change (AD-4) guarded by the 0-regression gate.

**Merge:** merge commit (mission branch) to preserve T1/T2/T3/T4 commit IDs.

## Index

- [decisions.md](decisions.md) — AD-1…AD-5
- [batch-1/overview.md](batch-1/overview.md) · [T1](batch-1/T1-instrument-c-oracle.md) · [T2](batch-1/T2-instrument-port-and-diff.md)
- [batch-2/overview.md](batch-2/overview.md) · [T3](batch-2/T3-apply-faithful-fix.md) · [T4](batch-2/T4-regression-and-baseline.md)
- [diagrams/data-flow.md](diagrams/data-flow.md) · [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)
- Related memory: `long-edge-undersegment-done`, `edge-routing-order-done`,
  `long-edge-bow-straight-mode`, `recover-slack-and-c-harness`,
  `byte-match-is-the-bar`, `active-fitter-no-loop-corridors`,
  `faithful-corridor-minw-per-rank`.
