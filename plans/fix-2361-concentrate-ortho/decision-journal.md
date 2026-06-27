# Decision journal — fix 2361 concentrate under-merge (splines=ortho)

## Root cause (instrumented before editing)

Probed port vs native edge-title sets: the 7 "extra" port edges are exactly
one direction of each of the 7 **2-cycles** in the graph
(AC↔IV, AC↔IW, FF↔IK, IK↔FS, IK↔FW, IK↔GF, IK↔MF). Node positions match
native **exactly** (all 14 nodes identical) → layout is correct; the divergence
is purely emit-side.

The mechanism is **ortho's own concentrate dedup**, not class2's
`edge_type=IGNORED`. C `orthoEdges` (lib/ortho/ortho.c:1207-1228) maintains a
point-set keyed by the **unordered `(AGSEQ(tail), AGSEQ(head))` pair**: iterating
`agfstnode→agfstout`, the first edge between a pair is routed; any later edge
sharing that pair (the reverse leg of a 2-cycle, or a parallel multi-edge) is
skipped. The port's `ortho-adapter.ts buildEdges` collected every non-self edge
from `g.edges` with **no dedup**, so it routed both legs of every 2-cycle.

class2's `conc_opp_flag` was already correct: the kept forward edge (e.g.
`AC->IV`) already drew the double arrowhead, matching native. Only the gather
dedup was missing.

## Fix

`src/layout/dot/ortho-adapter.ts buildEdges`: rewrote the gather to mirror C
exactly — iterate nodes in creation/seq order (`agfstnode`) then each node's
out-edges in `agfstout` order (`buildOutEdgeIndex`), and when
`dotRoot(g).info.concentrate` is set, dedup by the unordered `(tail.id, head.id)`
key via a `Set`. Self-loop filter (`tail === head`) preserved. The keep-first
decision now matches C's iteration, so the same edge native keeps is kept.

Decision: ported C's faithful point-set (option A) rather than the cheaper
"skip `edge_type===IGNORED`" (option B). For this graph both coincide, but B
diverges from C in the corner case where the lower-seq node is the head of the
forward edge (C-ortho keeps the lower-seq-tail leg; class2 keeps the forward
leg). Sacred-C → port the actual ortho branch.

## Result

- 2361 edge groups 32 → 25 (= native); element counts g/path/polygon all match.
- Survey verdict **diverged → structural-match** (the brief's bar; HTML-free
  ortho graph). Only 2361 changed verdict vs the committed baseline (790 rows
  diffed — no drift).
- Residual maxDelta=144 is **ortho maze channel-assignment fidelity** (a plain
  non-2-cycle edge `AC->CI` also shifts ~9px), previously masked by the
  structural short-circuit; a separate concern, out of this mission's scope
  (did not touch the ortho routing core, per the risk boundary).

## Gates

- `npx tsc --noEmit --stableTypeOrdering` → exit 0.
- `npx vitest run` → 2467 passed, 1 skipped (incl. 2 new structural tests in
  `test/golden/ortho-concentrate-dedup.test.ts`).
- survey (`GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json`) → 2361 match.
- `rules-gate.ts` → regressions=0, clip-regressions=0; 2361 listed as improved.
  Concentrate neighbours unmoved: 2559 stable byte-match; b69/b15 pre-existing
  (not regressed).
- Refreshed `parity.json` ← `parity-rules.json` + regenerated `PARITY.md`.

## Status: COMPLETE
