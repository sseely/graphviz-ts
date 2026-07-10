// SPDX-License-Identifier: EPL-2.0
/**
 * Curved / straight edge generator for the dot engine.
 *
 * Faithful port of `makeStraightEdges` and its helpers `bend`,
 * `get_cycle_centroid`, `get_centroid` and the cycle-finding routines from
 * `lib/common/routespl.c`. Used by `splines=curved` (`EDGETYPE_CURVED`): each
 * parallel-edge group is routed by `makeStraightEdges` instead of the normal
 * per-group spline router (mirroring `dotsplines.c:381-387`).
 *
 * Reuses the ported `clipAndInstall` (`common/splines-clip.ts`). `addEdgeLabels`
 * mirrors `makePortLabels` (`splines.c:1205-1220,1307-1309`): a no-op unless
 * `labelangle`/`labeldistance` is declared.
 *
 * @see lib/common/routespl.c:773-1042
 * @see lib/dotgen/dotsplines.c:381-387 (curved dispatch)
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { Point } from '../../model/geom.js';
import type { SplineInfo } from '../../common/types.js';
import { clipAndInstall } from '../../common/splines-clip.js';
import { approxEqPt } from '../../common/splines-geom.js';
import { MILLIPOINT } from '../../common/splines-constants.js';
import { dist } from '../../common/arrows-geometry.js';
import { midPointf } from './compound-geom.js';
import { placePortlabel, updateBB } from './splines-label.js';
import { dotRoot } from './mincross-utils.js';
import { nodesInSeq } from './decomp.js';

// Edge-type values, mirroring the constants in splines.ts. Defined locally to
// avoid a straight-edges ↔ splines import cycle (splines.ts imports
// makeStraightEdges from here). @see lib/dotgen/dotsplines.c (EDGETYPE_*)
const EDGETYPE_CURVED = 2;
const EDGETYPE_PLINE = 3;

/** C `add_pointf`. @see lib/common/utils.c:add_pointf */
function addPointf(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

// ---------------------------------------------------------------------------
// Cycle centroid (curved bend target)
// @see lib/common/routespl.c:773-931
// ---------------------------------------------------------------------------

/**
 * Centroid of the graph bounding box — the fallback bend target.
 * @see lib/common/routespl.c:773-780 (get_centroid)
 */
function getCentroid(g: Graph): Point {
  const bb = g.info.bb;
  return {
    x: (bb.ll.x + bb.ur.x) / 2.0,
    y: (bb.ll.y + bb.ur.y) / 2.0,
  };
}

/**
 * True iff the directed edge (tail→head) appears as a consecutive pair in the
 * cyclic node list. @see lib/common/routespl.c:793-809 (cycle_contains_edge)
 */
function cycleContainsEdge(cycle: Node[], edge: Edge): boolean {
  const start = edge.tail;
  const end = edge.head;
  const cycleLen = cycle.length;
  for (let i = 0; i < cycleLen; i++) {
    const cStart = cycle[i === 0 ? cycleLen - 1 : i - 1];
    const cEnd = cycle[i];
    if (cStart === start && cEnd === end) return true;
  }
  return false;
}

/**
 * True iff `cycle` is not a permutation of an already-recorded cycle of equal
 * length. @see lib/common/routespl.c:811-837 (is_cycle_unique)
 */
function isCycleUnique(cycles: Node[][], cycle: Node[]): boolean {
  const cycleLen = cycle.length;
  for (const curCycle of cycles) {
    if (curCycle.length === cycleLen) {
      let allItemsMatch = true;
      for (const item of curCycle) {
        if (!cycle.includes(item)) {
          allItemsMatch = false;
          break;
        }
      }
      if (allItemsMatch) return false;
    }
  }
  return true;
}

/**
 * Depth-first walk collecting unique simple cycles back to `end`.
 *
 * NOTE: C iterates `agfstout(g, search)`; this uses `outEdges(g)` (same
 * adjacency). For cycles of length ≥ 3 the routing graph may carry virtual
 * chain nodes; no curved fixture exercises a ≥3 cycle (all hit `getCentroid`),
 * so that path is ported for fidelity but untested here.
 * @see lib/common/routespl.c:839-862 (dfs)
 */
function dfs(g: Graph, search: Node, visited: Node[], end: Node, cycles: Node[][]): void {
  if (visited.includes(search)) {
    if (search === end) {
      if (isCycleUnique(cycles, visited)) {
        cycles.push([...visited]);
      }
    }
  } else {
    visited.push(search);
    for (const e of search.outEdges(g)) {
      dfs(g, e.head, visited, end, cycles);
    }
    if (visited.length > 0) {
      visited.pop();
    }
  }
}

/** @see lib/common/routespl.c:864-882 (find_all_cycles) */
function findAllCycles(g: Graph): Node[][] {
  const cycles: Node[][] = [];
  for (const n of nodesInSeq(g)) {
    dfs(g, n, [], n, cycles);
  }
  return cycles;
}

/**
 * Shortest recorded cycle (of length ≥ `minSize`) that contains `edge`.
 * @see lib/common/routespl.c:884-902 (find_shortest_cycle_with_edge)
 */
function findShortestCycleWithEdge(cycles: Node[][], edge: Edge, minSize: number): Node[] | null {
  let shortest: Node[] | null = null;
  for (const cycle of cycles) {
    const cycleLen = cycle.length;
    if (cycleLen < minSize) continue;
    if (shortest === null || shortest.length > cycleLen) {
      if (cycleContainsEdge(cycle, edge)) {
        shortest = cycle;
      }
    }
  }
  return shortest;
}

/**
 * Center of the shortest cycle (length ≥ 3) containing `edge`, else the graph
 * bbox centroid. @see lib/common/routespl.c:904-931 (get_cycle_centroid)
 */
function getCycleCentroid(g: Graph, edge: Edge): Point {
  const cycles = findAllCycles(g);
  // cycles of length 2 do their own thing; we want 3 or more
  const cycle = findShortestCycleWithEdge(cycles, edge, 3);
  if (cycle === null) {
    return getCentroid(g);
  }
  let sumX = 0.0;
  let sumY = 0.0;
  let cnt = 0;
  for (const n of cycle) {
    sumX += n.info.coord.x;
    sumY += n.info.coord.y;
    cnt++;
  }
  return { x: sumX / cnt, y: sumY / cnt };
}

// ---------------------------------------------------------------------------
// bend — pull the two interior control points toward the centroid
// @see lib/common/routespl.c:933-952
// ---------------------------------------------------------------------------

/** @see lib/common/routespl.c:933-952 (bend) */
function bend(spl: Point[], centroid: Point): void {
  const midpt = midPointf(spl[0], spl[3]);
  const distVal = dist(spl[3], spl[0]); // DIST(spl[3], spl[0])
  const r = distVal / 5.0;
  const vX = centroid.x - midpt.x;
  const vY = centroid.y - midpt.y;
  const magV = Math.hypot(vX, vY);
  if (magV === 0) return; // midpoint == centroid: don't divide by zero
  const ax = midpt.x - (vX / magV) * r; // + would be closest point
  const ay = midpt.y - (vY / magV) * r;
  // this can be improved
  spl[1].x = spl[2].x = ax;
  spl[1].y = spl[2].y = ay;
}

// ---------------------------------------------------------------------------
// addEdgeLabels — port labels at edge endpoints
// @see lib/common/splines.c:1205-1220 (makePortLabels), :1307-1309 (addEdgeLabels)
// ---------------------------------------------------------------------------

/**
 * True iff the `labelangle`/`labeldistance` attribute is declared (graph- or
 * edge-level). Mirrors C's `E_labelangle`/`E_labeldistance` symbol test.
 */
function portLabelAttrsDeclared(g: Graph): boolean {
  if (g.attrs.has('labelangle') || g.attrs.has('labeldistance')) return true;
  for (const e of g.edges) {
    if (e.attrs.has('labelangle') || e.attrs.has('labeldistance')) return true;
  }
  return false;
}

/**
 * Adds head/tail port labels and updates the bbox. No-op unless
 * `labelangle`/`labeldistance` is declared (handled as external labels
 * otherwise). @see lib/common/splines.c:1205-1220,1307-1309
 */
export function addEdgeLabels(e: Edge): void {
  const g = dotRoot(e.tail.root);
  if (!portLabelAttrsDeclared(g)) return;
  if (e.info.head_label && !e.info.head_label.set) {
    if (placePortlabel(e, true)) updateBB(g, e.info.head_label);
  }
  if (e.info.tail_label && !e.info.tail_label.set) {
    if (placePortlabel(e, false)) updateBB(g, e.info.tail_label);
  }
}

// ---------------------------------------------------------------------------
// makeStraightEdges
// @see lib/common/routespl.c:975-1042
// ---------------------------------------------------------------------------

/** GD_nodesep of the root graph. @see lib/common/macros.h:GD_nodesep */
function nodesepRoot(g: Graph): number {
  return g.root.info.nodesep ?? 18;
}

/**
 * Spread the two interior control points symmetrically along the perpendicular
 * to the tail→head line and return the per-edge increment `del`. Mutates
 * `dumb[1]`/`dumb[2]` in place. @see lib/common/routespl.c:993-1015
 */
function spreadControlPoints(dumb: Point[], eCnt: number, g: Graph): Point {
  if (approxEqPt(dumb[0], dumb[3], MILLIPOINT)) {
    // degenerate case
    dumb[1] = { ...dumb[0] };
    dumb[2] = { ...dumb[3] };
    return { x: 0, y: 0 };
  }
  const perp: Point = {
    x: dumb[0].y - dumb[3].y,
    y: dumb[3].x - dumb[0].x,
  };
  const lPerp = Math.hypot(perp.x, perp.y);
  const xstep = Math.trunc(nodesepRoot(g)); // int xstep = GD_nodesep(g->root)
  const dx = Math.trunc((xstep * (eCnt - 1)) / 2); // integer arithmetic
  dumb[1].x = dumb[0].x + (dx * perp.x) / lPerp;
  dumb[1].y = dumb[0].y + (dx * perp.y) / lPerp;
  dumb[2].x = dumb[3].x + (dx * perp.x) / lPerp;
  dumb[2].y = dumb[3].y + (dx * perp.y) / lPerp;
  return {
    x: (-xstep * perp.x) / lPerp,
    y: (-xstep * perp.y) / lPerp,
  };
}

/**
 * Orient the shared control points for one edge in the group: forward order if
 * its head matches the group head, reversed otherwise.
 * @see lib/common/routespl.c:1019-1028
 */
function orientControlPoints(dumb: Point[], e0: Edge, head: Node): Point[] {
  const dumber: Point[] = [];
  if (e0.head === head) {
    for (let j = 0; j < 4; j++) dumber[j] = { ...dumb[j] };
  } else {
    for (let j = 0; j < 4; j++) dumber[3 - j] = { ...dumb[j] };
  }
  return dumber;
}

/** Install one straight/polyline edge spline. @see lib/common/routespl.c:1029-1036 */
function installStraight(e0: Edge, dumber: Point[], et: number, sinfo: SplineInfo): void {
  if (et === EDGETYPE_PLINE) {
    // make_polyline is unported; the dot curved dispatch only passes
    // EDGETYPE_CURVED, so this branch is structurally unreachable here.
    // @see lib/common/routespl.c:1029-1034
    throw new Error('makeStraightEdges: EDGETYPE_PLINE branch unported (make_polyline)');
  }
  clipAndInstall(e0, e0.head, dumber, 4, sinfo);
}

/**
 * Route a group of straight/curved edges between the same endpoints.
 *
 * Single edge (or `Concentrate`): a 4-point bezier from tail port to head port,
 * bent toward the cycle centroid when curved. Multiple edges: control points
 * spread symmetrically along the perpendicular by `GD_nodesep` steps.
 *
 * `edgeList[0]` is the main edge (per `dotsplines.c:383`); the head of each
 * subsequent edge is compared to the group head to orient its control points.
 *
 * @see lib/common/routespl.c:975-1042
 */
export function makeStraightEdges(g: Graph, edgeList: Edge[], eCnt: number, et: number, sinfo: SplineInfo): void {
  const curved = et === EDGETYPE_CURVED;
  const e = edgeList[0];
  const head = e.head;
  const tailPt = addPointf(e.tail.info.coord, e.info.tail_port.p);
  const headPt = addPointf(head.info.coord, e.info.head_port.p);
  // dumb[1]=dumb[0]=tail; dumb[2]=dumb[3]=head (distinct objects)
  const dumb: Point[] = [{ ...tailPt }, { ...tailPt }, { ...headPt }, { ...headPt }];

  if (eCnt === 1 || (dotRoot(g).info.concentrate ?? false)) {
    if (curved) bend(dumb, getCycleCentroid(g, edgeList[0]));
    clipAndInstall(e, e.head, dumb, 4, sinfo);
    addEdgeLabels(e);
    return;
  }

  const del = spreadControlPoints(dumb, eCnt, g);
  for (let i = 0; i < eCnt; i++) {
    const e0 = edgeList[i];
    installStraight(e0, orientControlPoints(dumb, e0, head), et, sinfo);
    addEdgeLabels(e0);
    dumb[1] = addPointf(dumb[1], del);
    dumb[2] = addPointf(dumb[2], del);
  }
}
