// SPDX-License-Identifier: EPL-2.0

/**
 * fdp initial placement: seed the RNG, size the boundary ellipse/box,
 * place ports on the ellipse and free nodes within it.
 *
 * drand48 call order is load-bearing (exact LCG port in
 * src/common/random.ts); node iteration is the component's id order
 * and the per-node edge scan is out-edges then in-edges (agfstedge).
 *
 * Spec read at the 15.0.0 tag.
 *
 * @see lib/fdpgen/tlayout.c:initPositions (15.0.0)
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { Point } from '../../model/geom.js';
import { srand48, drand48 } from '../../common/random.js';
import {
  type Bport,
  dndata,
  isPort,
  hasPos,
  gdata,
  P_SET,
} from './fdp-model.js';
import { parms, EXPFACTOR, INIT_RANDOM } from './tlayout-parms.js';

/** Pinned-node bounding box, C-style running min/max. */
interface PinBB {
  llx: number;
  lly: number;
  urx: number;
  ury: number;
}

/** All edges of np in g: out-edges then in-edges (agfstedge order). */
function allEdges(g: Graph, np: Node): Edge[] {
  return [...np.outEdges(g), ...np.inEdges(g)];
}

/**
 * Average the positions of already-placed neighbors; fall back to a
 * random point in the boundary ellipse.
 * @see lib/fdpgen/tlayout.c:initPositions (port branch, unpinned case)
 */
function placeByNeighbors(g: Graph, np: Node, ctr: Point): void {
  const p: Point = { x: 0.0, y: 0.0 };
  const cnt = averagePlacedNeighbors(g, np, p);
  if (cnt > 1) {
    np.info.pos![0] = p.x;
    np.info.pos![1] = p.y;
  } else if (cnt === 1) {
    np.info.pos![0] = 0.98 * p.x + 0.1 * ctr.x;
    np.info.pos![1] = 0.9 * p.y + 0.1 * ctr.y;
  } else {
    const angle = Math.PI * 2.0 * drand48();
    const radius = 0.9 * drand48();
    np.info.pos![0] = radius * parms.Wd * Math.cos(angle);
    np.info.pos![1] = radius * parms.Ht * Math.sin(angle);
  }
  dndata(np).pinned = P_SET;
}

/**
 * Running average of already-placed neighbor positions into p;
 * returns the neighbor count.
 * @see lib/fdpgen/tlayout.c:initPositions (cnt accumulation loop)
 */
function averagePlacedNeighbors(g: Graph, np: Node, p: Point): number {
  let cnt = 0;
  for (const ep of allEdges(g, np)) {
    if (ep.head === ep.tail) continue;
    const op = ep.head === np ? ep.tail : ep.head;
    if (!hasPos(op)) continue;
    if (cnt) {
      p.x = (p.x * cnt + op.info.pos![0]!) / (cnt + 1);
      p.y = (p.y * cnt + op.info.pos![1]!) / (cnt + 1);
    } else {
      p.x = op.info.pos![0]!;
      p.y = op.info.pos![1]!;
    }
    cnt++;
  }
  return cnt;
}

/** Bounding box and count of pinned nodes. */
function pinnedBB(g: Graph): { bb: PinBB; nPos: number } {
  const bb: PinBB = { llx: 0, lly: 0, urx: 0, ury: 0 };
  let nPos = 0;
  for (const np of g.nodes.values()) {
    if (dndata(np).pinned) {
      if (nPos) {
        bb.llx = Math.min(np.info.pos![0]!, bb.llx);
        bb.lly = Math.min(np.info.pos![1]!, bb.lly);
        bb.urx = Math.max(np.info.pos![0]!, bb.urx);
        bb.ury = Math.max(np.info.pos![1]!, bb.ury);
      } else {
        bb.urx = bb.llx = np.info.pos![0]!;
        bb.ury = bb.lly = np.info.pos![1]!;
      }
      nPos++;
    }
  }
  return { bb, nPos };
}

/**
 * Boundary sizing for the n_pos > 1 case: grow Wd/Ht to cover the
 * pinned bbox, then construct the enclosing ellipse.
 * @see lib/fdpgen/tlayout.c:initPositions (n_pos > 1 branch)
 */
function boundaryFromBB(bb: PinBB): Point {
  const ctr: Point = {
    x: (bb.llx + bb.urx) / 2.0,
    y: (bb.lly + bb.ury) / 2.0,
  };
  const width = EXPFACTOR * (bb.urx - bb.llx);
  const height = EXPFACTOR * (bb.ury - bb.lly);
  sizeBoundary(width, height);

  /* Construct enclosing ellipse */
  const alpha = Math.atan2(parms.Ht, parms.Wd);
  parms.Wd = parms.Wd / Math.cos(alpha);
  parms.Ht = parms.Ht / Math.sin(alpha);
  return ctr;
}

/**
 * Grow Wd/Ht so the boundary has at least the default area while
 * matching the pinned bbox aspect.
 * @see lib/fdpgen/tlayout.c:initPositions (quot branches)
 */
function sizeBoundary(width: number, height: number): void {
  const area = 4.0 * parms.Wd * parms.Ht;
  let quot = width * height / area;
  if (quot >= 1.0) { /* If bbox has large enough area, use it */
    parms.Wd = width / 2.0;
    parms.Ht = height / 2.0;
  } else if (quot > 0.0) { /* else scale up to have enough area */
    quot = 2.0 * Math.sqrt(quot);
    parms.Wd = width / quot;
    parms.Ht = height / quot;
  } else if (width > 0) { /* height is 0 */
    parms.Wd = width / 2.0;
    parms.Ht = area / width / 2.0;
  } else if (height > 0) { /* width is 0 */
    parms.Wd = area / height / 2.0;
    parms.Ht = height / 2.0;
  }
  /* If width = height = 0, keep Wd/Ht as for the n_pos == 0 case */
}

/**
 * Port-graph placement: ports pinned on the ellipse, other nodes by
 * neighbor averaging or randomly inside it.
 * @see lib/fdpgen/tlayout.c:initPositions (pp branch)
 */
function placeWithPorts(g: Graph, pp: Bport[], ctr: Point): void {
  for (const port of pp) { /* position ports on ellipse */
    const np = port.n;
    np.info.pos![0] = parms.Wd * Math.cos(port.alpha) + ctr.x;
    np.info.pos![1] = parms.Ht * Math.sin(port.alpha) + ctr.y;
    dndata(np).pinned = P_SET;
  }
  for (const np of g.nodes.values()) {
    if (isPort(np)) continue;
    if (dndata(np).pinned) {
      np.info.pos![0]! -= ctr.x;
      np.info.pos![1]! -= ctr.y;
    } else {
      placeByNeighbors(g, np, ctr);
    }
  }
}

/** Random/translated placement when there are no ports. */
function placeWithoutPorts(g: Graph, nPos: number, ctr: Point): void {
  if (nPos) { /* If positioned nodes */
    for (const np of g.nodes.values()) {
      if (dndata(np).pinned) {
        np.info.pos![0]! -= ctr.x;
        np.info.pos![1]! -= ctr.y;
      } else {
        np.info.pos![0] = parms.Wd * (2.0 * drand48() - 1.0);
        np.info.pos![1] = parms.Ht * (2.0 * drand48() - 1.0);
      }
    }
  } else { /* No ports or positions; place randomly */
    for (const np of g.nodes.values()) {
      np.info.pos![0] = parms.Wd * (2.0 * drand48() - 1.0);
      np.info.pos![1] = parms.Ht * (2.0 * drand48() - 1.0);
    }
  }
}

/**
 * Create the initial layout of one derived component.
 * @see lib/fdpgen/tlayout.c:initPositions
 */
export function initPositions(g: Graph, pp: Bport[] | null): Point {
  const nG = g.nodes.size - gdata(g).nports;
  const { bb, nPos } = pinnedBB(g);
  let ctr: Point = { x: 0, y: 0 };

  const size = parms.K * (Math.sqrt(nG) + 1.0);
  parms.Wd = parms.Ht = EXPFACTOR * (size / 2.0);
  if (nPos === 1) {
    ctr = { x: bb.llx, y: bb.lly };
  } else if (nPos > 1) {
    ctr = boundaryFromBB(bb);
  }

  /* Set seed value */
  const localSeed = parms.smode === INIT_RANDOM
    ? parms.seed
    : Math.floor(Date.now() / 1000); // C: time(NULL)
  srand48(localSeed);

  if (pp) {
    placeWithPorts(g, pp, ctr);
  } else {
    placeWithoutPorts(g, nPos, ctr);
  }

  return ctr;
}
