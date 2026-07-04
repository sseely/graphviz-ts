# T4 — Diagnose x-NS residuals: graphs-b51, 2475_2

## Context
graphviz-ts is a faithful TS port of C Graphviz (`~/git/graphviz` = spec; read
project `CLAUDE.md`). Two tracked diverged ids sit in the known x-coordinate
network-simplex family:

- `graphs-b51` (maxΔ 1096.4, `~/git/graphviz/tests/graphs/b51.gv`) — a
  smaller variant of share-b51. share-b51's blok_60 divergence was
  root-caused (feasibleTree merge-phase min-slack pick flipped by a
  label-vnode lw misport) and FIXED in commit `d20df4d` (classify.ts
  labelVnode lw = root nodesep); share-b51 is now conformant. graphs-b51
  remained diverged in the 2026-07-03 baseline — its residual is either
  ANOTHER shallow contributor (like the lw bug) or the true degenerate
  optimal-vertex-selection class.
- `2475_2` (maxΔ 85, 24592 lines, clusters, rankdir=BT) — memory
  (hang-2475-2-xcoord-ns): the keepout_othernodes rankGet fix landed; the
  residual Δ85 was classified x-coord NS.

## Task
Diagnosis ONLY (`~/.claude/rules/diagnosis.md` — read first). For each id,
using the XNSDBG paired-instrumentation method from
`.agent-notes/b51-blok60-is-xcoord-ns-selection.md`:
1. Identify the worst-shifted node(s) (flat-geom-diff) and confirm the shift
   originates in the x-NS (`rank(g,2,…)` output), not earlier.
2. Compare feasibleTree add-order / min-slack picks C vs port for the
   divergent region. If a pick flips because an INPUT differs (lw/rw/minlen/
   weight — like the lw bug), that is a shallow contributor: pin the misport
   file:line. Chase inputs FIRST; pivot-sequence divergence is only the
   verdict after inputs are proven identical.
3. If all NS inputs are line-identical and the divergence is which optimal
   vertex is selected (equal-cost proof like blok_60's span argument),
   classify tracked-deep with the proof.

Budget guard: 2475_2 is huge (24592 lines). Diagnose graphs-b51 FIRST
(213-line render, fast); apply what you learn to 2475_2. If 2475_2
instrumentation exceeds practical iteration time, a "same-class as graphs-b51
finding, evidence: <partial dump>" classification is acceptable — say so
explicitly rather than guessing.

## Write-set
- `.agent-notes/path-structure-xns-residuals.md`
- Temporary env-gated (XNSDBG) instrumentation in `src/layout/dot/ns*.ts` +
  `position.ts` — reverted before finishing.

## Read-set
- `.agent-notes/b51-blok60-is-xcoord-ns-selection.md` (method — read fully)
- `.agent-notes/2371-is-xcoord-ns-solution-selection.md` (class definition)
- `.agent-notes/share-b51-preread.md` (graph anatomy; secondary divergences
  list — blok_70/20/23/47/48/78/79 — these may be graphs-b51's residual too)
- Port: `src/layout/dot/ns.ts` (lrBalance, feasibleTree), `position.ts`
  (createAuxEdges); C: `~/git/graphviz/lib/common/ns.c`,
  `lib/dotgen/position.c` (create_aux_edges, make_LR_constraints)
- `plans/fix-path-structure-bucket/batch-1/overview.md` (note schema)

## Repro
```
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/graphs/b51.gv -o /tmp/gb51.c.svg
GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/graphs/b51.gv dot > /tmp/gb51.port.svg
node test/diagnostic/flat-geom-diff.mjs /tmp/gb51.c.svg /tmp/gb51.port.svg
```

## Interface contract
Note follows the schema in `batch-1/overview.md`, one block per id (or one
shared block with per-id evidence if same mechanism).

## Quality bar
- `git status` clean except the note; `npx tsc --noEmit` passes.
- Each id classified shallow-fixable (with fixTarget) or tracked-deep (with
  the equal-cost/inputs-identical proof). "Probably deep" without the inputs
  check is NOT acceptable.

## Boundaries
- Never: apply fixes (even one-liners — Batch 2 does that, gated per D2);
  instrument rank*/mincross* (T1/T3 own them).
- Ask first: editing C source (shared tree).
