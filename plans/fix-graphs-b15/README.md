<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: root-cause and fix graphs-b15 (concentrate drops 6 edges)

## Objective

`graphs-b15` is `diverged` with **maxDelta 0** — every drawn element matches the
oracle geometrically; the divergence is purely structural (`svg/g[1][childCount]`).
Under `concentrate=true`, the port emits **147 edges vs the oracle's 153 — it
drops 6 edges**. Find the mechanism (instrument C vs port), apply a **faithful**
fix to the concentrate path, and restore `graphs-b15` to **conformant** with
**zero net parity regressions**.

## Confirmed symptom (pre-mission)

- Input `~/git/graphviz/tests/graphs/b15.gv`: `concentrate=true`, `shape=record`
  nodes, 2 clusters, 180 edges.
- Oracle 153 edge `<g>` blocks; port 147. Same 36 nodes, 5 clusters. maxDelta 0.
- The 6 dropped edges (oracle-present, port-absent), all with record ports:
  - `FallFaceBack:Normal->HoverRest:In`
  - `HoverFaceBack:Normal->HoverRest:In`
  - `HoverForwardToStop:Normal->HoverRest:In`
  - `HoverStrafeToStop:Target->HoverRest:In`
  - `MidJumpFaceBack:Normal->HoverRest:In`
  - `LandVertical:Target->Stand:In`
- They have **different tails** → not parallel multi-edges → the
  `classify.ts:concentrateOrMerge` IGNORED path (gated on same tail+head+ports)
  is **not** the cause. C's `dot_concentrate` (conc.c) merges only VIRTUAL nodes
  (portcmp-gated) and never deletes originals, so C emits all 153. Root cause is
  in the port's `conc.ts` virtual-node merge / `rebuild_vlists` truncation or the
  concentrated-chain emission path — Batch 1 pins which.

## Blast radius

Concentrate edge handling only. Non-concentrate graphs are unaffected (the
concentrate branch is gated on `concentrate=true`). Survey gate is the guard.

## Branch

`fix/graphs-b15` (merge commit on completion — preserves per-task commit IDs).

## Constraints

**Faithful port.** C (`lib/dotgen/conc.c`, `class2.c`, `dotsplines.c`) is the
spec. Mirror its virtual-node-merge + portcmp model exactly. Do **not** "fix" the
count with a dedup-key patch that diverges from C's algorithm.

### Stop conditions
- `rules-gate` shows ANY regression vs the COMMITTED HEAD baseline — STOP, do not
  refresh the baseline to mask it.
- The fix needs editing a file outside the declared write-set.
- The root cause traces to an irreducible FP/libm tie-break — STOP with a
  controlled experiment; do not silently accept.
- 2 consecutive quality-gate failures on the same check; or the same line changed
  3× without resolving the same failure.

### Push-forward conditions
- Probe naming, instrumentation wording, journal phrasing, which extra concentrate
  graphs to spot-check. Stylistic choices with no behavioral effect.

## Quality gates

| command | pass | on_fail |
|---|---|---|
| `npm run typecheck` | exit 0 | fix_and_rerun |
| `npx vitest run src/layout/dot/conc src/layout/dot/classify src/layout/dot/splines` | exit 0 | fix_and_rerun |
| `graphs-b15` re-rendered | 153 edge blocks; the 6 named edges present | stop |
| `npm run survey && npm run survey:gate` (vs HEAD baseline) | exit 0 (0 regressions) | stop |
| `git diff --name-only` | matches declared write-set only | stop |

Baseline-refresh recipe + the **contaminated-baseline gotcha** (gate against
committed HEAD, not the on-disk parity.json): see [batch-2/T3](batch-2/T3-regression-survey-gate.md).

## Batches

| Batch | Status | Tasks |
|---|---|---|
| [Batch 1 — Instrument](batch-1/overview.md) | [ ] | T1 |
| [Batch 2 — Fix + verify](batch-2/overview.md) | [ ] | T2, T3 |

## Index

- [decisions.md](decisions.md) — architecture decisions
- [batch-1/overview.md](batch-1/overview.md) · [T1](batch-1/T1-instrument-concentrate-drop.md)
- [batch-2/overview.md](batch-2/overview.md) · [T2](batch-2/T2-apply-faithful-fix.md) · [T3](batch-2/T3-regression-survey-gate.md)
- [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)
- Precedent: `plans/fix-1213-splines/`, `plans/fix-graphs-shells/` (instrument→fix→gate
  shape). Memories: `concentrate-trunk-2559-done`, `concentrate-arrowhead-done`,
  `2361-ortho-concentrate-dedup-done`, `b69-concentrate-undermerge` (note: the
  b15 x-coord claim there is STALE — current diff is the structural edge drop).
