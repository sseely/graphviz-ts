// SPDX-License-Identifier: EPL-2.0

/**
 * Internal tree node and construction helpers for the patchwork layout.
 *
 * Mirrors treenode_t and mkTree from lib/patchwork/patchwork.c.
 *
 * @see lib/patchwork/patchwork.c:treenode_t
 * @see lib/patchwork/patchwork.c:mkTree
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Rectangle } from './tree-map.js';

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

/** Default area when attribute is missing or zero. @see lib/patchwork/patchwork.c */
const DFLT_SZ = 1.0;

/** Area multiplier for numerical stability. @see lib/patchwork/patchwork.c */
const SCALE = 1000.0;

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

/** wid = 2*inset + sqrt(childArea), area = wid². @see lib/patchwork/patchwork.c:fullArea */
export function fullArea(childArea: number, inset: number): number {
  const wid = 2.0 * inset + Math.sqrt(childArea);
  return wid * wid;
}

/** Mutable accumulator used during tree construction. */
export interface ChildAccum {
  first: TreeNode | null;
  prev: TreeNode | null;
  area: number;
  nChildren: number;
}

/** Append all cluster children of g to accum. @see lib/patchwork/patchwork.c:mkTree */
export function appendClusters(g: Graph, sparent: Map<Node, Graph>, accum: ChildAccum): void {
  for (const subg of g.info.clust ?? []) {
    const cp = mkTree(subg, sparent);
    accum.nChildren++;
    accum.area += cp.area;
    if (!accum.first) accum.first = cp;
    if (accum.prev) accum.prev.rightSib = cp;
    accum.prev = cp;
  }
}

/** Append unclaimed direct nodes of g to accum. @see lib/patchwork/patchwork.c:mkTree */
export function appendNodes(g: Graph, sparent: Map<Node, Graph>, accum: ChildAccum): void {
  for (const n of g.nodes.values()) {
    if (sparent.has(n)) continue;
    const cp: TreeNode = {
      area: getArea(n.attrs),
      childArea: 0,
      r: { x: [0, 0], size: [0, 0] },
      leftChild: null, rightSib: null,
      kind: 'node', ref: n, nChildren: 0,
    };
    accum.nChildren++;
    accum.area += cp.area;
    if (!accum.first) accum.first = cp;
    if (accum.prev) accum.prev.rightSib = cp;
    accum.prev = cp;
    sparent.set(n, g);
  }
}

/**
 * Recursively build the internal TreeNode tree from a Graph hierarchy.
 * Nodes already owned by a cluster (sparent set) are skipped.
 * @see lib/patchwork/patchwork.c:mkTree
 */
export function mkTree(g: Graph, sparent: Map<Node, Graph>): TreeNode {
  const p: TreeNode = {
    area: 0, childArea: 0,
    r: { x: [0, 0], size: [0, 0] },
    leftChild: null, rightSib: null,
    kind: 'graph', ref: g, nChildren: 0,
  };
  const accum: ChildAccum = { first: null, prev: null, area: 0, nChildren: 0 };
  appendClusters(g, sparent, accum);
  appendNodes(g, sparent, accum);
  p.nChildren = accum.nChildren;
  if (accum.nChildren > 0) {
    p.childArea = accum.area;
    p.area = fullArea(accum.area, getInset(g.attrs));
  } else {
    p.area = getArea(g.attrs);
  }
  p.leftChild = accum.first;
  return p;
}
