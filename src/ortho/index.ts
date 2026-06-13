// SPDX-License-Identifier: EPL-2.0
/**
 * Public entry point for orthogonal edge routing.
 *
 * Faithful port of lib/ortho/ortho.c:orthoEdges.
 *
 * @see lib/ortho/ortho.c:orthoEdges
 */

import type {
  OrthoGraph, OrthoEdge, OrthoPoint,
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

export type { OrthoGraph, OrthoEdge, OrthoPoint, ClipAndInstallFn };
export { SEED } from "./partition.js";

// ─── Edge length / sorting ────────────────────────────────────────────────────

interface EdgePair {
  e: OrthoEdge;
  d: number;
}

function edgeLen(e: OrthoEdge): number {
  const dx = e.tail.bb.LL.x - e.head.bb.LL.x;
  const dy = e.tail.bb.LL.y - e.head.bb.LL.y;
  return Math.sqrt(dx * dx + dy * dy);
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

  const p1 = { x: e.tail.bb.LL.x, y: e.tail.bb.LL.y };
  const q1 = { x: e.head.bb.LL.x, y: e.head.bb.LL.y };

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

  // collect and sort edges by length
  const es: EdgePair[] = g.edges.map((e) => ({ e, d: edgeLen(e) }));
  es.sort(edgeCmp);
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
      adjEdgeList: [], index: sg.nodes.length, isVert: false,
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
