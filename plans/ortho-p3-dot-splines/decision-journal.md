# Decision Journal — ortho-p3-dot-splines

| When | Task | Decision / Event | Rationale |
|------|------|------------------|-----------|
| 2026-06-18 | setup | Branched `feature/ortho-p3-dot-splines` off `feature/ortho-p2-render-pipeline` HEAD, NOT off `main`. | P2 is not merged to main; main lacks the P2 pipeline fixes (partition drand48/perp/reachability, sgraph createSEdge index-assign) that P3's dispatch depends on. Brief's "off main, after P2 merges" assumed P2 was merged. Lineage main→P2→P3 preserved once P2 merges. Same call as P2-off-P1. |
| 2026-06-18 | setup | Plan: T1 dot dispatch + adapter (no labels) → T2 edge-label positioning → T3 goldens vs native C. Sequential (T2/T3 build on T1). Doing inline (orchestrator), not delegated — faithful dispatch port + C-oracle goldens, consistent with P1/P2 execution. | ADR-5 faithful dispatch; C-oracle validation needs tight cross-referencing. |
| 2026-06-18 | T1 | Created dot-local `ortho-adapter.ts` (buildOrthoGraph/installOrthoResult/dispatchOrthoEdges) mirroring neato `OrthoHelper` (ADR-1); reused `clipAndInstall` (common/splines-clip) + `buildDotSinfo` with ignoreSwap/isOrtho=true (C ortho sinfo, ortho.c:attachOrthoEdges). Node bb from coord±(lw,rw,ht/2). | ADR-1: dot owns its install context; zero neato churn. |
| 2026-06-18 | T1 | Ported `resetRW` (dotsplines.c:187) into splines.ts: swap rw↔mval when `n.info.other.list` non-empty (C `if (ND_other(n).list)` ≡ list allocated = has entries; TS pre-inits other to {list:[],size:0}, so test list.length>0). | Faithful; mostly no-op without loop/label vnodes. |
| 2026-06-18 | T1 | Added EDGETYPE_ORTHO branch in `dotSplines_` after the EDGETYPE_NONE check, before markLowclusters (dotsplines.c:251-259): resetRW → dispatchOrthoEdges(g,false) → edgeLabelsDone=true → return 0. TS has no routesplinesterm (deferred), so early return satisfies C's "skip routesplinesterm" (dotsplines.c:461). Extracted `orthoDispatch(g)` helper to keep dotSplines_ ≤30 lines (CCN cap). | ADR-5 byte-faithful control flow; complexity hook. |
| 2026-06-18 | T1 | **DONE.** `ortho-dispatch.test.ts` (5 tests: orthogonal spline installed (1 distinct x, >1 y — not diagonal); edgeLabelsDone+return 0; non-ortho NONE/SPLINE unaffected; determinism; resetRW swap). Gates: typecheck 0 · full suite 1931 (1926 + 5 new; no baseline/golden regression, ADR-4 ok) · build OK · C tree clean. | Dispatch wired; consumes P2's pinned pipeline. |
| 2026-06-18 | T2 | `setEdgeLabelPos` already existed in splines-label.ts (handles posAlg flat-edge + regular vnode cases) but omitted C's per-label `updateBB(g,l)` (dotsplines.c:216). Added it; the fn had NO callers, so zero risk to existing output. | Faithful completion; ADR-2 (position only). |
| 2026-06-18 | T2 | `orthoDispatch` now mirrors dotsplines.c:253-257: `if (g.root.has_labels & EDGE_LABEL) { setEdgeLabelPos(g); orthoEdges(g,true) } else orthoEdges(g,false)`. orthoEdges itself warns + downgrades useLbls (ortho/index.ts) — NO edge-around-label routing added (ADR-2; C lacks it). | Faithful warn+downgrade; labels positioned, not routed around. |
| 2026-06-18 | T2 | **DONE.** `ortho-labels.test.ts` (3 tests: label positioned (set=true, pos.y=vnode coord) + warning emitted + orthogonal spl; route geometry identical with/without label (NO rerouting — C parity); no-label case = no warn/no placement). Gates: typecheck 0 · full suite 1934 (1931 + 3 new; baseline unchanged) · build OK · C tree clean. | ADR-2 verified: edges cross labels exactly as native dot. |
| 2026-06-18 | T3 | Minted 4 native-C refs via gvmine (rebuilt clean dot plugin first — C tree was clean, so plugin has no instrumentation): dot-ortho-{chain,branch,multirank,label}. Fixtures + manifest entries (deterministic class) added. | ADR-3 SVG-golden bar; oracle = native dot. |
| 2026-06-18 | T3 | **Divergence (all 4 goldens): edge bezier CONTROL POINTS.** TS interpolated them (De Casteljau resample, e.g. -136.55) where C keeps them at the segment endpoints (degenerate straight, -143.83). Nodes + start point matched; rendered LINE was identical — pure representation diff. NOT pipeline (P2 pinned) and NOT dot-dispatch: root cause is a SHARED-CLIP faithful gap. | Localized via direct TS-vs-C path diff; ADR-3 drill. |
| 2026-06-18 | T3 | **Faithful fix (root cause): ported `arrowOrthoClip`** (arrows.c:350) into `src/common/splines-clip.ts` and gated `arrowClip` on `info.isOrtho` (splines.c:90). For axis-aligned segments it shortens the arrowed end ALONG the axis and rewrites control points to the degenerate form (P0=P1, P2=P3), keeping the Bézier axis-aligned. TS previously used only the non-ortho De-Casteljau arrowStart/EndClip. | C has a dedicated isOrtho arrow clip; TS lacked it. |
| 2026-06-18 | T3 | **WRITE-SET EXPANSION (flagged):** the fix is in `src/common/splines-clip.ts`, outside T3's stated `src/layout/dot/*` scope. Justified: it's a shared-clip faithful-port gap (not dispatch/adapter, not the P2 pipeline), `info.isOrtho`-gated so non-ortho is provably unaffected (all 119 pre-existing goldens byte-identical). Also hardens neato's existing ortho dispatch (it shares clipAndInstall). Same faithfulness-over-scope pattern the user authorized in P2 (sgraph.ts). | User mandate: match C exactly; ADR-4 regression sub-gate satisfied. |
| 2026-06-18 | T3 | **DONE.** 4 ortho goldens pass vs native C. Updated the manifest-count guard 119→123 (suite.test.ts). Gates: typecheck 0 · full suite 1938 (1934 + 4 goldens; ALL 119 non-ortho refs byte-identical — no regression, ADR-4 ok) · build OK · C tree clean. | Full splines=ortho render now matches native dot end-to-end. |

## Mission summary (2026-06-18)

**Status: COMPLETE.** `splines=ortho` now renders correctly under the default
`dot` engine, matching native C `dot -Tsvg` for 4 goldens (chain, branch,
multirank-skip, label). Final slice of DOT-8 done.

**Tasks completed: 3/3** (T1 dispatch+adapter+resetRW, T2 edge-label
positioning, T3 goldens+validation).

**Faithful fixes / ports:**
1. T1 — `ortho-adapter.ts` (dot-local, ADR-1) + EDGETYPE_ORTHO dispatch branch
   in `dotSplines_` (dotsplines.c:251-259) + `resetRW` (dotsplines.c:187).
2. T2 — completed `setEdgeLabelPos` with C's per-label `updateBB`; label
   sub-case dispatches `orthoEdges(g,true)` (warn+downgrade, no routing around
   labels — ADR-2).
3. T3 — ported **`arrowOrthoClip`** (arrows.c:350) into `src/common/splines-clip.ts`,
   `isOrtho`-gated (splines.c:90); fixed the edge-bezier control-point
   representation (degenerate axis-aligned, matching C).

**Decisions flagged for review:**
- Branched off the unmerged P2 branch (P2 carries the pinned pipeline + fixes
  P3 depends on), not `main`. Merge P1→P2→main in order.
- Write-set expanded to `src/common/splines-clip.ts` (T3 arrowOrthoClip) and
  `src/layout/dot/splines-label.ts` (T2 updateBB) beyond the per-task write-set,
  under the faithfulness mandate; both `isOrtho`/caller-gated, zero non-ortho
  impact (verified: 119 pre-existing goldens byte-identical).

**Quality gates (final):** typecheck 0 · `npm test` 1938 passed (1926 inherited
+ 12 new: 5 dispatch, 3 labels, 4 goldens; manifest-count guard updated) ·
build OK · C tree clean · no existing non-ortho golden changed.

**Known issues / follow-ups:** none blocking. `arrowOrthoClip` also benefits
neato's existing ortho dispatch (shared `clipAndInstall`). Commits: T1
`6974f93`, T2 `8afabe5`, T3 (this).
