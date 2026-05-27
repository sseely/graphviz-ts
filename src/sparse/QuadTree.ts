// SPDX-License-Identifier: EPL-2.0
/**
 * QuadTree — port of lib/sparse/QuadTree.c
 *
 * Recursive quadtree (generalized to dim dimensions) for Barnes-Hut
 * O(n log n) repulsive force approximation in the SFDP layout engine.
 *
 * @see sparse/QuadTree.h
 * @see sparse/QuadTree.c
 */

import { pointDistance, distanceCropped, MACHINEACC } from "./general.js";

/** @see QuadTree.c:node_data_struct */
export interface NodeData {
  nodeWeight: number;
  coord: Float64Array;
  id: number;
  /** Points into caller's force array; must NOT be freed. */
  data: Float64Array | null;
  next: NodeData | null;
}

/** Shared parameters for repulsive force calculation. */
export interface ForceParams {
  bh: number;
  p: number;
  KP: number;
}

/** Accumulator passed to getSupernodes. Mirrors the C pointer-in/out pattern. */
export class SupernodeAccum {
  nsuper = 0;
  nsupermax = 10;
  center: Float64Array;
  supernodeWgts: Float64Array;
  distances: Float64Array;
  counts = 0;

  constructor(dim: number) {
    this.center = new Float64Array(this.nsupermax * dim);
    this.supernodeWgts = new Float64Array(this.nsupermax);
    this.distances = new Float64Array(this.nsupermax);
  }

  grow(dim: number): void {
    const nm = this.nsuper + 10;
    const nc = new Float64Array(nm * dim); nc.set(this.center);
    const nw = new Float64Array(nm); nw.set(this.supernodeWgts);
    const nd = new Float64Array(nm); nd.set(this.distances);
    this.center = nc; this.supernodeWgts = nw; this.distances = nd;
    this.nsupermax = nm;
  }
}

/** Mutable state for getNearest traversal. */
interface NearState {
  min: number;
  imin: number;
  ymin: Float64Array;
}

/** Context bundle for the two-phase repulsive force calculation. */
class ForceCalc {
  force: Float64Array;
  x: Float64Array;
  bh: number;
  p: number;
  KP: number;
  counts: Float64Array;
  dim = 2;

  constructor(force: Float64Array, x: Float64Array, params: ForceParams, counts: Float64Array) {
    this.force = force; this.x = x;
    this.bh = params.bh; this.p = params.p; this.KP = params.KP;
    this.counts = counts;
  }

  forceScale(wgt1: number, wgt2: number, dist: number): number {
    return this.p === -1
      ? wgt1 * wgt2 * this.KP / (dist * dist)
      : wgt1 * wgt2 * this.KP / Math.pow(dist, 1 - this.p);
  }

  applyForce(x1: Float64Array | number[], x2: Float64Array | number[], scale: number, f1: Float64Array, f2: Float64Array): void {
    for (let k = 0; k < this.dim; k++) {
      const f = scale * (x1[k] - x2[k]);
      f1[k] += f; f2[k] -= f;
    }
  }

  nodeForce(i: number, nd: NodeData): Float64Array {
    if (!nd.data) nd.data = this.force.subarray(i * this.dim, (i + 1) * this.dim);
    return nd.data;
  }
}

/**
 * Recursive quadtree data structure.
 * @see sparse/QuadTree.h:QuadTree_struct
 */
export class QuadTree {
  n = 0;
  totalWeight = 0.0;
  dim: number;
  center: Float64Array;
  width: number;
  average: Float64Array | null = null;
  qts: (QuadTree | null)[] | null = null;
  l: NodeData | null = null;
  maxLevel: number;
  data: Float64Array | null = null;

  private constructor(dim: number, center: Float64Array, width: number, maxLevel: number) {
    this.dim = dim; this.center = center.slice(); this.width = width; this.maxLevel = maxLevel;
  }

  /** @see QuadTree.c:QuadTree_new */
  static newQt(dim: number, center: Float64Array, width: number, maxLevel: number): QuadTree {
    if (width <= 0) throw new Error("QuadTree width must be > 0");
    return new QuadTree(dim, center, width, maxLevel);
  }

  /** @see QuadTree.c:QuadTree_new_in_quadrant */
  static newInQuadrant(dim: number, center: Float64Array, width: number, maxLevel: number, quadrant: number): QuadTree {
    const qt = QuadTree.newQt(dim, center, width, maxLevel);
    let i = quadrant;
    for (let k = 0; k < dim; k++) {
      if (i % 2 === 0) qt.center[k] -= width;
      else qt.center[k] += width;
      i = (i - i % 2) / 2;
    }
    return qt;
  }

  /** @see QuadTree.c:QuadTree_new_from_point_list */
  static newFromPointList(dim: number, n: number, maxLevel: number, coord: Float64Array): QuadTree {
    const xmin = coord.subarray(0, dim).slice(), xmax = xmin.slice();
    for (let i = 1; i < n; i++)
      for (let k = 0; k < dim; k++) {
        if (coord[i * dim + k] < xmin[k]) xmin[k] = coord[i * dim + k];
        if (coord[i * dim + k] > xmax[k]) xmax[k] = coord[i * dim + k];
      }
    let width = xmax[0] - xmin[0];
    const center = new Float64Array(dim);
    for (let i = 0; i < dim; i++) {
      center[i] = (xmin[i] + xmax[i]) * 0.5;
      if (xmax[i] - xmin[i] > width) width = xmax[i] - xmin[i];
    }
    width = Math.max(width, 0.00001) * 0.52;
    const qt = QuadTree.newQt(dim, center, width, maxLevel);
    for (let i = 0; i < n; i++) qt.add(coord.subarray(i * dim, (i + 1) * dim), 1.0, i);
    return qt;
  }

  /** @see QuadTree.c:QuadTree_get_quadrant */
  _getQuadrant(coord: Float64Array): number {
    let d = 0;
    for (let i = this.dim - 1; i >= 0; i--)
      d = coord[i] - this.center[i] < 0 ? 2 * d : 2 * d + 1;
    return d;
  }

  private _addEmpty(coord: Float64Array, weight: number, id: number): void {
    this.n = 1; this.totalWeight = weight;
    this.average = new Float64Array(this.dim);
    for (let i = 0; i < this.dim; i++) this.average[i] = coord[i];
    this.l = { nodeWeight: weight, coord: coord.slice(), id, data: null, next: null };
  }

  private static _moveLeavesDown(q: QuadTree, level: number): void {
    if (!q.l) return;
    const old = q.l; q.l = null;
    const ii = q._getQuadrant(old.coord);
    if (!q.qts![ii]) q.qts![ii] = QuadTree.newInQuadrant(q.dim, q.center, q.width / 2, q.maxLevel, ii);
    q.qts![ii] = QuadTree._addInternal(q.qts![ii]!, old.coord, old.nodeWeight, old.id, level + 1);
  }

  private static _addSplit(q: QuadTree, coord: Float64Array, weight: number, id: number, level: number): void {
    const dim = q.dim, n = q.n;
    q.totalWeight += weight;
    for (let i = 0; i < dim; i++) q.average![i] = (q.average![i] * n + coord[i]) / (n + 1);
    if (!q.qts) q.qts = new Array(1 << dim).fill(null) as (QuadTree | null)[];
    const ii = q._getQuadrant(coord);
    if (!q.qts[ii]) q.qts[ii] = QuadTree.newInQuadrant(dim, q.center, q.width / 2, q.maxLevel, ii);
    q.qts[ii] = QuadTree._addInternal(q.qts![ii]!, coord, weight, id, level + 1);
    QuadTree._moveLeavesDown(q, level);
    q.n++;
  }

  /** @see QuadTree.c:QuadTree_add_internal */
  private static _addInternal(q: QuadTree, coord: Float64Array, weight: number, id: number, level: number): QuadTree {
    if (q.n === 0) { q._addEmpty(coord, weight, id); return q; }
    if (level < q.maxLevel) { QuadTree._addSplit(q, coord, weight, id, level); return q; }
    for (let i = 0; i < q.dim; i++) {
      const eps = 1e5 * MACHINEACC * q.width;
      void (coord[i] < q.center[i] - q.width - eps || coord[i] > q.center[i] + q.width + eps);
    }
    q.n++;
    q.totalWeight += weight;
    for (let i = 0; i < q.dim; i++) q.average![i] = (q.average![i] * q.n + coord[i]) / (q.n + 1);
    q.l = { nodeWeight: weight, coord: coord.slice(), id, data: null, next: q.l };
    return q;
  }

  /** @see QuadTree.c:QuadTree_add */
  add(coord: Float64Array, weight: number, id: number): QuadTree {
    return QuadTree._addInternal(this, coord, weight, id, 0);
  }

  private _addLeafToAccum(l: NodeData, pt: Float64Array, acc: SupernodeAccum): void {
    const dim = this.dim;
    if (acc.nsuper >= acc.nsupermax) acc.grow(dim);
    for (let i = 0; i < dim; i++) acc.center[dim * acc.nsuper + i] = l.coord[i];
    acc.supernodeWgts[acc.nsuper] = l.nodeWeight;
    acc.distances[acc.nsuper] = pointDistance(pt, l.coord, dim);
    acc.nsuper++;
  }

  private _addCellToAccum(pt: Float64Array, acc: SupernodeAccum): void {
    const dim = this.dim;
    if (acc.nsuper >= acc.nsupermax) acc.grow(dim);
    for (let i = 0; i < dim; i++) acc.center[dim * acc.nsuper + i] = this.average![i];
    acc.supernodeWgts[acc.nsuper] = this.totalWeight;
    acc.distances[acc.nsuper] = pointDistance(this.average!, pt, dim);
    acc.nsuper++;
  }

  private _getSupernodesInternal(bh: number, pt: Float64Array, nodeid: number, acc: SupernodeAccum): void {
    acc.counts++;
    let l = this.l;
    while (l) {
      if (l.id !== nodeid) this._addLeafToAccum(l, pt, acc);
      l = l.next;
    }
    if (!this.qts) return;
    const dist = pointDistance(this.center, pt, this.dim);
    if (this.width < bh * dist) {
      this._addCellToAccum(pt, acc);
    } else {
      for (let i = 0; i < (1 << this.dim); i++)
        this.qts[i]?._getSupernodesInternal(bh, pt, nodeid, acc);
    }
  }

  /** @see QuadTree.c:QuadTree_get_supernodes */
  getSupernodes(bh: number, pt: Float64Array, nodeid: number, acc: SupernodeAccum): void {
    acc.nsuper = 0; acc.counts = 0;
    this._getSupernodesInternal(bh, pt, nodeid, acc);
  }

  private static _getOrAllocForceQt(qt: QuadTree, dim: number): Float64Array {
    if (!qt.data) qt.data = new Float64Array(dim);
    return qt.data;
  }

  private static _interactLeaves(qt1: QuadTree, qt2: QuadTree, fc: ForceCalc): void {
    let l1 = qt1.l;
    while (l1) {
      const x1 = l1.coord, wgt1 = l1.nodeWeight, i1 = l1.id;
      const f1 = fc.nodeForce(i1, l1);
      let l2 = qt2.l;
      while (l2) {
        const i2 = l2.id;
        if ((qt1 === qt2 && i2 < i1) || i1 === i2) { l2 = l2.next; continue; }
        fc.counts[1]++;
        const f2 = fc.nodeForce(i2, l2);
        const dist = distanceCropped(fc.x, fc.dim, i1, i2);
        fc.applyForce(x1, l2.coord, fc.forceScale(wgt1, l2.nodeWeight, dist), f1, f2);
        l2 = l2.next;
      }
      l1 = l1.next;
    }
  }

  private static _splitAndInteract(first: QuadTree, second: QuadTree, fc: ForceCalc): void {
    for (let i = 0; i < (1 << first.dim); i++) QuadTree._forceInteract(first.qts![i], second, fc);
  }

  private static _interactSplitSelf(qt: QuadTree, fc: ForceCalc): void {
    const dim = qt.dim;
    for (let i = 0; i < (1 << dim); i++)
      for (let j = i; j < (1 << dim); j++)
        QuadTree._forceInteract(qt.qts![i], qt.qts![j], fc);
  }

  private static _interactSplit(qt1: QuadTree, qt2: QuadTree, fc: ForceCalc): void {
    const l1 = qt1.l, l2 = qt2.l;
    if (qt1 === qt2) { QuadTree._interactSplitSelf(qt1, fc); return; }
    if (qt1.width > qt2.width && !l1) { QuadTree._splitAndInteract(qt1, qt2, fc); return; }
    if (qt2.width > qt1.width && !l2) { QuadTree._splitAndInteract(qt2, qt1, fc); return; }
    if (!l1) { QuadTree._splitAndInteract(qt1, qt2, fc); return; }
    if (!l2) QuadTree._splitAndInteract(qt2, qt1, fc);
  }

  private static _forceInteract(qt1: QuadTree | null, qt2: QuadTree | null, fc: ForceCalc): void {
    if (!qt1 || !qt2) return;
    const dim = qt1.dim;
    const dist = pointDistance(qt1.average!, qt2.average!, dim);
    if (qt1.width + qt2.width < fc.bh * dist) {
      fc.counts[0]++;
      const f1 = QuadTree._getOrAllocForceQt(qt1, dim);
      const f2 = QuadTree._getOrAllocForceQt(qt2, dim);
      fc.applyForce(qt1.average!, qt2.average!, fc.forceScale(qt1.totalWeight, qt2.totalWeight, dist), f1, f2);
      return;
    }
    if (qt1.l && qt2.l) { QuadTree._interactLeaves(qt1, qt2, fc); return; }
    QuadTree._interactSplit(qt1, qt2, fc);
  }

  private _forceAccumulate(fc: ForceCalc): void {
    const dim = this.dim, wgt = this.totalWeight;
    const f = QuadTree._getOrAllocForceQt(this, dim);
    fc.counts[2]++;
    if (this.l) {
      let l: NodeData | null = this.l;
      while (l) {
        const f2 = fc.nodeForce(l.id, l);
        const scale = l.nodeWeight / wgt;
        for (let k = 0; k < dim; k++) f2[k] += scale * f[k];
        l = l.next;
      }
      return;
    }
    if (!this.qts) return;
    for (let i = 0; i < (1 << dim); i++) {
      const qt2 = this.qts[i];
      if (!qt2) continue;
      const f2 = QuadTree._getOrAllocForceQt(qt2, dim);
      const scale = qt2.totalWeight / wgt;
      for (let k = 0; k < dim; k++) f2[k] += scale * f[k];
      qt2._forceAccumulate(fc);
    }
  }

  /** @see QuadTree.c:QuadTree_get_repulsive_force */
  getRepulsiveForce(force: Float64Array, x: Float64Array, params: ForceParams, counts: Float64Array): void {
    const n = this.n, dim = this.dim;
    counts.fill(0); force.fill(0);
    const fc = new ForceCalc(force, x, params, counts);
    fc.dim = dim;
    QuadTree._forceInteract(this, this, fc);
    this._forceAccumulate(fc);
    for (let i = 0; i < 4; i++) counts[i] /= n;
  }

  private _scanLeaves(x: Float64Array, state: NearState): void {
    const dim = this.dim;
    let l = this.l;
    while (l) {
      const dist = pointDistance(x, l.coord, dim);
      if (state.min < 0 || dist < state.min) {
        state.min = dist; state.imin = l.id;
        for (let i = 0; i < dim; i++) state.ymin[i] = l.coord[i];
      }
      l = l.next;
    }
  }

  private _nearestTentative(x: Float64Array, state: NearState): void {
    const dim = this.dim;
    let qmin = -1, iq = -1;
    for (let i = 0; i < (1 << dim); i++) {
      if (this.qts![i]) {
        const d = pointDistance(this.qts![i]!.average!, x, dim);
        if (d < qmin || qmin < 0) { qmin = d; iq = i; }
      }
    }
    if (iq >= 0) this.qts![iq]!._getNearestInternal(x, state, true);
  }

  private _getNearestInternal(x: Float64Array, state: NearState, tentative: boolean): void {
    this._scanLeaves(x, state);
    if (!this.qts) return;
    const dist = pointDistance(this.center, x, this.dim);
    if (state.min >= 0 && dist - Math.sqrt(this.dim) * this.width > state.min) return;
    if (tentative) {
      this._nearestTentative(x, state);
    } else {
      for (let i = 0; i < (1 << this.dim); i++)
        this.qts[i]?._getNearestInternal(x, state, false);
    }
  }

  /** @see QuadTree.c:QuadTree_get_nearest */
  getNearest(x: Float64Array): { ymin: Float64Array; imin: number; min: number } {
    const state: NearState = { min: -1, imin: -1, ymin: new Float64Array(this.dim) };
    this._getNearestInternal(x, state, true);
    this._getNearestInternal(x, state, false);
    return state;
  }
}
