<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions (pre-made, user-approved 2026-07-01)

## D1 — Lost-edge outcome ladder (truth-first)

The childCount pin is an edge **C fails to route** (`Pshortestpath failed`,
edge dropped, exit 1) and the port routes. Ranked outcomes:

1. Fix the corridor/box divergences at their origin (they are port defects
   regardless of the lost edge — 4 edges measurably diverge).
2. If the port's polygon for `c4251->c4253:In0` then degenerates like C's:
   port C's failure path faithfully (T3) — warning + no spline + edge not
   emitted → element counts match; expect conformant/structural-match.
3. If corridors are verified identical and the TS triangulation still
   succeeds where C's fails (pure FP): do NOT force a failure. Controlled
   experiment required (feed C's exact polygon to TS `shortestPath`), then
   classify honestly as a NEW accepted-divergence class ("port routes an
   edge C loses to its own numeric failure") with evidence attached.

"Count/verdict forced without a mechanism" is not an outcome. No 1332
special cases; no fake failures.

## D2 — Diagnosis method: C-first differential instrumentation

Env-gated dumps in C for the 5 edges — `dotsplines.c` (pathend boxes,
beginpath/endpath, cluster `cl_bound` clamps in `maximal_bbox`),
`routespl.c` (the polygon handed to `Pshortestpath`), `shortest.c` (the
failure site) — mirrored in TS, diffed line-wise to the FIRST differing
value per edge. Shared mechanisms coalesced. The forced-polygon seam
experiment is the confirmation tool and mandatory for any "irreducible"
claim. (Recipe validated by b15 and fix-nan-a2-retire.)

## D3 — Scope discipline + write-set expansion protocol

Fix at the mechanism's origin only. T2/T3 write-sets are **provisional
until T1 pins `fixLocus`**. Implicated files outside the declared set →
interactive ASK (AskUserQuestion) with `file:line` + mechanism artifact
before editing; approval expands the set (journaled), denial =
document-and-halt for that locus. 3+ independent mechanisms across the 5
edges = re-scope stop. `routeCurvedGroup`'s origSeq sort and the pathplan
`triInner` O(n²) perf are out of scope.

## D4 — Lost-edge failure semantics (only if D1 rung 2 is reached)

Mirror C exactly: routesplines failure → warning through the port's
existing warning channel (text shaped like C's `agerr` "lost <t> <h> edge"),
no spline installed, SVG emit skips spline-less edges. No throw, no
fallback straight-line synthesis. Guard with a unit test that a healthy
graph never loses edges through this path.

## Operational notes (Phase 4, confirmed)

- Rollback class: **Reversible** (local branch; revert-only; no migrations).
- SLIs: full vitest; survey + rules-gate vs committed HEAD (0 regressions);
  1332 per-element gate (nodes 0 / 4 geometry edges 0 / count parity per
  D1); watch-graph byte-compare (b53, 1767, 1221, 2721, 2521_1, 1624 + 2–3
  logged picks). Per-element title-keyed comparison is the gate — compareSvg
  maxDelta is blind past childCount changes.
- Perf guard: no corpus graph past the 180s survey cap; do not touch
  `triInner` perf here.
- Budget: ≤2 full survey runs (one at T5; +1 only after a gate fix).
- C tree: instrument → revert → rebuild → byte-verify oracle before survey.
  1332's oracle exits 1 by design (its own lost edge) — byte-verify against
  its emitted SVG, not its exit code.
- Backwards compat: only 1332's own output may change (possibly 116 edges,
  matching C, plus a routing warning). Warning channel addition is additive.
