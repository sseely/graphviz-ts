# Decision Journal — fix-pack-dot-2458

Append one row per non-trivial judgment call during execution.

| When | Task | Decision | Rationale |
|------|------|----------|-----------|
| 2026-06-27 | T1 | initSubg IS needed (kept per ADR-2) | Empty `sg.attrs` after `buildSubgraph` → `dotGraphInit` reads defaults not root's `rankdir/nodesep/ranksep`; probe showed root rankdir=5 but component=0 without seed. Ordering: `dotGraphInit(sg)` then `initSubg(sg,root)` to override. |
| 2026-06-27 | T1 | ratio guard = direct attr read `ratioIsNone(g)`, not `g.info.drawing` | `g.info.drawing` only set for `ratio=compress`; fill/expand/value/auto leave it undefined and must NOT activate pack. Read `ratio` attr directly per C `setRatio`. |
| 2026-06-27 | T1 | Per-component layout excludes `gvPostprocess`; run it ONCE on root after `packSubgraphs` | C's `dot_layout` calls `dotneato_postprocess(g)` once on root; per-component `gvPostprocess` would double-rotate rankdir coords. Root bb set by `packSubgraphs→computeSubgraphBB`. |
| 2026-06-27 | T1 | Cluster oracle = corpus 2592 (real, diverged) | pack=100 packmode=array_3, 2 components, cluster_b1+cluster_b2 in comp-1. No synthetic graph needed for T3. |
| 2026-06-27 | T1 | Write-set assumption HOLDS — proceed | No `src/layout/pack/**` or `twopi/**` change needed; pack module works in points already. `writeSetAssumptionBroken: false`. |
