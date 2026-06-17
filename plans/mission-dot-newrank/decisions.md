# Architecture Decisions — DOT-newrank

## AD-1: Track fill nodes via a faithful `_new_rank` subgraph (NOT a list)

**Context:** C's `realFillRanks` creates `agsubg(root,"_new_rank")` to hold
placeholder nodes so `removeFill` can find and delete them; TS has no `agsubg`.
**Decision (Scott, overriding the transient-list recommendation):** Port the
cgraph primitives (`agsubg`/`agsubnode`/`agdelsubg`/`agdelnode`/anonymous
`agnode`) faithfully and use the real `_new_rank` subgraph, mirroring C exactly.
**Consequences:** Stays true to the C source and gives reusable cgraph ops; adds
a model-layer file (`cgraph-ops.ts`). Must honour Subgraph Ownership Semantics —
a node added via `agsubnode` is a member of the subgraph AND every enclosing
graph (see memory `cgraph.md`).

## AD-2: `removeFromRank` helper in `fastgr.ts`

**Context:** `removeFill` must pull a node out of its rank's `v[]` array; only
`install_in_rank` exists.
**Decision:** Add `removeFromRank(g, n)` beside `install_in_rank` in `fastgr.ts`.
**Consequences:** Symmetry, reusable, unit-testable; no inline duplication.

## AD-3: One faithful `makeFillNode` constructor

**Context:** C uses anonymous `agnode(sg,NULL)` with `lw=rw=0.5, ht=1,
UF_size=1`, empty in/out elists.
**Decision:** A `makeFillNode(g, rank)` helper in `mincross-build.ts` minting a
synthetic unique name (`__fill_<rank>_<seq>`) via `agnode`.
**Consequences:** Keeps `realFillRanks` within the 30-line/fn cap; one place
owns placeholder-node shape.

## AD-4: Deletion/parity gated on the byte-exact golden invariant

**Context:** `newrank`/`LEAFSET` are ATTR-gated; the 115 existing goldens are
all default-attr and must not move.
**Decision:** Land a feature ONLY if all 115 goldens stay byte-identical and the
new newrank/LEAFSET cases reproduce the oracle ≤0.5pt. If parity is unreachable,
STOP and keep current behaviour (re-scope with a comparison page) — never
regress a golden.
**Consequences:** Guarantees zero golden churn. Worst case a residual is
re-scoped (as DOT-1b's flat-edge fitter was).
