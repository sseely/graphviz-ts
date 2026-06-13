// SPDX-License-Identifier: EPL-2.0

/**
 * QuadTree for Barnes–Hut supernode approximation (the NORMAL
 * tscheme path: per-node QuadTree_get_supernodes; the FAST scheme's
 * force accumulation is unreachable at sfdp defaults and not ported).
 *
 * The off-by-one in the leaf-list average update (n incremented
 * BEFORE the running average in the max-level branch, but AFTER it in
 * the split branch) is C behavior — ported verbatim.
 *
 * Spec read at the 15.0.0 tag.
 *
 * @see lib/sparse/QuadTree.c (15.0.0)
 */

import { fma } from '../../common/fma.js';

/** @see lib/sparse/QuadTree.h:node_data_struct */
interface NodeData {
  nodeWeight: number;
  coord: number[];
  id: number;
  next: NodeData | null;
}

/** @see lib/sparse/QuadTree.h:QuadTree_struct */
export interface QuadTree {
  n: number;
  totalWeight: number;
  dim: number;
  center: number[];
  /** center ± width bounds the cell ("radius"). */
  width: number;
  average: number[] | null;
  qts: (QuadTree | null)[] | null;
  l: NodeData | null;
  maxLevel: number;
}

/** Result arrays of one supernode query. */
export interface Supernodes {
  nsuper: number;
  center: number[];
  supernodeWgts: number[];
  distances: number[];
  counts: number;
}

/** Euclidean distance with fmadd accumulation. @see lib/sparse/general.c:point_distance */
function pointDistance(p1: number[], o1: number, p2: number[], o2: number, dim: number): number {
  let dist = 0;
  for (let i = 0; i < dim; i++) {
    const d = p1[o1 + i]! - p2[o2 + i]!;
    dist = fma(d, d, dist);
  }
  return Math.sqrt(dist);
}

/** @see lib/sparse/QuadTree.c:QuadTree_new */
export function quadTreeNew(dim: number, center: number[], width: number, maxLevel: number): QuadTree {
  return {
    n: 0,
    totalWeight: 0,
    dim,
    center: center.slice(0, dim),
    width,
    average: null,
    qts: null,
    l: null,
    maxLevel,
  };
}

/** Quadrant index by per-axis sign bits. @see QuadTree.c:QuadTree_get_quadrant */
function getQuadrant(dim: number, center: number[], coord: number[], off: number): number {
  let d = 0;
  for (let i = dim - 1; i >= 0; i--) {
    if (coord[off + i]! - center[i]! < 0) {
      d = 2 * d;
    } else {
      d = 2 * d + 1;
    }
  }
  return d;
}

/** Child cell i of a parent cell. @see QuadTree.c:QuadTree_new_in_quadrant */
function newInQuadrant(dim: number, parentCenter: number[], width: number, maxLevel: number, i: number): QuadTree {
  const qt = quadTreeNew(dim, parentCenter, width, maxLevel);
  const center = qt.center;
  let ii = i;
  for (let k = 0; k < dim; k++) {
    if (ii % 2 === 0) {
      center[k]! -= width;
    } else {
      center[k]! += width;
    }
    ii = (ii - ii % 2) / 2;
  }
  return qt;
}

/** First insertion into an empty cell. @see QuadTree.c:455-463 */
function addToEmpty(q: QuadTree, coord: number[], off: number, weight: number, id: number): void {
  q.n = 1;
  q.totalWeight = weight;
  q.average = coord.slice(off, off + q.dim);
  q.l = { nodeWeight: weight, coord: coord.slice(off, off + q.dim), id, next: null };
}

/** Split insertion below max level. @see QuadTree.c:464-501 */
function addWithSplit(
  q: QuadTree, coord: number[], off: number, weight: number, id: number, level: number,
): void {
  const dim = q.dim;
  q.totalWeight += weight;
  for (let i = 0; i < dim; i++) {
    // binary: fmadd(average, n, coord) then fdiv
    q.average![i] = fma(q.average![i]!, q.n, coord[off + i]!) / (q.n + 1);
  }
  if (q.qts === null) q.qts = new Array<QuadTree | null>(1 << dim).fill(null);

  let ii = getQuadrant(dim, q.center, coord, off);
  if (q.qts[ii] === null) {
    q.qts[ii] = newInQuadrant(dim, q.center, q.width / 2, q.maxLevel, ii);
  }
  addInternal(q.qts[ii]!, coord, off, weight, id, level + 1);

  if (q.l !== null) {
    /* push the single resident node down into its quadrant */
    const old = q.l;
    ii = getQuadrant(dim, q.center, old.coord, 0);
    if (q.qts[ii] === null) {
      q.qts[ii] = newInQuadrant(dim, q.center, q.width / 2, q.maxLevel, ii);
    }
    addInternal(q.qts[ii]!, old.coord, 0, old.nodeWeight, old.id, level + 1);
    q.l = null;
  }

  q.n++;
}

/** Max-level append (note: n incremented BEFORE the average update). */
function addAtMaxLevel(q: QuadTree, coord: number[], off: number, weight: number, id: number): void {
  q.n++;
  q.totalWeight += weight;
  for (let i = 0; i < q.dim; i++) {
    // binary: fmadd(average, n, coord) then fdiv — with the C's
    // pre-incremented n (verbatim off-by-one)
    q.average![i] = fma(q.average![i]!, q.n, coord[off + i]!) / (q.n + 1);
  }
  const nd: NodeData = {
    nodeWeight: weight,
    coord: coord.slice(off, off + q.dim),
    id,
    next: q.l,
  };
  q.l = nd;
}

/** @see lib/sparse/QuadTree.c:QuadTree_add_internal */
function addInternal(
  q: QuadTree, coord: number[], off: number, weight: number, id: number, level: number,
): void {
  if (q.n === 0) {
    addToEmpty(q, coord, off, weight, id);
  } else if (level < q.maxLevel) {
    addWithSplit(q, coord, off, weight, id, level);
  } else {
    addAtMaxLevel(q, coord, off, weight, id);
  }
}

/** @see lib/sparse/QuadTree.c:QuadTree_add */
export function quadTreeAdd(q: QuadTree, coord: number[], off: number, weight: number, id: number): void {
  addInternal(q, coord, off, weight, id, 0);
}

/**
 * Build a quadtree over n dim-dimensional points.
 * @see lib/sparse/QuadTree.c:QuadTree_new_from_point_list
 */
export function quadTreeNewFromPointList(
  dim: number, n: number, maxLevel: number, coord: number[],
): QuadTree {
  const xmin: number[] = coord.slice(0, dim);
  const xmax: number[] = coord.slice(0, dim);
  const center = new Array<number>(dim).fill(0);

  for (let i = 1; i < n; i++) {
    for (let k = 0; k < dim; k++) {
      xmin[k] = Math.min(xmin[k]!, coord[i * dim + k]!);
      xmax[k] = Math.max(xmax[k]!, coord[i * dim + k]!);
    }
  }
  let width = xmax[0]! - xmin[0]!;
  for (let i = 0; i < dim; i++) {
    center[i] = (xmin[i]! + xmax[i]!) * 0.5;
    width = Math.max(width, xmax[i]! - xmin[i]!);
  }
  width = Math.max(width, 0.00001); /* one point ⇒ width = 0 */
  width *= 0.52;
  const qt = quadTreeNew(dim, center, width, maxLevel);

  for (let i = 0; i < n; i++) {
    quadTreeAdd(qt, coord, i * dim, 1, i);
  }
  return qt;
}

/** @see lib/sparse/QuadTree.c:QuadTree_get_supernodes_internal */
function getSupernodesInternal(
  qt: QuadTree | null, bh: number, pt: number[], ptOff: number, nodeid: number,
  out: Supernodes,
): void {
  out.counts++;
  if (qt === null) return;
  const dim = qt.dim;
  let l = qt.l;
  while (l !== null) {
    if (l.id !== nodeid) {
      for (let i = 0; i < dim; i++) {
        out.center[dim * out.nsuper + i] = l.coord[i]!;
      }
      out.supernodeWgts[out.nsuper] = l.nodeWeight;
      out.distances[out.nsuper] = pointDistance(pt, ptOff, l.coord, 0, dim);
      out.nsuper++;
    }
    l = l.next;
  }

  if (qt.qts !== null) {
    const dist = pointDistance(qt.center, 0, pt, ptOff, dim);
    if (qt.width < bh * dist) {
      for (let i = 0; i < dim; i++) {
        out.center[dim * out.nsuper + i] = qt.average![i]!;
      }
      out.supernodeWgts[out.nsuper] = qt.totalWeight;
      out.distances[out.nsuper] = pointDistance(qt.average!, 0, pt, ptOff, dim);
      out.nsuper++;
    } else {
      for (let i = 0; i < (1 << dim); i++) {
        getSupernodesInternal(qt.qts[i]!, bh, pt, ptOff, nodeid, out);
      }
    }
  }
}

/**
 * Collect the supernodes acting on the point at pt[ptOff..] (node
 * `nodeid` excluded from leaf lists).
 * @see lib/sparse/QuadTree.c:QuadTree_get_supernodes
 */
export function quadTreeGetSupernodes(
  qt: QuadTree, bh: number, pt: number[], ptOff: number, nodeid: number,
): Supernodes {
  const out: Supernodes = {
    nsuper: 0,
    center: [],
    supernodeWgts: [],
    distances: [],
    counts: 0,
  };
  getSupernodesInternal(qt, bh, pt, ptOff, nodeid, out);
  return out;
}
