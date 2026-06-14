# SCOPE — recon for steering-port routing

Recon performed 2026-06-14 during the parity-edge-ports T6b post-mortem.
Verify every file:line against current code before relying on it.

## The gap, precisely

dot's regular edges are routed by `routeOneEdge` (`src/layout/dot/
edge-route.ts`), called from `dotSplines`/`routeDotEdges`. It builds a
3-box corridor (`buildRankCorridor`) and fits a spline with `computeSpline`
(`edge-route-poly.ts`: `boxesToPolygon` → `shortestPath` → `tryRouteSpline`).
That channel builder assumes a **monotonic** (in y) rank corridor.

A steering port (e.g. `A:n->B` with B below A — tail exits the TOP face,
away from the head) needs a **non-monotonic L-shaped corridor**: up over the
node, around a side, then down. `boxesToPolygon`/`shortestPath` cannot
represent it and the fitter **truncates** — the spline ends above the node
and never reaches the head. Verified vs dot 15.0.0:

| input | dot 15.0.0 | TS routeOneEdge (T6a) |
|-------|-----------|----------------------|
| `A:n->B` | `M27,-109 C27,-121 45,-116 54,-108 … 43,-44` (loops up-and-right to B) | `M27,-108 C27,-108 35,-111 43,-111` — **truncated, never reaches B** |

The simplified fitter is otherwise correct: it reproduces all 115 existing
dot goldens, and T6a (port attachment point + clip-skip, no side boxes)
matches dot for aligned compass + record ports within 0.5pt.

## The faithful path is already ported (and proven)

The real `routesplines` pipeline exists in TS and is used by neato, pack,
and ortho today — but NOT by dot:

| C symbol | TS location |
|----------|-------------|
| `beginpath` (splines.c:378) | `src/common/splines-path-begin.ts:beginPath` |
| `endpath` (splines.c:575) | `src/common/splines-path-end.ts:endPath` |
| `routesplines_` (routespl.c:294) | `src/common/splines-routespl.ts:routeSplines` |
| `checkpath` / `limitBoxes` | `splines-routespl.ts:checkPath` / `limitBoxes` |
| `clip_and_install` / `new_spline` | `src/common/splines-clip.ts:clipAndInstall`/`newSpline` |
| `Proutespline` (pathplan/route.c) | `src/pathplan/route.ts` |
| `Pshortestpath` (pathplan/shortest.c) | `src/pathplan/shortest.ts` |

`src/common/splines.ts` re-exports the whole set. `beginPath`/`endPath`
already include the REGULAREDGE/FLATEDGE side-mask box logic
(`BeginRegSide`/`EndRegSide`) — the very boxes parity-edge-ports T6b ported
by hand into the active router (and reverted because the simplified fitter
could not consume them).

## Two overlapping dot orchestrators (resolve in SR1)

- `edge-route.ts:routeOneEdge` — the ACTIVE router dotSplines calls. Simple.
  Now carries T6a port attachment points.
- `splines-route.ts:makeRegularEdge` — a fuller `make_regular_edge` port,
  but its header says *"Full pathplan routing is deferred until pathplan.ts
  is ported"* and it ALSO calls `buildRankCorridor`+`computeSpline`
  (line ~295). Referenced by `splines.ts`, `splines-flat.ts`,
  `multi-edge.test.ts`. **pathplan IS now ported** — so this is the natural
  home to finish.

SR1 must determine: which orchestrator dotSplines actually drives for each
edge class (regular adjacent, multi-rank chain, flat, self), and whether to
finish `makeRegularEdge` or graft onto `routeOneEdge`.

## The beginPath input contract (the integration cost)

`beginPath({P, e, et, endp, merge, inEdges, outEdges, ranksep, pboxfn})`
needs more than the active router currently threads:

- `P: Path` (boxes accumulator), `endp: PathendT` with **`endp.nb`** (the
  node maximal bbox) and `endp.sidemask` — the active router computes an
  equivalent `tailNb` in `buildRankCorridor` but does not build a `PathendT`.
- `merge` + `inEdges`/`outEdges` — for `concSlope` (the constrained-theta
  multi-edge case). Active router has edge adjacency via node in/out lists.
- `ranksep` — derivable from rank geometry (parity-edge-ports computed a
  proxy `tailBottom - headTop`); confirm the true source
  (`GD_ranksep`/graph attr).
- `pboxfn` — shape port-box function; null for poly nodes (the default path).

Frame note (confirmed, important): the active dot router and C's beginpath
share the **same graphviz-internal y-up frame** (tail.y > head.y, positive;
SVG negation is a later pass). So no coordinate flip is needed when feeding
node geometry into beginPath. (parity-edge-ports T6b verified this.)

## Absorbed from parity-edge-ports T8 (port goldens blocked there)

T8 of parity-edge-ports could not mint C-oracle port goldens, for two
reasons that this mission resolves — so the port goldens land here:

1. **Geometry (the main blocker).** For an UNCLIPPED port edge
   (`port.clip=false`), the simplified fitter's spline control points
   diverge from C's `routesplines` by ~11pt even when the rendered line is
   visually identical (e.g. `A:s->B:n`: endpoints match within 0.06pt but
   the interior cubic controls are `27,-57.94` vs C `27,-55.32`/`-60.62`).
   For a plain (clipped) edge TS matches C exactly — the node clip is what
   renormalizes the controls. Once dot routes ports through `routeSplines`
   (this mission), port control points should match C at deterministic
   tolerance, making compass AND steering port goldens minteable.
2. **Edge `<title>` parity (separable).** `svgBeginEdge`
   (src/render/svg-helpers.ts:190) builds the title from node names only.
   C includes ports and has non-obvious rules — verified vs dot 15.0.0:
   - `A:s->B:n` → `A:s&#45;&gt;B:n` (ports included; **hyphen escaped as
     `&#45;`**, TS currently emits `-&gt;`).
   - `A:f0->B` → `A:f0&#45;&gt;B`; but `A:f0:ne->B` → `A:ne&#45;&gt;B`
     (**compass replaces the field** when both are present — confirm the
     agnameof/port-title rule in C: `lib/cgraph/`).
   This is a small, byte-safe fix (no-port edges have no port attr →
   unchanged) but must match all three quirks; golden it alongside the
   geometry. The T6a attachment-point behavior is already guarded by
   `src/layout/dot/edge-route-port.test.ts` (4 tests).

SR8 mints these port goldens (compass aligned + steering + record/attr +
the title fix) once SR3 lands the faithful routing; verify the title quirks
against the oracle.

## Out of scope (journal as follow-ups if hit)

- neato/fdp/circo/osage edge routing (already on the faithful path).
- The `Proutespline`/`Pshortestpath` numeric internals (treat as a black box;
  FMA/libm divergences follow the `fma.ts` stop precedent).
- HTML-cell ports beyond what parity-edge-ports T7 delivers.
