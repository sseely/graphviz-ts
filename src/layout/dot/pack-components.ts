// SPDX-License-Identifier: EPL-2.0

/**
 * Multi-component `pack` branch for the dot engine — the body of C's `doDot`
 * (dotinit.c:doDot ≈437-500) for the case where `pack`/`packmode` is set and the
 * graph has more than one connected component. Each component is laid out
 * independently (everything in the dot pipeline except the final coordinate
 * rotation/translation), then polyomino-packed via the shared pack module; the
 * root graph is rotated/translated once by `gvPostprocess` afterwards.
 *
 * The port's pack ops run in points on `n.info.coord` (see pack/index.ts
 * shiftOneGraph), so C's `attachPos`/`resetCoord` (which copy point coords to
 * inches in `ND_pos` for the pack library and back) are NOT needed.
 *
 * Split out of index.ts per ADR-1 (keeps both files under the size/complexity
 * caps and mirrors C's function boundaries: CLAUDE.md — the C source is the spec).
 *
 * @see lib/dotgen/dotinit.c:doDot
 * @see lib/dotgen/dotinit.c:initSubg
 * @see lib/dotgen/dotinit.c:copyClusterInfo
 */

import type { Graph } from '../../model/graph.js';
import type { Point } from '../../model/geom.js';
import type { PackInfo } from '../pack/index.js';
import { packSubgraphs } from '../pack/index.js';
import { dotGraphInit } from './init.js';
import { dotPhaseInit, dotPhasePostNoFinish } from './index.js';
import { dotRank, isACluster } from './rank.js';
import { dotMincross } from './mincross.js';
import { dotPosition } from './position.js';
import { gvPostprocess } from '../../common/postproc.js';
import { mapArrowOpPoints } from '../../common/arrows-shapes-util.js';
import type { ArrowDrawOp } from '../../common/arrows-types.js';

// ---------------------------------------------------------------------------
// ratioIsNone — port of the `GD_drawing(g)->ratio_kind == R_NONE` guard
// @see lib/dotgen/dotinit.c:472, lib/common/input.c:576 setRatio
// ---------------------------------------------------------------------------

/**
 * True when the graph has no meaningful `ratio` attribute, i.e. C's
 * `ratio_kind == R_NONE`. The pack branch only fires for R_NONE; any other
 * ratio (auto/compress/expand/fill or a positive numeric R_VALUE) falls back to
 * whole-graph layout in `doDot`.
 *
 * Read from the `ratio` attr directly (mirroring C's setRatio) rather than from
 * `g.info.drawing`, which the port only populates for `ratio=compress` (ADR-1):
 * fill/expand/value/auto would otherwise leave `drawing` undefined and wrongly
 * activate packing.
 *
 * @see lib/common/input.c:576 setRatio
 */
export function ratioIsNone(g: Graph): boolean {
  const p = g.attrs.get('ratio');
  if (!p || p === '') return true;
  if (p === 'auto' || p === 'compress' || p === 'expand' || p === 'fill') return false;
  return !(Number.parseFloat(p) > 0);
}

// ---------------------------------------------------------------------------
// graphHasCluster — does the graph (recursively) contain a cluster subgraph?
// ---------------------------------------------------------------------------

/**
 * True if `g` contains any cluster subgraph at any depth. Used to scope the
 * pack branch to the cluster-free path in T2: a clustered multi-component graph
 * needs `cccomps` to project each component's cluster tree plus `copyCluster`/
 * `copyClusterInfo` to carry it back (T3). Until that is ported, such graphs
 * fall back to whole-graph `dotLayoutPipeline` so they are not regressed. T3
 * removes this guard and handles clustered graphs in the pack branch.
 *
 * @see lib/pack/ccomps.c:cccomps (cluster-carrying decomposition — T3)
 */
export function graphHasCluster(g: Graph): boolean {
  for (const sg of g.subgraphs.values()) {
    if (isACluster(sg) || graphHasCluster(sg)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// initSubg — seed a component subgraph's drawing-info from the root
// @see lib/dotgen/dotinit.c:initSubg (344-355)
// ---------------------------------------------------------------------------

/**
 * Override a component subgraph's drawing-info fields with the root's parsed
 * values. `buildSubgraph` (shared pack module) gives each component an empty
 * `attrs` Map, so `dotGraphInit(sg)` derives defaults rather than the root's
 * explicit `rankdir`/`nodesep`/`ranksep` — initSubg copies them from the root so
 * the component ranks/positions exactly as it would inside the whole graph.
 *
 * Ordering (per T1): run `dotGraphInit(sg)` first, then initSubg to override.
 * `GD_drawing` quantum/dpi are only material for `ratio=compress`, which never
 * reaches the pack branch (ratioIsNone excludes it), so `drawing` is not copied.
 *
 * @see lib/dotgen/dotinit.c:initSubg
 */
export function initSubg(sg: Graph, root: Graph): void {
  sg.info.nodesep = root.info.nodesep;
  sg.info.ranksep = root.info.ranksep;
  sg.info.rankdir = root.info.rankdir;
  sg.info.flip = root.info.flip;
  sg.info.concentrate = root.info.concentrate;
}

// ---------------------------------------------------------------------------
// dotLayoutComponent — C's static dotLayout(sg) WITHOUT gvPostprocess
// @see lib/dotgen/dotinit.c:dotLayout (static), called per component in doDot
// ---------------------------------------------------------------------------

/**
 * Lay out one connected component fully (rank → mincross → position →
 * splines), but WITHOUT the final `gvPostprocess` rotation/translation: in C
 * the per-component `dotLayout` does not call `dotneato_postprocess`; that runs
 * once on the root after packing (`dot_layout`). Running it per component would
 * rotate each component by rankdir and then the root pass would double-rotate.
 *
 * `dotPhaseInit(sg)` runs first (sets sg.info defaults from the empty attr map);
 * `initSubg(sg, root)` then overrides the inheritance-sensitive fields before
 * ranking reads them. Node sizing in `dotPhaseInit` reads `sg.root.info.flip`
 * (the real root), so it is correct regardless of this ordering.
 *
 * @see lib/dotgen/dotinit.c:dotLayout (static)
 */
export function dotLayoutComponent(sg: Graph, root: Graph): void {
  // C: dotLayout(sg) begins with dot_init_subg(sg, sg), which sets
  // GD_dotroot(agroot(sg)) = sg so dot_root() returns the COMPONENT during its
  // layout (so mincross/position treat it as their root, not as a cluster).
  // The shared `buildSubgraph` set dotroot to the true root; override it here so
  // dotRoot(sg) === sg. @see lib/dotgen/dotinit.c:dot_init_subg (g == droot).
  sg.info.dotroot = sg;
  dotPhaseInit(sg);
  initSubg(sg, root);
  // C sets GD_has_labels on `agraphof(e)` — the true ROOT — never on the
  // component (common_init_edge). So a component's own dotLayout reads
  // GD_has_labels(sg) == 0: edgelabelRanks does NOT double its ranks, and its
  // edge labels get no rank node and are left unplaced (dot effectively drops
  // edge labels inside packed components). The port's edge-label init set the
  // flag on the component instead; clear it so the component matches C — no
  // rank doubling and no label placement. (We intentionally do NOT propagate it
  // to `root`: the port pre-computes arrowhead draw-ops during routing, and the
  // root-flag label-placement path mishandles a label with no rank node,
  // mis-parking the arrowhead. C regenerates arrows at render time and is
  // immune; leaving root's flag clear reproduces C's output.)
  // @see lib/common/utils.c:common_init_edge (GD_has_labels(agraphof(e)))
  // @see lib/dotgen/rank.c:edgelabel_ranks
  sg.info.has_labels = 0;
  dotRank(sg);
  dotMincross(sg);
  dotPosition(sg);
  dotPhasePostNoFinish(sg);
}

// ---------------------------------------------------------------------------
// copyClusterInfo — carry component cluster trees back to the root
// @see lib/dotgen/dotinit.c:copyClusterInfo (412)
// ---------------------------------------------------------------------------

/**
 * Copy the cluster tree and per-cluster drawing-info from each laid-out
 * component back to the root graph, so the root's `gvPostprocess` rotates the
 * cluster bounding boxes and the renderer draws them.
 *
 * T2 ports the cluster-free path only (corpus 2458 has no clusters): components
 * built by `cccomps` carry no cluster subgraphs (`n_cluster == 0`), so there is
 * nothing to copy. The full `copyCluster`/`mapClust` tree-copy for clustered
 * multi-component graphs is ported in T3.
 *
 * @see lib/dotgen/dotinit.c:copyClusterInfo
 */
export function copyClusterInfo(comps: Graph[], root: Graph): void {
  let nclust = 0;
  for (const sg of comps) nclust += sg.info.n_cluster ?? 0;
  // C: GD_n_cluster(root) = nclust; GD_clust(root) = calloc(nclust+1).
  root.info.n_cluster = nclust;
  if (nclust === 0) return;
  // T3: port copyCluster/mapClust to populate root.info.clust here.
}

// ---------------------------------------------------------------------------
// Pre-computed-arrowhead shift compensation (port-only)
// ---------------------------------------------------------------------------

/** First real node's coord in g, or null if g has no positioned node. */
function witnessCoord(g: Graph): Point | null {
  for (const n of g.nodes.values()) {
    if (n.info.coord !== undefined) return n.info.coord;
  }
  return null;
}

/** Translate one edge's pre-computed head/tail arrow draw-ops by (dx, dy). */
function shiftEdgeArrowOps(ops: ArrowDrawOp[] | undefined, dx: number, dy: number): ArrowDrawOp[] | undefined {
  if (!ops) return ops;
  return ops.map((op) => mapArrowOpPoints(op, (p) => ({ x: p.x + dx, y: p.y + dy })));
}

/**
 * Translate every component's pre-computed arrow draw-ops by the rigid packing
 * delta the pack shift applied to that component.
 *
 * The port pre-computes arrowhead draw-ops during routing (a deviation: C
 * regenerates them at render time from the final spline). The shared pack
 * module's `shiftEdge` shifts the spline points (which C also shifts) but not
 * these port-only ops, so after packing the arrowheads lag the splines by the
 * pack delta and `gvPostprocess` then maps them to the wrong place. twopi is
 * immune because it routes splines AFTER packing; the dot pack branch routes
 * before. Rather than touch the pack module (ADR-3), compensate here: each
 * component is shifted rigidly, so a single witness node gives the delta.
 *
 * @see lib/pack/pack.c:shiftEdge (shifts ED_spl only)
 * @see lib/common/postproc.c:map_edge (C regenerates arrows at render time)
 */
function shiftComponentArrowOps(comps: Graph[], before: (Point | null)[]): void {
  comps.forEach((sg, i) => {
    const b = before[i];
    const a = witnessCoord(sg);
    if (!b || !a) return;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    if (dx === 0 && dy === 0) return;
    for (const e of sg.edges) {
      e.info.headArrowOps = shiftEdgeArrowOps(e.info.headArrowOps, dx, dy);
      e.info.tailArrowOps = shiftEdgeArrowOps(e.info.tailArrowOps, dx, dy);
    }
  });
}

// ---------------------------------------------------------------------------
// layoutAndPack — the R_NONE multi-component arm of doDot
// @see lib/dotgen/dotinit.c:doDot (R_NONE branch, ≈476-486)
// ---------------------------------------------------------------------------

/**
 * Lay out each component independently, polyomino-pack them, carry cluster info
 * back to the root, and run the single root-level `gvPostprocess`.
 *
 * The root must carry its own drawing-info (rankdir/nodesep/ranksep/label) for
 * `initSubg` to read and for `gvPostprocess` to rotate by: in C the root's
 * `graph_init` ran before `doDot`; the port has no separate pre-layout
 * graph_init, so `dotGraphInit(root)` is run here once. The root bbox is set by
 * `packSubgraphs` (→ computeSubgraphBB); the root is never re-ranked.
 *
 * @see lib/dotgen/dotinit.c:doDot
 * @see lib/dotgen/dotinit.c:dot_layout (dotneato_postprocess on root)
 */
export function layoutAndPack(root: Graph, comps: Graph[], pinfo: PackInfo): void {
  // Seed the root's drawing-info (C: graph_init before doDot set GD_rankdir2 etc).
  dotGraphInit(root);
  // C: for each component { initSubg(sg, g); dotLayout(sg); }
  for (const sg of comps) dotLayoutComponent(sg, root);
  // Snapshot a witness coord per component so the rigid pack delta can be
  // recovered to fix the port's pre-computed arrow ops (see below).
  const before = comps.map(witnessCoord);
  // C: attachPos(g) [points: unneeded]; packSubgraphs(ncc, ccs, g, &pinfo);
  //    resetCoord(g) [points: unneeded];
  packSubgraphs(comps.length, comps, root, pinfo);
  // Port-only: shift pre-computed arrow draw-ops by the same pack delta the
  // pack module applied to the splines (it does not know about these ops).
  shiftComponentArrowOps(comps, before);
  // C: copyClusterInfo(ncc, ccs, g) — cluster carry-back (T3; no-op when cluster-free).
  copyClusterInfo(comps, root);
  // C dot_layout: dotneato_postprocess(g) once on the root after doDot returns.
  gvPostprocess(root);
}
