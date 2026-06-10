// SPDX-License-Identifier: EPL-2.0

/**
 * Osage cluster-packing layout engine.
 *
 * Faithful port of lib/osage/osageinit.c. Arranges clusters and loose
 * nodes by recursively packing bounding rectangles, then routes edges.
 *
 * @see lib/osage/osageinit.c
 * @see lib/osage/osage.h
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Box } from '../../model/geom.js';
import type { LayoutEngine } from '../../gvc/context.js';
import type { PackInfo } from '../pack/index.js';
import {
  PackMode,
  getPackInfo,
  putRects,
  PK_USER_VALS,
} from '../pack/index.js';
import { neatoInitNode } from '../neato/init.js';
import { commonInitNode, layoutMeasurer, lateInt } from '../../common/nodeinit.js';
import { nodeAttr } from '../../common/poly-init.js';
import { splineEdges, EDGETYPE_NONE } from '../neato/splines.js';

// ---------------------------------------------------------------------------
// Constants
// @see lib/osage/osageinit.c
// ---------------------------------------------------------------------------

/** Default bounding-box size (points) for an empty cluster with no label.
 * @see lib/osage/osageinit.c:#define DFLT_SZ 18
 */
const DFLT_SZ = 18;

/**
 * Default margin in points passed to getPackInfo.
 * @see lib/neatogen/adjust.h:DFLT_MARGIN (4 points)
 * @see lib/osage/osageinit.c:layout (DFLT_MARGIN argument to getPackInfo)
 */
const DFLT_MARGIN = 4;

// ---------------------------------------------------------------------------
// PARENT helper
// ---------------------------------------------------------------------------

/**
 * Return the owning cluster for a node, or null if unclaimed.
 *
 * In C this is the PARENT(n) macro: `(Agraph_t*)ND_alg(n)`.
 * Osage repurposes ND_alg to store cluster ownership during layout.
 *
 * @see lib/osage/osageinit.c:#define PARENT(n)
 */
export function PARENT(n: Node): Graph | null {
  if (n.info.alg?.kind === 'osage') {
    return n.info.alg.ownerCluster;
  }
  return null;
}

// ---------------------------------------------------------------------------
// isCluster helper
// ---------------------------------------------------------------------------

/**
 * Return true if the subgraph name starts with "cluster".
 *
 * @see lib/common/utils.c:is_a_cluster
 */
export function isCluster(g: Graph): boolean {
  return g.name.startsWith('cluster');
}

// ---------------------------------------------------------------------------
// clusterInitGraph
// ---------------------------------------------------------------------------

/**
 * Initialize all nodes and edges in the graph for osage layout.
 *
 * Forces 2-D layout (ndim=2), initialises each node with neatoInitNode
 * (sets default width/height in inches), then computes lw/rw/ht in points.
 *
 * @see lib/osage/osageinit.c:cluster_init_graph
 */
export function clusterInitGraph(g: Graph): void {
  g.info.ndim = 2;
  const measurer = layoutMeasurer(g);
  for (const n of g.nodes.values()) {
    neatoInitNode(n, 2);
    if (measurer !== undefined) {
      // C: neato_init_node -> common_init_node + gv_nodesize sizes
      // every node from its label. @see lib/osage/osageinit.c:layout
      commonInitNode(n, g);
      continue;
    }
    const wPts = (n.info.width || 0.75) * 72;
    const hPts = (n.info.height || 0.5) * 72;
    n.info.lw = wPts / 2;
    n.info.rw = wPts / 2;
    n.info.ht = hPts;
  }
}

// ---------------------------------------------------------------------------
// mkClusters helpers
// ---------------------------------------------------------------------------

/**
 * Recursively scan subgraphs of g, appending clusters to clist.
 * Non-cluster subgraphs are transparent — their cluster children are promoted.
 * @see lib/osage/osageinit.c:mkClusters (inner loop)
 */
export function mkClustersInto(
  g: Graph,
  clist: Array<Graph | null>,
  parent: Graph,
): void {
  for (const subg of g.subgraphs.values()) {
    if (isCluster(subg)) {
      subg.info.bb = subg.info.bb ??
        { ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } };
      clist.push(subg);
      mkClusters(subg, null, subg);
    } else {
      mkClusters(subg, clist as Graph[], parent);
    }
  }
}

/**
 * Discover all cluster subgraphs in g and populate GraphInfo.clust /
 * GraphInfo.n_cluster for each cluster found.
 *
 * Non-cluster subgraphs are transparent: their cluster children are
 * promoted to the nearest enclosing cluster ancestor.
 *
 * @see lib/osage/osageinit.c:mkClusters
 */
export function mkClusters(
  g: Graph,
  pclist: Graph[] | null,
  parent: Graph,
): void {
  if (pclist === null) {
    const list: Array<Graph | null> = [null];
    mkClustersInto(g, list, parent);
    const real = list.filter((x): x is Graph => x !== null);
    g.info.n_cluster = real.length;
    if (real.length > 0) g.info.clust = real;
  } else {
    mkClustersInto(g, pclist, parent);
  }
}

// ---------------------------------------------------------------------------
// layout helpers — all exported so Lizard resets CCN at each boundary
// ---------------------------------------------------------------------------

/** Clone a Box (shallow copy of nested points). */
export function cloneBox(b: Box): Box {
  return { ll: { x: b.ll.x, y: b.ll.y }, ur: { x: b.ur.x, y: b.ur.y } };
}

/** Build a PackInfo initialised from graph attributes. @see lib/osage/osageinit.c:layout */
export function buildPackInfo(g: Graph): PackInfo {
  const pinfo: PackInfo = {
    aspect: 1, sz: 0, margin: DFLT_MARGIN,
    doSplines: false, mode: PackMode.Array,
    fixed: null, vals: null, flags: 0,
  };
  getPackInfo(g, PackMode.Array, DFLT_MARGIN, pinfo);
  if (pinfo.mode < PackMode.Graph) pinfo.mode = PackMode.Graph;
  return pinfo;
}

/** Holds the parallel arrays built before calling putRects. */
export interface OsageChildLists {
  gs: Box[];
  childGraphs: Graph[];
  childNodes: Node[];
  vals: number[];
}

/** Append one subcluster to the child lists. @see lib/osage/osageinit.c:layout (sortv via late_int) */
export function addSubcluster(
  lists: OsageChildLists,
  subg: Graph,
  useVals: boolean,
): void {
  lists.gs.push(cloneBox(subg.info.bb));
  lists.childGraphs.push(subg);
  if (useVals) lists.vals.push(lateInt(subg.attrs.get('sortv'), 0, 0));
}

/** Append one loose node to the child lists and claim it for cluster g. */
export function addLooseNode(
  lists: OsageChildLists,
  n: Node,
  g: Graph,
  useVals: boolean,
): void {
  n.info.alg = { kind: 'osage', ownerCluster: g };
  lists.gs.push({
    ll: { x: 0, y: 0 },
    ur: { x: n.info.lw + n.info.rw, y: n.info.ht },
  });
  lists.childNodes.push(n);
  if (useVals) lists.vals.push(lateInt(nodeAttr(n, g, 'sortv'), 0, 0));
}

/** Build the child lists for g's direct children (subclusters + loose nodes). */
export function buildChildLists(
  g: Graph,
  nClust: number,
  nvs: number,
  useVals: boolean,
): OsageChildLists {
  const lists: OsageChildLists = { gs: [], childGraphs: [], childNodes: [], vals: [] };
  for (let i = 1; i <= nClust; i++) {
    addSubcluster(lists, g.info.clust![i - 1], useVals);
  }
  if (g.nodes.size - nvs > 0) {
    for (const n of g.nodes.values()) {
      if (n.info.alg === undefined) addLooseNode(lists, n, g, useVals);
    }
  }
  return lists;
}

/** Raw bounding box accumulator returned by applyOffsets. */
export interface RawBB {
  llx: number; lly: number; urx: number; ury: number;
}

/** Apply putRects translation offsets; return the union bounding box. */
export function applyOffsets(lists: OsageChildLists, pts: Array<{ x: number; y: number }>): RawBB {
  let llx = Infinity, lly = Infinity, urx = -Infinity, ury = -Infinity;
  const ng = lists.childGraphs.length;
  for (let i = 0; i < lists.gs.length; i++) {
    const p = pts[i]!;
    const b = lists.gs[i]!;
    const x0 = b.ll.x + p.x, y0 = b.ll.y + p.y;
    const x1 = b.ur.x + p.x, y1 = b.ur.y + p.y;
    if (x0 < llx) llx = x0;
    if (y0 < lly) lly = y0;
    if (x1 > urx) urx = x1;
    if (y1 > ury) ury = y1;
    if (i < ng) {
      lists.childGraphs[i]!.info.bb = { ll: { x: x0, y: y0 }, ur: { x: x1, y: y1 } };
    } else {
      const nd = lists.childNodes[i - ng]!;
      nd.info.coord = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    }
  }
  return { llx, lly, urx, ury };
}

/** Widen rbb horizontally to fit the graph label (if any). */
export function applyLabelExpansion(g: Graph, total: number, rbb: RawBB): RawBB {
  const labelDim = (g.info.label as { dimen?: { x: number; y: number } } | undefined)?.dimen;
  if (!labelDim) return rbb;
  let { llx, lly, urx, ury } = rbb;
  if (total === 0) return { llx: 0, lly: 0, urx: labelDim.x, ury: labelDim.y };
  const d = labelDim.x - (urx - llx);
  if (d > 0) { llx -= d / 2; urx += d / 2; }
  return { llx, lly, urx, ury };
}

/** Add margin and border padding to rbb. */
export function addMarginAndBorder(g: Graph, margin: number, rbb: RawBB): RawBB {
  let { llx, lly, urx, ury } = rbb;
  const border = g.info.border;
  const bottomY = border ? border[3].y : 0;
  const topY = border ? border[2].y : 0;
  llx -= margin; urx += margin;
  lly -= margin + bottomY; ury += margin + topY;
  return { llx, lly, urx, ury };
}

/** Subtract rbb.ll from all child cluster bbs (translate to origin). */
export function originShiftClusters(childGraphs: Graph[], rbb: RawBB): void {
  const { llx, lly } = rbb;
  for (const sg of childGraphs) {
    const sbb = sg.info.bb;
    sg.info.bb = {
      ll: { x: sbb.ll.x - llx, y: sbb.ll.y - lly },
      ur: { x: sbb.ur.x - llx, y: sbb.ur.y - lly },
    };
  }
}

/** Subtract rbb.ll from all child node coords (translate to origin). */
export function originShiftNodes(childNodes: Node[], rbb: RawBB): void {
  const { llx, lly } = rbb;
  for (const nd of childNodes) {
    nd.info.coord = {
      x: nd.info.coord.x - llx,
      y: nd.info.coord.y - lly,
    };
  }
}

/** Translate all children so the cluster's LL becomes (0,0). */
export function translateToOrigin(lists: OsageChildLists, rbb: RawBB): void {
  originShiftClusters(lists.childGraphs, rbb);
  originShiftNodes(lists.childNodes, rbb);
}

// ---------------------------------------------------------------------------
// osageLayoutRec — split into exported sub-steps for Lizard
// ---------------------------------------------------------------------------

/**
 * Recurse into each direct subcluster; return total node count across them.
 * @see lib/osage/osageinit.c:layout (subcluster recursion)
 */
export function recurseSubclusters(g: Graph, nClust: number, depth: number): number {
  let nvs = 0;
  for (let i = 1; i <= nClust; i++) {
    const subg = g.info.clust![i - 1];
    osageLayoutRec(subg, depth + 1);
    nvs += subg.nodes.size;
  }
  return nvs;
}

/**
 * Pack the direct children of g and set g.info.bb.
 * @see lib/osage/osageinit.c:layout (rect-packing block)
 */
export function packChildren(
  g: Graph, nClust: number, nvs: number, total: number, depth: number,
): void {
  const pinfo = buildPackInfo(g);
  const useVals = pinfo.mode === PackMode.Array && (pinfo.flags & PK_USER_VALS) !== 0;
  const lists = buildChildLists(g, nClust, nvs, useVals);
  if (useVals && lists.vals.length > 0) pinfo.vals = lists.vals;
  const pts = putRects(lists.gs.length, lists.gs, pinfo);
  if (!pts) return;
  let rbb = applyOffsets(lists, pts);
  rbb = applyLabelExpansion(g, total, rbb);
  rbb = addMarginAndBorder(g, depth > 0 ? pinfo.margin / 2 : 0, rbb);
  translateToOrigin(lists, rbb);
  g.info.bb = { ll: { x: 0, y: 0 }, ur: { x: rbb.urx - rbb.llx, y: rbb.ury - rbb.lly } };
}

/**
 * Recursively pack all direct children (subclusters + loose nodes) of g
 * into a bounding box. After this pass every cluster has LL=(0,0).
 *
 * @see lib/osage/osageinit.c:layout
 */
export function osageLayoutRec(g: Graph, depth: number): void {
  const nClust = g.info.n_cluster ?? 0;
  const nvs = recurseSubclusters(g, nClust, depth);
  const total = g.nodes.size - nvs + nClust;
  if (total === 0 && !g.info.label) {
    g.info.bb = { ll: { x: 0, y: 0 }, ur: { x: DFLT_SZ, y: DFLT_SZ } };
    return;
  }
  packChildren(g, nClust, nvs, total, depth);
}

// ---------------------------------------------------------------------------
// osageReposition helpers — exported for Lizard
// ---------------------------------------------------------------------------

/** Shift directly-owned node coords by bb.ll to convert to absolute. */
export function repositionNodes(g: Graph, bb: Box): void {
  for (const n of g.nodes.values()) {
    if (PARENT(n) !== g) continue;
    n.info.coord = {
      x: n.info.coord.x + bb.ll.x,
      y: n.info.coord.y + bb.ll.y,
    };
  }
}

/** Shift a subcluster bb by parentBb.ll. */
export function shiftSubclusterBb(subg: Graph, parentBb: Box): void {
  const sbb = subg.info.bb;
  subg.info.bb = {
    ll: { x: sbb.ll.x + parentBb.ll.x, y: sbb.ll.y + parentBb.ll.y },
    ur: { x: sbb.ur.x + parentBb.ll.x, y: sbb.ur.y + parentBb.ll.y },
  };
}

// ---------------------------------------------------------------------------
// osageReposition
// ---------------------------------------------------------------------------

/**
 * Convert local (cluster-relative) coordinates to absolute root-relative
 * coordinates by walking the cluster tree top-down and accumulating bb.ll.
 *
 * @see lib/osage/osageinit.c:reposition
 */
export function osageReposition(g: Graph, depth: number): void {
  const bb = g.info.bb;
  const nClust = g.info.n_cluster ?? 0;
  if (depth > 0) repositionNodes(g, bb);
  for (let i = 1; i <= nClust; i++) {
    const subg = g.info.clust![i - 1];
    if (depth > 0) shiftSubclusterBb(subg, bb);
    osageReposition(subg, depth + 1);
  }
}

// ---------------------------------------------------------------------------
// osageLayout
// ---------------------------------------------------------------------------

/**
 * Main osage layout entry point.
 *
 * Pipeline:
 * 1. clusterInitGraph — node/edge init
 * 2. mkClusters — cluster discovery
 * 3. osageLayoutRec — recursive rectangle packing
 * 4. osageReposition — convert to absolute coordinates
 * 5. splineEdges — edge routing (skipped when EDGETYPE_NONE)
 *
 * @see lib/osage/osageinit.c:osage_layout
 */
export function osageLayout(g: Graph): void {
  clusterInitGraph(g);
  mkClusters(g, null, g);
  osageLayoutRec(g, 0);
  osageReposition(g, 0);
  const et = g.info.flags & 0xf;
  if (et !== EDGETYPE_NONE) splineEdges(g);
}

// ---------------------------------------------------------------------------
// osageCleanup helpers — exported for Lizard
// ---------------------------------------------------------------------------

/** Recursively clear cluster arrays from g and all subclusters. */
export function cleanupGraphs(g: Graph): void {
  const nClust = g.info.n_cluster ?? 0;
  for (let i = 1; i <= nClust; i++) cleanupGraphs(g.info.clust![i - 1]);
  g.info.clust = undefined;
  g.info.n_cluster = undefined;
}

// ---------------------------------------------------------------------------
// osageCleanup
// ---------------------------------------------------------------------------

/**
 * Free all layout-specific memory attached to g.
 *
 * Clears alg (osage ownership tag) from all nodes and removes cluster
 * arrays from GraphInfo.
 *
 * @see lib/osage/osageinit.c:osage_cleanup
 */
export function osageCleanup(g: Graph): void {
  for (const n of g.nodes.values()) {
    if (n.info.alg?.kind === 'osage') n.info.alg = undefined;
  }
  cleanupGraphs(g);
}

// ---------------------------------------------------------------------------
// LayoutEngine export
// ---------------------------------------------------------------------------

/**
 * Osage layout engine plugin object, suitable for registration with
 * GvcContext.
 *
 * @see lib/plugin/neato_layout/gvlayout_neato_layout.c
 */
export const OSAGE_LAYOUT_ENGINE: LayoutEngine = {
  type: 'osage',
  layout: osageLayout,
  cleanup: osageCleanup,
};
