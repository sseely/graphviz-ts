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
import type { Node } from '../../model/node.js';
import type { Point, Box } from '../../model/geom.js';
import type { PackInfo } from '../pack/index.js';
import {
  buildSubgraph, shiftGraphs, computeSubgraphBB, PackMode, PK_USER_VALS,
} from '../pack/index.js';
import { polyGraphs } from '../pack/poly-place.js';
import { arrayRects } from '../pack/array-pack.js';
import { agsubg } from '../../model/cgraph-ops.js';
import { nodesInSeq } from './decomp.js';
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
// Cluster-aware connected-component decomposition (C cccomps + projectG)
// @see lib/pack/ccomps.c:cccomps / projectG / subgInduce / mapClust
// ---------------------------------------------------------------------------

/** Union-find find-with-path-compression over node names. */
function ufFindName(parent: Map<string, string>, x: string): string {
  let r = x;
  while (parent.get(r) !== r) r = parent.get(r)!;
  let c = x;
  while (parent.get(c) !== r) { const n = parent.get(c)!; parent.set(c, r); c = n; }
  return r;
}

/** Union the classes of names a and b. */
function ufUnionName(parent: Map<string, string>, a: string, b: string): void {
  const ra = ufFindName(parent, a);
  const rb = ufFindName(parent, b);
  if (ra !== rb) parent.set(ra, rb);
}

/** Collect every cluster subgraph under g, at any depth. */
function collectClusters(g: Graph, out: Graph[]): void {
  for (const sg of g.subgraphs.values()) {
    if (isACluster(sg)) out.push(sg);
    collectClusters(sg, out);
  }
}

/**
 * Project one root subgraph `sub` onto component-or-clone `target`: if any of
 * `sub`'s nodes are members of `target`, create a clone subgraph of `target`
 * carrying those nodes and a copy of `sub`'s attributes, and (for clusters)
 * record the clone→original mapping in `origOf`. Mirrors C's `projectG`.
 * @see lib/pack/ccomps.c:projectG
 */
function projectOne(sub: Graph, target: Graph, comp: Graph, origOf: Map<Graph, Graph>): Graph | null {
  let proj: Graph | null = null;
  for (const n of nodesInSeq(sub)) {
    if (target.nodes.get(n.name) !== n) continue;
    if (proj === null) {
      proj = agsubg(target, sub.name, true)!;
      proj.attrs = new Map(sub.attrs); // C: agcopyattr(subg, proj)
      // C stores GD_dotroot on the shared agroot, so dot_root() resolves to the
      // COMPONENT being laid out for every subgraph under it. The port's dotRoot
      // reads per-graph info.dotroot (falling back to the true root), so set it
      // to the component here — else cluster mincross (merge_ranks → dotRoot)
      // reads the empty true-root rank array. @see lib/dotgen/dotinit.c:dot_init_subg
      proj.info.dotroot = comp;
    }
    proj.nodes.set(n.name, n);
  }
  if (proj !== null && isACluster(proj)) origOf.set(proj, sub); // C: ORIG_REC
  return proj;
}

/**
 * Recursively project all subgraphs of `origParent` (clusters AND rank=same
 * sets) into `target`, so `dotLayoutPipeline(component)` rediscovers the cluster
 * tree and same-rank sets via `collapseSets`. `comp` is the component being laid
 * out (the dot-root every clone must resolve to). Mirrors C's `subgInduce`.
 * @see lib/pack/ccomps.c:subgInduce
 */
function projectSubgraphs(origParent: Graph, target: Graph, comp: Graph, origOf: Map<Graph, Graph>): void {
  for (const sub of origParent.subgraphs.values()) {
    const proj = projectOne(sub, target, comp, origOf);
    if (proj !== null) projectSubgraphs(sub, proj, comp, origOf);
  }
}

/**
 * Decompose `root` into "connected" components where nodes are connected by an
 * edge OR by sharing a cluster (C's cluster-aware `cccomps`: cluster members
 * stay in one component even with no edge between them). Each component carries
 * a projected clone of every cluster/same-rank subgraph it owns; `origOf` maps
 * each cluster clone back to its original root cluster (C's `mapClust`).
 * @see lib/pack/ccomps.c:cccomps
 */
export function cccompsWithClusters(root: Graph): { comps: Graph[]; origOf: Map<Graph, Graph> } {
  const parent = new Map<string, string>();
  for (const n of nodesInSeq(root)) parent.set(n.name, n.name);
  for (const e of root.edges) ufUnionName(parent, e.tail.name, e.head.name);
  const clusters: Graph[] = [];
  collectClusters(root, clusters);
  for (const cl of clusters) {
    let prev: string | undefined;
    for (const n of cl.nodes.values()) {
      if (prev !== undefined) ufUnionName(parent, prev, n.name);
      prev = n.name;
    }
  }
  const groups = new Map<string, Node[]>();
  for (const n of nodesInSeq(root)) {
    const r = ufFindName(parent, n.name);
    const g = groups.get(r);
    if (g) g.push(n); else groups.set(r, [n]);
  }
  const origOf = new Map<Graph, Graph>();
  const comps: Graph[] = [];
  let idx = 0;
  for (const nodes of groups.values()) {
    const comp = buildSubgraph(root, nodes, `_cc_${idx++}`);
    projectSubgraphs(root, comp, comp, origOf); // C: subGInduce(g, out)
    comps.push(comp);
  }
  return { comps, origOf };
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
  // C sets GD_has_labels on `agraphof(agtail(e))` — the true ROOT — never on the
  // component (common_init_edge). So a component's own dotLayout reads
  // GD_has_labels(sg) == 0, and `edgelabel_ranks` (rank.c:170 — the ONE reader C
  // scopes to the layout graph) does NOT double the component's ranks. Keep that
  // invariant explicit here.
  //
  // Every OTHER dotgen reader is scoped to `g->root` (position.c:234
  // make_LR_constraints, dotsplines.c:243/1552/1650/1776), so under pack C still
  // sees EDGE_LABEL via the root and takes the edge-label branch for each
  // component — most visibly `sep[1] = 5` for odd-rank node separation. The port
  // used to set the flag on the component and never on the root, so those
  // `g->root` readers all took the wrong branch; `edge-label-init` now ORs onto
  // `g.root` as C does, and the readers were corrected to `g.root`.
  // @see lib/common/utils.c:common_init_edge (GD_has_labels(agraphof(agtail(e))))
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

/** Map a cluster clone back to its original root cluster. C's `mapClust`. */
function mapClust(clone: Graph, origOf: Map<Graph, Graph>): Graph {
  const orig = origOf.get(clone);
  if (orig === undefined) throw new Error(`mapClust: no original for cluster ${clone.name}`);
  return orig;
}

/**
 * Copy one laid-out cluster clone `scl`'s drawing-info onto the original
 * cluster `cl` (bb, label position, border, nested cluster tree, label), then
 * recurse into nested clusters. The label is transferred (cleared on the
 * clone), exactly as C does.
 * @see lib/dotgen/dotinit.c:copyCluster
 */
function copyCluster(scl: Graph, cl: Graph, origOf: Map<Graph, Graph>): void {
  cl.info.bb = scl.info.bb;
  cl.info.label_pos = scl.info.label_pos;
  if (scl.info.border !== undefined) {
    cl.info.border = [...scl.info.border] as [Point, Point, Point, Point];
  }
  const nclust = scl.info.n_cluster ?? 0;
  cl.info.n_cluster = nclust;
  cl.info.clust = [];
  for (let j = 1; j <= nclust; j++) {
    const childClone = scl.info.clust![j - 1];
    const childOrig = mapClust(childClone, origOf);
    cl.info.clust[j - 1] = childOrig;
    copyCluster(childClone, childOrig, origOf);
  }
  cl.info.label = scl.info.label;
  scl.info.label = undefined; // C: GD_label(scl) = NULL
}

/**
 * Copy the cluster tree and per-cluster drawing-info from each laid-out
 * component back to the root, so the root's `gvPostprocess` rotates the cluster
 * bounding boxes and the renderer (which reads `GD_clust(root)`) draws them at
 * their packed positions.
 *
 * @see lib/dotgen/dotinit.c:copyClusterInfo
 */
export function copyClusterInfo(comps: Graph[], root: Graph, origOf: Map<Graph, Graph>): void {
  let nclust = 0;
  for (const sg of comps) nclust += sg.info.n_cluster ?? 0;
  // C: GD_n_cluster(root) = nclust; GD_clust(root) = calloc(nclust+1).
  root.info.n_cluster = nclust;
  root.info.clust = [];
  let idx = 0;
  for (const sg of comps) {
    const nc = sg.info.n_cluster ?? 0;
    for (let j = 1; j <= nc; j++) {
      const clone = sg.info.clust![j - 1];
      const orig = mapClust(clone, origOf);
      root.info.clust[idx++] = orig;
      copyCluster(clone, orig, origOf);
    }
  }
}

// ---------------------------------------------------------------------------
// Pre-computed-arrowhead shift compensation (port-only)
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Cluster-inclusive root bbox (so gvPostprocess translates cluster boxes in)
// ---------------------------------------------------------------------------

/**
 * Union a bbox with every top-level cluster boundary box of `g` (each already
 * including its nested clusters). `computeSubgraphBB` is node-only, so a packed
 * graph's bbox omits the cluster-boundary extent (the cluster margin); unioning
 * it in is needed both for the per-component pack rectangle (correct spacing)
 * and for the root translation (else cluster boxes clip outside the viewport).
 * No extra margin is added: native pack mode draws the outermost cluster flush
 * with the drawing origin, unlike the non-pack path's graph margin.
 */
function unionWithClusterBBs(bb: Box, g: Graph): Box {
  let llx = bb.ll.x; let lly = bb.ll.y;
  let urx = bb.ur.x; let ury = bb.ur.y;
  const nClust = g.info.n_cluster ?? 0;
  const clust = g.info.clust;
  for (let c = 0; c < nClust; c++) {
    const cb = clust?.[c]?.info.bb;
    if (!cb) continue;
    llx = Math.min(llx, cb.ll.x);
    lly = Math.min(lly, cb.ll.y);
    urx = Math.max(urx, cb.ur.x);
    ury = Math.max(ury, cb.ur.y);
  }
  return { ll: { x: llx, y: lly }, ur: { x: urx, y: ury } };
}

/** Cluster-inclusive bbox of a laid-out component (node bbox ∪ its cluster bbs). */
function clusterInclusiveBB(g: Graph): Box {
  return unionWithClusterBBs(computeSubgraphBB(g, 0), g);
}

/** Expand the packed root bbox to enclose its cluster boundary boxes. */
function expandRootBbForClusters(root: Graph): void {
  if (root.info.bb) root.info.bb = unionWithClusterBBs(root.info.bb, root);
}

/**
 * Pack the components using CLUSTER-INCLUSIVE bounding boxes, then update the
 * root bbox — a cluster-aware `packSubgraphs`. The shared pack module's
 * `putGraphs` uses node-only `computeSubgraphBB`, so adjacent clustered
 * components would be spaced as if the cluster boundaries weren't there
 * (packed too close / mis-aligned). We compute the placement here with
 * cluster-inclusive rectangles (`genBox`/`arrayRects` place by bbox, and the
 * shift delta is `grid − bb.ll`, so a larger bbox spaces correctly) and shift
 * via the pack module's own `shiftGraphs`. The pack module is not modified
 * (ADR-3); only its primitives are reused.
 *
 * @see lib/pack/pack.c:putGraphs / packGraphs / packSubgraphs
 */
function packComponentsClusterAware(root: Graph, comps: Graph[], pinfo: PackInfo): void {
  const bbs = comps.map(clusterInclusiveBB);
  comps.forEach((g, i) => { g.info.bb = bbs[i]; });
  let pts: Point[] | null = null;
  if (pinfo.mode <= PackMode.Graph) {
    pts = polyGraphs(comps, root, pinfo, bbs);
  } else if (pinfo.mode === PackMode.Array) {
    if (pinfo.flags & PK_USER_VALS) {
      pinfo.vals = comps.map((g) => {
        const v = parseInt(g.attrs.get('sortv') ?? '', 10);
        return !Number.isNaN(v) && v >= 0 ? v : 0;
      });
    }
    pts = arrayRects(comps.length, bbs, pinfo);
  }
  if (pts) shiftGraphs(comps.length, comps, pts, root, pinfo.doSplines);
  // C packSubgraphs: GD_bb(root) = compute_bb(root); expanded for clusters below.
  root.info.bb = computeSubgraphBB(root, 0);
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
export function layoutAndPack(
  root: Graph, comps: Graph[], pinfo: PackInfo, origOf: Map<Graph, Graph>,
): void {
  // Seed the root's drawing-info (C: graph_init before doDot set GD_rankdir2 etc).
  dotGraphInit(root);
  // C: for each component { initSubg(sg, g); dotLayout(sg); }
  for (const sg of comps) dotLayoutComponent(sg, root);
  // C: attachPos(g) [points: unneeded]; packSubgraphs(ncc, ccs, g, &pinfo);
  //    resetCoord(g) [points: unneeded]. Cluster-inclusive bboxes so packed
  //    clusters get native spacing (the pack module's bbox is node-only).
  // NOTE: the shared pack shiftEdgePoints now carries the pre-computed arrow
  // draw-ops along with the spline, so no separate compensation is needed
  // (shiftComponentArrowOps would double-shift).
  packComponentsClusterAware(root, comps, pinfo);
  // C: copyClusterInfo(ncc, ccs, g) — carry each component's cluster tree back
  // to the root (no-op when cluster-free; root.info.clust drives cluster emit).
  copyClusterInfo(comps, root, origOf);
  // Expand the node-only packed root bbox to enclose the cluster boundary boxes,
  // so gvPostprocess translates them into the viewport (else clusters clip).
  expandRootBbForClusters(root);
  // C dot_layout: dotneato_postprocess(g) once on the root after doDot returns.
  gvPostprocess(root);
}
