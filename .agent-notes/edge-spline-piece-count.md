# Edge-spline piece-count divergence under neato/fdp/sfdp

## Observation: neato-family init skipped BOTH halves of C's edge init
- **Context**: `fdp/2168_4` emitted a 4-point bezier where native emits 7
  (`2168`: 8 vs 14). Established as a routing, not a placement, defect.
- **Finding**: two independent misports, both in engine init, both C calls that
  the port simply never made:
  1. C's `setEdgeType(g, defaultValue)` (`lib/common/utils.c:1423`) is a
     FUNCTION that reads `agget(g,"splines")` and uses `defaultValue` only when
     the attr is unset. neato/fdp/sfdp init called the port's *other* symbol,
     `setEdgeType(g, t)` — the C **macro** (`const.h`), which force-writes the
     nibble. Result: `GD_flags & 0xf` was pinned to `EDGETYPE_LINE` for all
     three engines, so `splines=true` / `splines=ortho` were silently ignored
     and every edge took the straight-line fallback. C for `fdp/2168_4` prints
     "Creating edges using splines"; the port routed line segments.
  2. C's `neato_init_edge` / `fdp init_edge` / `sfdp_init_edge` each call
     `common_init_edge(e)` (labels + `chkPort` tailport/headport). The port's
     `commonInitNodeEdge` inits **nodes only**, and none of the three engines
     had an edge pass. So `ED_tail_port`/`ED_head_port` stayed zero:
     `node2:sw` resolved to the node centre, `BOUNDARY_PORT(e)` was always
     false, and neato-family edge labels were never created at all.
- **Impact**: `boundaryPort` gated the `makeMultiSpline` branch, so C routed
  through the triangle router (multi-piece) while the port fell through to
  `makeStraightEdges` (one piece) — the ptCount mismatch. Both fixes are
  required together: the edge type selects the router, the port selects the
  branch inside it.
- **Confidence**: High (instrumented both sides; port probe showed
  `splinesAttr="true" et=1` and `headportAttr="sw"` with a zero port struct,
  while `dot -v -v` showed C chose the spline router).

## Observation: the CDT left/right cavity lists were reversed (GTS prepend)
- **Context**: with the above fixed, `fdp/2168_2` newly reached
  `makeMultiSpline` and threw `findMap: no triangle for segment`.
- **Finding**: GTS's `gts_delaunay_add_constraint` (cdt.c) accumulates the
  cavity edge lists with `g_slist_prepend`, so `left`/`right` are in REVERSE
  walk order; it then passes `reverse(right)` (→ walk order) and `left` as-is
  (→ reverse-walk order) to `triangulate_polygon`. The port accumulates with
  `push` (walk order) but copied C's reversal literally — reversing `right` and
  not `left`. Both cavity rings therefore got the opposite winding, so
  `triangulatePolygon`'s `orient(v1,v2,v3) >= 0` ear test rejected every
  candidate, `if (!found) return` silently bailed, and the cavity was left
  UNFILLED. The constraint edge then belonged to no triangle.
- **Impact**: latent for every constrained edge that cuts **≥2** triangles (with
  one cut triangle each list holds a single edge and the reversal is a no-op —
  which is why it survived the original multispline port). Invisible before,
  because no neato-family graph ever reached the router.
- **Confidence**: High. Probe on the failing constraint (15,16) printed
  `left=[[15,11],[16,11]] right=[[14,15],[16,14]]`; hand-evaluating C's list
  order gives ears `orient(15,16,11)=+52.3` and `orient(16,15,14)=+400.6`
  (both accepted), vs the port's `-400.6` / `-52.3` (both rejected). Fix makes
  `fdp/2168_2` byte-identical to native.

## Not explained by these mechanisms
- Graph-`bb`-only residuals (`neato/2168_3`, `sfdp/2168_3`) — that is commit
  `29d4f0b` (`compute_bb` must expand over edge splines), already on
  `feature/xdot-conformance` but not in this worktree's base. Verified: applying
  only that commit's `src/layout/pack/index.ts` on top of this fix flips both to
  pass. Do not re-fix.
- `fdp/241_0`, `fdp/graphs-radius`: node **positions** already diverge from
  native (port `27,212.09` vs native `27,209.33`) and are byte-identical before
  and after this change — pre-existing fdp iterative drift (A1). Routing is now
  active on top of drifted nodes, which raises the diff COUNT without changing
  the verdict.
- `sfdp/2168`, `sfdp/241_0`, `neato/241_0`, `neato/linux.i386-radius_dot`:
  positions match; a genuine routing residual remains. Separate mechanism.
