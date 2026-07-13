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
import { ps2inch } from '../pack/index.js';
import type { Rectangle } from './tree-map.js';
import { treeMap } from './tree-map.js';
import { gvQsort } from '../../util/bsd-qsort.js';
import { commonInitNode } from '../../common/nodeinit.js';
import { nodeAttr } from '../../common/poly-init.js';
import { graphInit } from '../../common/graph-init.js';
import { mapbool } from '../dot/rank.js';
import { placeGraphLabel } from '../dot/position-bbox.js';
import { gvPostprocess } from '../../common/postproc.js';

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
  // C iterates agfstnode(g) — AGSEQ (root creation) order, NOT the order
  // nodes were referenced inside a cluster block. The child order feeds
  // layoutTree's equal-area qsort, whose tie permutation assigns tiles.
  const nodes = [...g.nodes.values()].sort((a, b) => a.id - b.id);
  for (const n of nodes) {
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
  // C sorts with LIST_SORT -> libc qsort (list.c:345). The equal-area tie
  // permutation is load-bearing: with default areas every child ties, and the
  // qsort permutation decides which node gets which treemap rect. A stable
  // sort keeps insertion order and assigns different tiles than native.
  // @see lib/patchwork/patchwork.c:162 LIST_SORT(&nodes, nodecmp)
  gvQsort(nodes, (a, b) => (a.area < b.area ? 1 : a.area > b.area ? -1 : 0));
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

/**
 * A subgraph is a cluster if it is the root, its name begins (case-insensitively)
 * with "cluster", OR it carries a truthy `cluster` attribute. The name-only test
 * missed `cluster=true` subgraphs (e.g. 2717's `domestic_cats`), dropping them
 * from the treemap cluster list. @see lib/common/utils.c:695 is_a_cluster
 */
export function isCluster(g: Graph): boolean {
  if (g === g.root) return true;
  if (g.name.toLowerCase().startsWith('cluster')) return true;
  return mapbool(g.attrs.get('cluster'));
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
 * Post-tiling per-node finish, mirroring C's walkTree -> finishNode:
 * (a) a node whose fontsize attr is DECLARED but resolves empty gets
 * fontsize = ND_ht*0.7 (%.03f) — the treemap-scaled label size; (b)
 * common_init_node runs in full: label + xlabel creation and poly_init
 * sizing. Crucially, poly_init CLOBBERS ND_width/ND_height with the
 * label-driven size while the tile survives in ND_lw/rw/ht (which
 * common_init_node never touches — gv_nodesize ran on the tile before).
 * This clobber is load-bearing: addXLabels' addNodeObj builds xlabel
 * obstacles from ND_width/ND_height (postproc.c:351), so native places
 * xlabels against label-sized boxes, not tiles. Drawing and attach_attrs
 * use lw/rw/ht, so the tile geometry still renders. The port's
 * commonInitNode folds gv_nodesize in (storeNodeSize), so lw/rw/ht are
 * saved and restored around it to keep the tile.
 * @see lib/patchwork/patchwork.c:finishNode
 * @see lib/common/postproc.c:351 addNodeObj (INCH2PS(ND_width/ND_height))
 */
export function finishNodes(g: Graph): void {
  // C's quirk gate is N_fontsize != NULL: the attr is declared somewhere.
  let fontsizeDeclared = g.nodeDefaults.has('fontsize');
  if (!fontsizeDeclared) {
    for (const n of g.nodes.values()) {
      if (n.attrs.has('fontsize') || n.nodeDefaultsSnapshot?.has('fontsize') === true) {
        fontsizeDeclared = true;
        break;
      }
    }
  }
  for (const n of g.nodes.values()) {
    if (fontsizeDeclared) {
      const v = nodeAttr(n, g, 'fontsize');
      if (v === undefined || v === '') {
        n.attrs.set('fontsize', (n.info.ht * 0.7).toFixed(3));
      }
    }
    const { lw, rw, ht } = n.info;
    commonInitNode(n, g);
    n.info.lw = lw;
    n.info.rw = rw;
    n.info.ht = ht;
  }
}

/** @see lib/patchwork/patchworkinit.c:patchwork_layout */
export function patchworkEngineLayout(g: Graph): void {
  if (g.nodes.size === 0 && (g.info.n_cluster ?? 0) === 0) return;
  // C: gvLayoutJobs runs graph_init(g, LAYOUT_USES_RANKDIR) before
  // patchwork_layout; patchwork does not set the flag → useRankdir=false.
  // graph_init also creates the ROOT graph label, which dotneato_postprocess
  // below sizes the canvas for and places.
  // @see lib/common/input.c:600, lib/gvc/gvlayout.c:81
  graphInit(g, false);
  // C patchwork_init_graph sets the AGNODE "shape" DEFAULT to box
  // (agattr_text, overwriting e.g. a `node [shape=record]` default), and
  // patchwork_init_node then agsets EVERY node's shape to box — explicit
  // per-node shapes (record, point, HTML tables) are deliberately discarded:
  // patchwork draws uniform tiles. @see patchworkinit.c:74,108
  g.nodeDefaults.set('shape', 'box');
  for (const n of g.nodes.values()) {
    n.attrs.set('shape', 'box');
    if (n.nodeDefaultsSnapshot !== undefined) n.nodeDefaultsSnapshot.set('shape', 'box');
  }
  mkClusters(g);
  patchworkLayout(g);
  // C: walkTree calls finishNode per leaf after tiling (fontsize quirk +
  // common_init_node xlabel creation). @see patchwork.c:243
  finishNodes(g);
  // C: dotneato_postprocess(g) — cluster labels, xlabels, root graph label
  // space + translate to origin. @see patchworkinit.c:127
  placeGraphLabel(g);
  gvPostprocess(g);
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
