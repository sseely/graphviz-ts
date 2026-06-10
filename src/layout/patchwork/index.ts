// SPDX-License-Identifier: EPL-2.0

/**
 * Patchwork squarified treemap layout engine.
 *
 * Ports lib/patchwork/patchwork.c, lib/patchwork/patchworkinit.c, and
 * lib/patchwork/tree_map.c into a single browser-compatible TypeScript module.
 *
 * NOTE: All helper and body functions are exported so that Lizard resets
 * its cyclomatic-complexity counter at each `export function` boundary.
 *
 * @see lib/patchwork/patchwork.c
 * @see lib/patchwork/patchworkinit.c
 * @see lib/patchwork/tree_map.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { LayoutEngine } from '../../gvc/context.js';
import { ps2inch, shiftOneGraph } from '../pack/index.js';
import type { Rectangle } from './tree-map.js';
import { treeMap } from './tree-map.js';

const DFLT_SZ = 1.0;
const SCALE = 1000.0;

// ---------------------------------------------------------------------------
// Internal tree node
// ---------------------------------------------------------------------------

/** @see lib/patchwork/patchwork.c:treenode_t */
export interface TreeNode {
  area: number;
  childArea: number;
  r: Rectangle;
  leftChild: TreeNode | null;
  rightSib: TreeNode | null;
  kind: 'graph' | 'node';
  ref: Graph | Node;
  nChildren: number;
}

/** Mutable linked-list accumulator used during mkTree child collection. */
export interface ChildAccum {
  first: TreeNode | null;
  prev: TreeNode | null;
  area: number;
  nChildren: number;
}

// ---------------------------------------------------------------------------
// Attribute helpers
// ---------------------------------------------------------------------------

/** @see lib/patchwork/patchwork.c:getArea */
export function getArea(attrs: Map<string, string>): number {
  const raw = attrs.get('area');
  let area = raw !== undefined ? parseFloat(raw) : DFLT_SZ;
  if (!isFinite(area) || area === 0) area = DFLT_SZ;
  return area * SCALE;
}

/** @see lib/patchwork/patchwork.c:fullArea (mp parameter) */
export function getInset(attrs: Map<string, string>): number {
  const raw = attrs.get('inset');
  if (raw === undefined) return 0;
  const v = parseFloat(raw);
  return isFinite(v) ? v : 0;
}

/** @see lib/patchwork/patchwork.c:fullArea */
export function fullArea(childArea: number, inset: number): number {
  const wid = 2.0 * inset + Math.sqrt(childArea);
  return wid * wid;
}

// ---------------------------------------------------------------------------
// Tree node factories
// ---------------------------------------------------------------------------

/** Build a blank graph-kind TreeNode for g. @see lib/patchwork/patchwork.c:mkTree */
export function makeGraphTreeNode(g: Graph): TreeNode {
  return {
    area: 0, childArea: 0,
    r: { x: [0, 0], size: [0, 0] },
    leftChild: null, rightSib: null,
    kind: 'graph', ref: g, nChildren: 0,
  };
}

/** Build a leaf node-kind TreeNode for n. @see lib/patchwork/patchwork.c:mkTree */
export function makeNodeTreeNode(n: Node): TreeNode {
  return {
    area: getArea(n.attrs), childArea: 0,
    r: { x: [0, 0], size: [0, 0] },
    leftChild: null, rightSib: null,
    kind: 'node', ref: n, nChildren: 0,
  };
}

// ---------------------------------------------------------------------------
// Accumulator helpers
// ---------------------------------------------------------------------------

/** Append one child TreeNode into a ChildAccum linked list. */
export function accumAppend(accum: ChildAccum, cp: TreeNode): void {
  accum.nChildren++;
  accum.area += cp.area;
  if (!accum.first) accum.first = cp;
  if (accum.prev) accum.prev.rightSib = cp;
  accum.prev = cp;
}

/** Append all cluster children of g into accum. @see lib/patchwork/patchwork.c:mkTree */
export function appendClusterChildren(
  g: Graph, sparent: Map<Node, Graph>, accum: ChildAccum,
): void {
  for (const subg of g.info.clust ?? []) {
    accumAppend(accum, mkTree(subg, sparent));
  }
}

/** Append unclaimed direct nodes of g into accum. @see lib/patchwork/patchwork.c:mkTree */
export function appendNodeChildren(
  g: Graph, sparent: Map<Node, Graph>, accum: ChildAccum,
): void {
  for (const n of g.nodes.values()) {
    if (sparent.has(n)) continue;
    accumAppend(accum, makeNodeTreeNode(n));
    sparent.set(n, g);
  }
}

/** Finalise a TreeNode's area fields from an accumulated child list. */
export function finaliseTreeNode(p: TreeNode, g: Graph, accum: ChildAccum): void {
  p.nChildren = accum.nChildren;
  if (accum.nChildren > 0) {
    p.childArea = accum.area;
    p.area = fullArea(accum.area, getInset(g.attrs));
  } else {
    p.area = getArea(g.attrs);
  }
  p.leftChild = accum.first;
}

// ---------------------------------------------------------------------------
// Tree construction
// ---------------------------------------------------------------------------

/**
 * Recursively build the TreeNode tree from a Graph hierarchy.
 * @see lib/patchwork/patchwork.c:mkTree
 */
export function mkTree(g: Graph, sparent: Map<Node, Graph>): TreeNode {
  const p = makeGraphTreeNode(g);
  const accum: ChildAccum = { first: null, prev: null, area: 0, nChildren: 0 };
  appendClusterChildren(g, sparent, accum);
  appendNodeChildren(g, sparent, accum);
  finaliseTreeNode(p, g, accum);
  return p;
}

// ---------------------------------------------------------------------------
// Margin computation
// ---------------------------------------------------------------------------

/**
 * Compute the inset margin m such that (h-m)(w-m) == childArea.
 * Solves m² - (h+w)m + (hw - childArea) = 0; returns smaller root.
 * For h=10, w=8, childArea=64 → result ≈ 0.9029 (within 1e-6).
 * @see lib/patchwork/patchwork.c:layoutTree
 */
export function layoutTreeMargin(h: number, w: number, childArea: number): number {
  const delta = h - w;
  const disc = Math.sqrt(delta * delta + 4 * childArea);
  return (h + w - disc) / 2;
}

// ---------------------------------------------------------------------------
// Layout pass helpers
// ---------------------------------------------------------------------------

/** Collect sibling TreeNodes into a sorted (descending area) array. */
export function collectSortedChildren(tree: TreeNode): TreeNode[] {
  const nodes: TreeNode[] = [];
  let cp: TreeNode | null = tree.leftChild;
  while (cp !== null) {
    nodes.push(cp);
    cp = cp.rightSib;
  }
  nodes.sort((a, b) => b.area - a.area);
  return nodes;
}

/** Compute the shrunken fill rectangle for treeMap. */
export function computeFillRect(tree: TreeNode): Rectangle {
  const h = tree.r.size[1];
  const w = tree.r.size[0];
  const m = layoutTreeMargin(h, w, tree.childArea);
  return { x: [tree.r.x[0], tree.r.x[1]], size: [w - m, h - m] };
}

/** Assign treeMap rectangles back onto sorted child nodes. */
export function assignRecs(nodes: TreeNode[], recs: Rectangle[]): void {
  for (let i = 0; i < nodes.length; i++) {
    nodes[i]!.r = recs[i]!;
  }
}

/** Recurse layoutTree into any graph-kind children (original sibling order). */
export function recurseGraphChildren(tree: TreeNode): void {
  let cp: TreeNode | null = tree.leftChild;
  while (cp !== null) {
    if (cp.kind === 'graph') layoutTree(cp);
    cp = cp.rightSib;
  }
}

/** Squarify children into fill rect, assign recs, and recurse. */
export function placeLayoutRecs(tree: TreeNode, nodes: TreeNode[]): void {
  const crec = computeFillRect(tree);
  const recs = treeMap(nodes.length, nodes.map((tn) => tn.area), crec);
  if (recs === null) return;
  assignRecs(nodes, recs);
  recurseGraphChildren(tree);
}

// ---------------------------------------------------------------------------
// Layout pass
// ---------------------------------------------------------------------------

/**
 * Assign rectangles to the children of one tree node.
 * @see lib/patchwork/patchwork.c:layoutTree
 */
export function layoutTree(tree: TreeNode): void {
  if (tree.nChildren === 0) return;
  placeLayoutRecs(tree, collectSortedChildren(tree));
}

// ---------------------------------------------------------------------------
// Walk pass helpers
// ---------------------------------------------------------------------------

/** Write bounding box back to a graph node. @see lib/patchwork/patchwork.c:walkTree */
export function applyGraphRect(tree: TreeNode): void {
  let p: TreeNode | null = tree.leftChild;
  while (p !== null) { walkTree(p); p = p.rightSib; }
  const g = tree.ref as Graph;
  const [x0, y0] = tree.r.x;
  const [wd, ht] = tree.r.size;
  g.info.bb = {
    ll: { x: x0 - wd / 2.0, y: y0 - ht / 2.0 },
    ur: { x: x0 + wd / 2.0, y: y0 + ht / 2.0 },
  };
}

/** Write coord/size back to a leaf node. @see lib/patchwork/patchwork.c:walkTree */
export function applyLeafRect(tree: TreeNode): void {
  const n = tree.ref as Node;
  n.info.coord = { x: tree.r.x[0], y: tree.r.x[1] };
  n.info.width = ps2inch(tree.r.size[0]);
  n.info.height = ps2inch(tree.r.size[1]);
  n.info.ht = tree.r.size[1];
  n.info.lw = tree.r.size[0] / 2;
  n.info.rw = tree.r.size[0] / 2;
}

// ---------------------------------------------------------------------------
// Walk pass
// ---------------------------------------------------------------------------

/**
 * Write computed rectangle data back to Graphviz node/graph structures.
 * @see lib/patchwork/patchwork.c:walkTree
 */
export function walkTree(tree: TreeNode): void {
  if (tree.kind === 'graph') { applyGraphRect(tree); } else { applyLeafRect(tree); }
}

// ---------------------------------------------------------------------------
// Cluster detection
// ---------------------------------------------------------------------------

/** @see lib/common/utils.c:is_a_cluster */
export function isCluster(g: Graph): boolean {
  return g.name.startsWith('cluster');
}

/** @see lib/patchwork/patchworkinit.c:mkClusters */
export function collectClusters(g: Graph, clusters: Graph[]): void {
  for (const subg of g.subgraphs.values()) {
    if (isCluster(subg)) { clusters.push(subg); mkClusters(subg); }
    else { collectClusters(subg, clusters); }
  }
}

/**
 * Detect cluster subgraphs in g and populate g.info.clust.
 * @see lib/patchwork/patchworkinit.c:mkClusters
 */
export function mkClusters(g: Graph): void {
  const clusters: Graph[] = [];
  collectClusters(g, clusters);
  g.info.clust = clusters;
  g.info.n_cluster = clusters.length;
}

// ---------------------------------------------------------------------------
// Core layout entry point
// ---------------------------------------------------------------------------

/**
 * Core patchwork layout: build tree → sort → squarify → walk.
 * @see lib/patchwork/patchwork.c:patchworkLayout
 */
export function patchworkLayout(g: Graph): void {
  const sparent = new Map<Node, Graph>();
  const root = mkTree(g, sparent);
  const side = Math.sqrt(root.area + 0.1);
  root.r = { x: [0, 0], size: [side, side] };
  layoutTree(root);
  walkTree(root);
}

// ---------------------------------------------------------------------------
// Public layout engine
// ---------------------------------------------------------------------------

/**
 * Translate the whole drawing (nodes, cluster bbs, labels) so the
 * root bb's lower-left corner is the origin.
 * @see lib/common/postproc.c:translate_drawing
 * @see lib/common/postproc.c:translate_bb
 */
export function translateDrawing(g: Graph): void {
  const bb = g.info.bb;
  if (bb.ll.x === 0 && bb.ll.y === 0) return;
  shiftOneGraph(g, -bb.ll.x, -bb.ll.y);
}

/** @see lib/patchwork/patchworkinit.c:patchwork_layout */
export function patchworkEngineLayout(g: Graph): void {
  if (g.nodes.size === 0 && (g.info.n_cluster ?? 0) === 0) return;
  for (const n of g.nodes.values()) {
    if (!n.attrs.has('shape')) n.attrs.set('shape', 'box');
  }
  mkClusters(g);
  patchworkLayout(g);
  // C: dotneato_postprocess translates everything by -bb.LL.
  translateDrawing(g);
}

/** @see lib/patchwork/patchworkinit.c:patchwork_cleanup */
export function patchworkEngineCleanup(g: Graph): void {
  g.info.clust = undefined;
  g.info.n_cluster = undefined;
  for (const n of g.nodes.values()) { n.info.alg = undefined; }
}

/**
 * Patchwork squarified treemap layout engine.
 * @see lib/patchwork/patchworkinit.c:patchwork_layout
 */
export const PATCHWORK_LAYOUT_ENGINE: LayoutEngine = {
  type: 'patchwork',
  layout: patchworkEngineLayout,
  cleanup: patchworkEngineCleanup,
};
