// SPDX-License-Identifier: EPL-2.0

/**
 * Cluster expansion ports: after the parent layout positions a
 * cluster's derived node, the angles of its edges induce boundary
 * ports for the cluster's own recursive layout.
 *
 * Spec read at the 15.0.0 tag.
 *
 * @see lib/fdpgen/layout.c:getEdgeList / genPorts / expandCluster
 *      (15.0.0)
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import {
  type Bport,
  gdata,
  dndata,
  getDnode,
  realEdges,
} from './fdp-model.js';

/** Maximum angular change: 2 degrees. @see lib/fdpgen/layout.c:ANG */
const ANG = Math.PI / 90;

/** Edge record for angular sorting. @see lib/fdpgen/layout.c:erec */
interface Erec {
  e: Edge;
  alpha: number;
  dist2: number;
}

/** Sort edges by angle, then distance. @see lib/fdpgen/layout.c:ecmp */
function ecmp(e1: Erec, e2: Erec): number {
  if (e1.alpha > e2.alpha) return 1;
  if (e1.alpha < e2.alpha) return -1;
  if (e1.dist2 > e2.dist2) return 1;
  if (e1.dist2 < e2.dist2) return -1;
  return 0;
}

/** Spread runs of equal angles by up to ANG. @see layout.c:576-601 */
function spreadEqualAngles(erecs: Erec[], deg: number): void {
  let i = 0;
  while (i < deg - 1) {
    const a = erecs[i]!.alpha;
    let j = i + 1;
    while (j < deg && erecs[j]!.alpha === a) j++;
    if (j === i + 1) {
      i = j;
    } else {
      const bnd = j === deg ? Math.PI : erecs[j]!.alpha;
      const delta = Math.min((bnd - a) / (j - i), ANG);
      let inc = 0;
      for (; i < j; i++) {
        erecs[i]!.alpha += inc;
        inc += delta;
      }
    }
  }
}

/**
 * Counterclockwise-sorted list of the derived edges at n, with ties
 * broken apart angularly. Assumes g has an initial layout.
 * @see lib/fdpgen/layout.c:getEdgeList
 */
export function getEdgeList(n: Node, g: Graph): Erec[] {
  const deg = dndata(n).deg;
  const erecs: Erec[] = [];
  // agfstedge order: out-edges then in-edges
  for (const e of [...n.outEdges(g), ...n.inEdges(g)]) {
    const m = e.head === n ? e.tail : e.head;
    const dx = m.info.pos![0]! - n.info.pos![0]!;
    const dy = m.info.pos![1]! - n.info.pos![1]!;
    erecs.push({ e, alpha: Math.atan2(dy, dx), dist2: dx * dx + dy * dy });
  }
  if (erecs.length !== deg) {
    throw new Error(`fdp getEdgeList: ${erecs.length} edges vs deg ${deg}`);
  }
  erecs.sort(ecmp);

  /* ensure no two angles are equal */
  if (deg >= 2) spreadEqualAngles(erecs, deg);

  return erecs;
}

/**
 * Append the ports corresponding to one derived edge at n to pp,
 * fanning multi-edges between alpha and bnd. Real-edge order reverses
 * when n is the later-created endpoint (C pointer comparison).
 * @see lib/fdpgen/layout.c:genPorts
 */
export function genPorts(
  n: Node, er: Erec, pp: Bport[], idx: number, bnd: number,
): number {
  const e = er.e;
  const cnt = e.info.count ?? 0;
  const other = e.head === n ? e.tail : e.head;

  const delta = Math.min((bnd - er.alpha) / cnt, ANG);
  // C: n < other (pointer order) → ascending fill; else reversed
  const fwd = n.id < other.id;
  const fan = fwd
    ? { i: idx, inc: 1, angle: er.alpha, delta }
    : { i: idx + cnt - 1, inc: -1, angle: er.alpha + delta * (cnt - 1), delta: -delta };

  fillPorts(n, e, pp, fan);
  return idx + cnt;
}

/** Write one derived edge's real-edge ports at fanned angles. */
function fillPorts(
  n: Node,
  e: Edge,
  pp: Bport[],
  fan: { i: number; inc: number; angle: number; delta: number },
): void {
  for (const el of realEdges(e)) {
    pp[fan.i] = {
      e: el,
      n: getDnode(el.tail) === n ? el.tail : el.head,
      alpha: fan.angle,
    };
    fan.i += fan.inc;
    fan.angle += fan.delta;
  }
}

/**
 * Attach ports induced by the layout of cg to the cluster subgraph
 * that derived node n represents.
 * @see lib/fdpgen/layout.c:expandCluster
 */
export function expandCluster(n: Node, cg: Graph): Graph {
  const sg = dndata(n).clust!;
  const sz = dndata(n).wdeg;
  if (sz !== 0) {
    const pp: Bport[] = [];
    /* create sorted list of edges of n */
    const es = getEdgeList(n, cg);

    /* generate ports from edges */
    let idx = 0;
    for (let k = 0; k < es.length; k++) {
      const next = es[k + 1];
      const bnd = next !== undefined ? next.alpha : 2 * Math.PI + es[0]!.alpha;
      idx = genPorts(n, es[k]!, pp, idx, bnd);
    }
    if (idx !== sz) {
      throw new Error(`fdp expandCluster: ${idx} ports vs wdeg ${sz}`);
    }

    gdata(sg).ports = pp;
    gdata(sg).nports = sz;
  }
  return sg;
}
