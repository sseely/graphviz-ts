## Observation: nshare-root_twopi diverged = dot multi-rank edge-spline routing (NOT twopi)

- **Context**: Pre-mission scouting for `nshare-root_twopi` (parity maxΔ ~21,
  classified `diverged`). Despite the `_twopi` name, the corpus manifest renders
  it with **engine: dot** (`test/corpus/corpus-manifest.json` id
  `nshare-root_twopi` → `nshare/root_twopi.gv`, `"engine": "dot"`). The `_twopi`
  is just the source filename.
- **Finding**: Source is a large pre-laid-out tree (1054 nodes, 1083 edges,
  `bb=` set, `root="189E"`, `ranksep=3`). Node geometry is **exact** (1054/1054,
  0.00) and SVG element-type counts are **identical** oracle↔port (710 ellipse,
  2139 g, 1083 path, 1064 polygon, 1764 text). The divergence is purely
  **edge-spline routing**, dominated by two edges:
    - `311E->312E` — **21.08pt** (the parity maxΔ). Same point count (7).
      Diverges in the FIRST bezier segment near `311E` (start 585.88 vs 583.86;
      first ctrl 504.71 vs 485.04 ≈ 20pt), then converges to identical control
      points after `36104.59,-464.8`. `[arrowhead=none]`, grey node.
    - `280->586E` — **structural**: oracle 4 control points (1 bezier), port 7
      (2 beziers); port adds a segment. `[arrowhead=dot]`, grey `586E` node.
  Plus ~56 other edges diverging <2pt (likely downstream ripple or independent
  libm/FMA ULP noise — Batch 1 to classify).
- **The `*E` nodes** are grey skeleton nodes of the pre-laid-out tree; both
  dominant edges are multi-rank chain edges (large y-spans).
- **Accepted-divergences caveat**: `accepted-divergences.json` has an entry for
  `nshare-root_twopi` but `scope: "rules"` only (accepted in the rules gate, NOT
  in parity). Its prose ("geometry exact; one edge `@d`") is stale — there is a
  real 21pt geometry edge delta AND a structural 4-vs-7 edge, not "one edge".
  Reconcile this entry + `rules-known-divergences.md` if the fix changes status.
- **Subsystem**: dot multi-rank edge-spline routing. Port: `src/layout/dot/
  edge-route*.ts`, `edge-route-chain.ts`, `splines*.ts`. C spec:
  `~/git/graphviz/lib/dotgen/{dotsplines.c,splines.c}`. Mechanism UNKNOWN
  (node positions exact, so it's corridor/fitter/routing-order for these chains,
  NOT a vnode-ordering cascade like #1213).
- **Impact**: Diagnosis-first mission, same shape as #1213 (gated Batch 1 →
  fix Batch 2). Target = full ±0.01 conformance for all 58 edges.
- **Confidence**: High (divergence = dot edge splines, 2 dominant edges pinned);
  Medium (exact routing stage / whether the 56 residuals share the cause).
- **Repro**: oracle `GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg
  ~/git/graphviz/tests/nshare/root_twopi.gv`; port `GV_TEXT_MEASURER=estimate
  GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts
  ~/git/graphviz/tests/nshare/root_twopi.gv dot`.
