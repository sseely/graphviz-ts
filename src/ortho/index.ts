// SPDX-License-Identifier: EPL-2.0
/**
 * Public entry point for orthogonal edge routing.
 *
 * Faithful port of lib/ortho/ortho.c:orthoEdges.
 *
 * @see lib/ortho/ortho.c:orthoEdges
 */

import type {
  OrthoGraph, OrthoEdge, OrthoNode, OrthoPoint,
  Route,
} from "./types.js";
import type { ClipAndInstallFn } from "./types.js";
import { mkMaze, freeMaze } from "./maze.js";
import { extractHChans, extractVChans } from "./maze-channels.js";
import {
  shortPath, pqGenForGraph, pqFree,
  addNodeEdges, addLoop, reset,
} from "./sgraph.js";
import { convertSPtoRoute, assignSegs, assignTracks, vtrack, htrack } from "./ortho-route.js";
import { gvQsort } from "../util/bsd-qsort.js";

export type { OrthoGraph, OrthoEdge, OrthoNode, OrthoPoint, ClipAndInstallFn };
export { SEED } from "./partition.js";

// ─── Edge length / sorting ────────────────────────────────────────────────────

interface EdgePair {
  e: OrthoEdge;
  d: number;
}

/**
 * Squared distance between the two endpoints' CENTERS — used only to order
 * edges for routing. C uses `DIST2(ND_coord(tail), ND_coord(head))`, i.e. the
 * node centres, NOT the bb corners: for nodes of differing width the corner-to-
 * corner length reorders near-equal-length edges, and routing order drives maze
 * channel occupancy (and thus corridor selection). Squared vs sqrt is immaterial
 * to the ordering but kept squared to match C exactly.
 *
 * Read `coord` directly when the caller plumbed it (same fallback pattern as
 * mkMaze's gcell derivation, maze.ts:267-268) rather than re-deriving the
 * centre from `bb` — the bb round-trip ((c-lw)+(c+rw))/2 loses low bits versus
 * C's raw ND_coord read and can flip a qsort tie-order on other graphs. Falls
 * back to the bb centre only for port-less callers that don't model coord.
 * @see lib/ortho/ortho.c:1124 (edgeLen)
 */
export function edgeLen(e: OrthoEdge): number {
  const tcx = e.tail.coord ? e.tail.coord.x : (e.tail.bb.LL.x + e.tail.bb.UR.x) / 2;
  const tcy = e.tail.coord ? e.tail.coord.y : (e.tail.bb.LL.y + e.tail.bb.UR.y) / 2;
  const hcx = e.head.coord ? e.head.coord.x : (e.head.bb.LL.x + e.head.bb.UR.x) / 2;
  const hcy = e.head.coord ? e.head.coord.y : (e.head.bb.LL.y + e.head.bb.UR.y) / 2;
  const dx = tcx - hcx;
  const dy = tcy - hcy;
  return dx * dx + dy * dy;
}

function edgeCmp(a: EdgePair, b: EdgePair): number {
  if (a.d < b.d) return -1;
  if (a.d > b.d) return 1;
  return 0;
}

// ─── Spline assembly ──────────────────────────────────────────────────────────

function buildSpline(
  e: OrthoEdge,
  rte: Route,
  mp: ReturnType<typeof mkMaze>,
): OrthoPoint[] {
  const pts: OrthoPoint[] = [];
  if (rte.segs.length === 0) return pts;

  // C: p1 = ND_coord(tail) + ED_tail_port(e).p, q1 = ND_coord(head) +
  // ED_head_port(e).p (ortho.c:1075-1076). Callers that model ports plumb
  // tailPoint/headPoint through OrthoEdge; a port-less edge (or a caller that
  // does not model ports) has no offset, so fall back to the node's bb centre
  // (= ND_coord for a port-less edge, since the port itself defaults to 0).
  const p1 = e.tailPoint ?? {
    x: (e.tail.bb.LL.x + e.tail.bb.UR.x) / 2,
    y: (e.tail.bb.LL.y + e.tail.bb.UR.y) / 2,
  };
  const q1 = e.headPoint ?? {
    x: (e.head.bb.LL.x + e.head.bb.UR.x) / 2,
    y: (e.head.bb.LL.y + e.head.bb.UR.y) / 2,
  };

  let seg = rte.segs[0];
  let p: OrthoPoint;
  if (seg.isVert) {
    p = { x: vtrack(seg, mp), y: p1.y };
  } else {
    p = { x: p1.x, y: htrack(seg, mp) };
  }
  pts.push({ ...p });
  pts.push({ ...p });

  for (let i = 1; i < rte.segs.length; i++) {
    seg = rte.segs[i];
    if (seg.isVert) p = { x: vtrack(seg, mp), y: p.y };
    else p = { x: p.x, y: htrack(seg, mp) };
    pts.push({ ...p });
    pts.push({ ...p });
    pts.push({ ...p });
  }

  if (seg.isVert) {
    p = { x: vtrack(seg, mp), y: q1.y };
  } else {
    p = { x: q1.x, y: htrack(seg, mp) };
  }
  pts.push({ ...p });
  pts.push({ ...p });

  return pts;
}

// ─── orthoEdges ───────────────────────────────────────────────────────────────

/**
 * For edges without position information, construct an orthogonal routing.
 * If useLbls is true, issues a warning and sets useLbls=false.
 *
 * @see lib/ortho/ortho.c:orthoEdges
 */
export function orthoEdges(
  g: OrthoGraph,
  useLbls: boolean,
  clipAndInstall?: ClipAndInstallFn,
): void {
  if (useLbls) {
    console.warn(
      "Orthogonal edges do not currently handle edge labels. Try using xlabels.\n",
    );
    useLbls = false; // eslint-disable-line no-param-reassign
  }
  void useLbls; // suppress lint on intentional reassign

  const mp = mkMaze(g);
  const sg = mp.sg;

  // collect and sort edges by length. C ortho.c sorts via qsort(edgecmp), which
  // is UNSTABLE and returns 0 on equal length, so equal-length edges' routing
  // order is qsort's, not insertion order. @see util/bsd-qsort.ts · ortho.c:1231
  const es: EdgePair[] = g.edges.map((e) => ({ e, d: edgeLen(e) }));
  gvQsort(es, edgeCmp);
  const nEdges = es.length;

  const routeList: Route[] = new Array(nEdges).fill(null).map(() => ({ segs: [] }));
  const gstart = sg.nnodes;
  const pq = pqGenForGraph(sg);
  const sn = sg.nodes[gstart];
  const dn = sg.nodes[gstart + 1];

  // ensure the two dummy nodes exist
  while (sg.nodes.length < gstart + 2) {
    sg.nodes.push({
      nVal: 0, nIdx: 0, nDad: null, nEdge: null,
      nAdj: 0, saveNAdj: 0, cells: [null, null],
      adjEdgeList: [], index: sg.nodes.length, isVert: false, x: 0, y: 0,
    });
  }

  for (let i = 0; i < nEdges; i++) {
    const e = es[i].e;
    const start = mp.gcells[g.nodes.indexOf(e.tail)];
    const dest = mp.gcells[g.nodes.indexOf(e.head)];

    if (start === dest) {
      addLoop(sg, start, dn, sn);
    } else {
      addNodeEdges(sg, dest, dn);
      addNodeEdges(sg, start, sn);
    }

    if (shortPath(pq, sg, dn, sn) !== 0) {
      pqFree(pq);
      freeMaze(mp);
      return;
    }

    routeList[i] = convertSPtoRoute(sg, sn, dn);
    reset(sg);
  }
  pqFree(pq);

  mp.hchans = extractHChans(mp);
  mp.vchans = extractVChans(mp);
  assignSegs(routeList, mp);
  if (assignTracks(mp) !== 0) {
    freeMaze(mp);
    return;
  }

  if (clipAndInstall) {
    for (let i = 0; i < nEdges; i++) {
      const pts = buildSpline(es[i].e, routeList[i], mp);
      if (pts.length > 0) {
        clipAndInstall(g, es[i].e, pts, true);
      }
    }
  }

  freeMaze(mp);
}
