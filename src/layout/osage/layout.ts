// SPDX-License-Identifier: EPL-2.0

/**
 * Osage recursive layout helpers.
 *
 * @see lib/osage/osageinit.c:layout
 * @see lib/osage/osageinit.c:reposition
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Box, Point } from '../../model/geom.js';
import type { PackInfo } from '../pack/index.js';
import type { ChildLists } from './types.js';
import { PackMode, getPackInfo, putRects, PK_USER_VALS } from '../pack/index.js';
import { PARENT } from './index.js';

export type { ChildLists };

const DFLT_SZ = 18;
const DFLT_MARGIN = 8;

// ---------------------------------------------------------------------------
// Box helpers
// ---------------------------------------------------------------------------

const makeBox = (llx: number, lly: number, urx: number, ury: number): Box =>
  ({ ll: { x: llx, y: lly }, ur: { x: urx, y: ury } });

const copyBox = (b: Box): Box =>
  makeBox(b.ll.x, b.ll.y, b.ur.x, b.ur.y);

const shiftBox = (b: Box, p: Point): Box =>
  makeBox(b.ll.x + p.x, b.ll.y + p.y, b.ur.x + p.x, b.ur.y + p.y);

// ---------------------------------------------------------------------------
// PackInfo builder
// ---------------------------------------------------------------------------

/** Build and populate a PackInfo from graph attributes. @see lib/osage/osageinit.c:layout */
export const buildPackInfo = (g: Graph): PackInfo => {
  const p: PackInfo = { aspect: 1, sz: 0, margin: DFLT_MARGIN,
    doSplines: false, mode: PackMode.Array, fixed: null, vals: null, flags: 0 };
  getPackInfo(g, PackMode.Array, DFLT_MARGIN, p);
  if (p.mode < PackMode.Graph) p.mode = PackMode.Graph;
  return p;
};

// ---------------------------------------------------------------------------
// ChildLists builders
// ---------------------------------------------------------------------------

const newChildLists = (): ChildLists =>
  ({ gs: [], childGraphs: [], childNodes: [], vals: [] });

const addCluster = (lists: ChildLists, sg: Graph, useVals: boolean): void => {
  lists.gs.push(copyBox(sg.info.bb));
  lists.childGraphs.push(sg);
  if (useVals) lists.vals.push(0);
};

const addNode = (lists: ChildLists, n: Node, owner: Graph, useVals: boolean): void => {
  n.info.alg = { kind: 'osage', ownerCluster: owner };
  lists.gs.push(makeBox(0, 0, n.info.lw + n.info.rw, n.info.ht));
  lists.childNodes.push(n);
  if (useVals) lists.vals.push(0);
};

const fillClusters = (g: Graph, nClust: number, lists: ChildLists, uv: boolean): void => {
  for (let i = 1; i <= nClust; i++) addCluster(lists, g.info.clust![i - 1], uv);
};

const fillNodes = (g: Graph, nvs: number, lists: ChildLists, uv: boolean): void => {
  if (g.nodes.size <= nvs) return;
  for (const n of g.nodes.values()) {
    if (n.info.alg === undefined) addNode(lists, n, g, uv);
  }
};

/**
 * Build child arrays for putRects.
 * @see lib/osage/osageinit.c:layout (child list construction)
 */
export const buildChildLists = (g: Graph, nClust: number, nvs: number, p: PackInfo): ChildLists => {
  const useVals = p.mode === PackMode.Array && (p.flags & PK_USER_VALS) !== 0;
  const lists = newChildLists();
  fillClusters(g, nClust, lists, useVals);
  fillNodes(g, nvs, lists, useVals);
  return lists;
};

// ---------------------------------------------------------------------------
// Bounding-box union accumulator
// ---------------------------------------------------------------------------

const emptyUnion = (): Box => makeBox(Infinity, Infinity, -Infinity, -Infinity);

const expandUnion = (u: Box, b: Box): void => {
  if (b.ll.x < u.ll.x) u.ll.x = b.ll.x;
  if (b.ll.y < u.ll.y) u.ll.y = b.ll.y;
  if (b.ur.x > u.ur.x) u.ur.x = b.ur.x;
  if (b.ur.y > u.ur.y) u.ur.y = b.ur.y;
};

const placeChild = (lists: ChildLists, i: number, tb: Box): void => {
  const ng = lists.childGraphs.length;
  if (i < ng) {
    lists.childGraphs[i]!.info.bb = tb;
  } else {
    const nd = lists.childNodes[i - ng]!;
    nd.info.coord = { x: (tb.ll.x + tb.ur.x) / 2, y: (tb.ll.y + tb.ur.y) / 2 };
  }
};

/**
 * Apply putRects offsets to child bbs/coords; return union bounding box.
 * @see lib/osage/osageinit.c:layout (offset application loop)
 */
export const applyOffsets = (lists: ChildLists, pts: Point[]): Box => {
  const u = emptyUnion();
  for (let i = 0; i < lists.gs.length; i++) {
    const tb = shiftBox(lists.gs[i]!, pts[i]!);
    expandUnion(u, tb);
    placeChild(lists, i, tb);
  }
  return u;
};

// ---------------------------------------------------------------------------
// Label + margin adjustments
// ---------------------------------------------------------------------------

/**
 * Widen union bb if the graph label is wider than packed content.
 * @see lib/osage/osageinit.c:layout (GD_label block)
 */
export const applyLabelExpansion = (g: Graph, total: number, u: Box): Box => {
  const dim = (g.info.label as { dimen?: Point } | undefined)?.dimen;
  if (!dim) return u;
  if (total === 0) return makeBox(0, 0, dim.x, dim.y);
  const d = dim.x - (u.ur.x - u.ll.x);
  if (d > 0) { u.ll.x -= d / 2; u.ur.x += d / 2; }
  return u;
};

const borderY = (g: Graph, idx: 2 | 3): number =>
  g.info.border ? g.info.border[idx].y : 0;

/**
 * Add margin and label-border padding to the union bounding box.
 * @see lib/osage/osageinit.c:layout (margin/border block)
 */
export const addMarginAndBorder = (g: Graph, margin: number, u: Box): Box =>
  makeBox(
    u.ll.x - margin, u.ll.y - margin - borderY(g, 3),
    u.ur.x + margin, u.ur.y + margin + borderY(g, 2),
  );

// ---------------------------------------------------------------------------
// Origin translation
// ---------------------------------------------------------------------------

const shiftCluster = (sg: Graph, ox: number, oy: number): void => {
  const b = sg.info.bb;
  sg.info.bb = makeBox(b.ll.x - ox, b.ll.y - oy, b.ur.x - ox, b.ur.y - oy);
};

const shiftNode = (nd: Node, ox: number, oy: number): void => {
  nd.info.coord = { x: nd.info.coord.x - ox, y: nd.info.coord.y - oy };
};

/**
 * Subtract union.ll from all child positions so this cluster's LL = (0,0).
 * @see lib/osage/osageinit.c:layout (translate-to-origin loop)
 */
export const translateToOrigin = (lists: ChildLists, u: Box): void => {
  for (const sg of lists.childGraphs) shiftCluster(sg, u.ll.x, u.ll.y);
  for (const nd of lists.childNodes) shiftNode(nd, u.ll.x, u.ll.y);
};

// ---------------------------------------------------------------------------
// osageLayoutRec
// ---------------------------------------------------------------------------

const recurseSubclusters = (g: Graph, nClust: number, depth: number): number => {
  let nvs = 0;
  for (let i = 1; i <= nClust; i++) {
    const sg = g.info.clust![i - 1];
    osageLayoutRec(sg, depth + 1);
    nvs += sg.nodes.size;
  }
  return nvs;
};

const packAndPlace = (g: Graph, nClust: number, nvs: number, depth: number): void => {
  const p = buildPackInfo(g);
  const lists = buildChildLists(g, nClust, nvs, p);
  if (p.vals === null && lists.vals.length > 0) p.vals = lists.vals;
  const pts = putRects(lists.gs.length, lists.gs, p);
  if (!pts) return;
  let u = applyOffsets(lists, pts);
  u = applyLabelExpansion(g, g.nodes.size - nvs + nClust, u);
  u = addMarginAndBorder(g, depth > 0 ? p.margin / 2 : 0, u);
  translateToOrigin(lists, u);
  g.info.bb = makeBox(0, 0, u.ur.x - u.ll.x, u.ur.y - u.ll.y);
};

/**
 * Recursively pack all direct children (subclusters + loose nodes) of g.
 * @see lib/osage/osageinit.c:layout
 */
export const osageLayoutRec = (g: Graph, depth: number): void => {
  const nClust = g.info.n_cluster ?? 0;
  const nvs = recurseSubclusters(g, nClust, depth);
  if (g.nodes.size - nvs + nClust === 0 && !g.info.label) {
    g.info.bb = makeBox(0, 0, DFLT_SZ, DFLT_SZ);
    return;
  }
  packAndPlace(g, nClust, nvs, depth);
};

// ---------------------------------------------------------------------------
// osageReposition
// ---------------------------------------------------------------------------

const repositionNodes = (g: Graph, bb: Box): void => {
  for (const n of g.nodes.values()) {
    if (PARENT(n) !== g) continue;
    n.info.coord = { x: n.info.coord.x + bb.ll.x, y: n.info.coord.y + bb.ll.y };
  }
};

const shiftSubclusterBb = (sg: Graph, parentBb: Box): void => {
  const s = sg.info.bb;
  sg.info.bb = makeBox(
    s.ll.x + parentBb.ll.x, s.ll.y + parentBb.ll.y,
    s.ur.x + parentBb.ll.x, s.ur.y + parentBb.ll.y,
  );
};

/**
 * Convert cluster-relative coordinates to absolute root-relative coordinates.
 * @see lib/osage/osageinit.c:reposition
 */
export const osageReposition = (g: Graph, depth: number): void => {
  const bb = g.info.bb;
  const nClust = g.info.n_cluster ?? 0;
  if (depth > 0) repositionNodes(g, bb);
  for (let i = 1; i <= nClust; i++) {
    const sg = g.info.clust![i - 1];
    if (depth > 0) shiftSubclusterBb(sg, bb);
    osageReposition(sg, depth + 1);
  }
};
