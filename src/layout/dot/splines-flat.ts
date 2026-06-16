// SPDX-License-Identifier: EPL-2.0

/**
 * make_flat_edge, make_flat_adj_edges and helpers — flat edge spline routing.
 *
 * Flat edges connect nodes on the same rank. The adjacent-node case
 * (make_flat_adj_edges) recursively invokes the full dot pipeline on a
 * cloned subgraph. Full pathplan routing is deferred until pathplan.ts
 * is ported.
 *
 * @see lib/dotgen/dotsplines.c:make_flat_edge, make_flat_adj_edges
 */

import { Graph } from '../../model/graph.js';
import type { Edge } from '../../model/edge.js';
import type { Node } from '../../model/node.js';
import type { Box, Point } from '../../model/geom.js';
import type { Path, PathendT } from '../../common/types.js';
import type { SplineInfo } from './splines-route.js';
import { dotRank } from './rank.js';
import { dotMincross } from './mincross.js';
import { dotPosition } from './position.js';
import { dotSameports } from './sameport.js';
import { dotSplines_ } from './splines.js';
import { makePort } from '../../model/edgeInfo.js';
import { beginPath } from '../../common/splines-path-begin.js';
import { endPath } from '../../common/splines-path-end.js';
import { routeSplines } from '../../common/splines-routespl.js';
import { addBox, resolvePort } from '../../common/splines-path-shared.js';
import { TOP, BOTTOM, FLATEDGE } from '../../common/splines-constants.js';
import {
  maximalBbox, appendRegularEnd, freshEndp, type BboxCtx,
} from './edge-route-faithful.js';
import { computeLeftBound, computeRightBound } from './edge-route-rank.js';
import { graphRanksep } from './position-aux.js';
import { Edge as EdgeClass } from '../../model/edge.js';
import { cloneNode, cloneEdge, cleanupCloneGraph, transformf } from './splines-clone.js';
import { dotInitNodeEdge } from './init.js';
import { gvPostprocess } from '../../common/postproc.js';
import { newSpline } from '../../common/splines-clip.js';
import { updateBbBz } from '../../common/splines-geom.js';
import { NORMAL, VIRTUAL } from './fastgr.js';
import { EDGE_LABEL } from './rank.js';

/** Bundled args for makeFlatEndBox (keeps params <= 5). Declared here (not
 * between functions) so lizard's TS parser doesn't fold it into a neighbor. */
interface FlatEndParts {
  ctx: BboxCtx;
  P: Path;
  e: Edge;
  n: Node;
  side: number;
  ranksep: number;
  isBegin: boolean;
}

// ---------------------------------------------------------------------------
// cloneGraph — build auxiliary graph for flat adj routing
// @see lib/dotgen/dotsplines.c:cloneGraph
// ---------------------------------------------------------------------------

/**
 * Create a minimal clone of g for flat-adj routing.
 * @see lib/dotgen/dotsplines.c:cloneGraph
 */
export function cloneGraph(g: Graph): Graph {
  const auxg = new Graph('auxg', g.kind);
  auxg.info.nodesep = g.info.nodesep;
  auxg.info.ranksep = g.info.ranksep;
  auxg.info.flags = g.info.flags;
  // Mirror C cloneGraph: if parent is flipped (LR/RL) set rankdir=TB on auxg,
  // else set rankdir=LR. The flat-adj pipeline needs the inverse axis.
  // @see lib/dotgen/dotsplines.c:787-790
  if (g.info.flip) {
    // SET_RANKDIR(auxg, RANKDIR_TB): rankdir=0, flip=false
    auxg.info.rankdir = 0;
    auxg.info.flip = false;
  } else {
    // SET_RANKDIR(auxg, RANKDIR_LR): rankdir=(1<<2)|1=5, flip=true
    auxg.info.rankdir = (1 << 2) | 1;
    auxg.info.flip = true;
  }
  auxg.info.dotroot = auxg;
  auxg.info.gvc = g.info.gvc;
  return auxg;
}

// ---------------------------------------------------------------------------
// runAuxPipeline — rank + mincross + position on the cloned graph
// ---------------------------------------------------------------------------

/** Run rank, mincross, position on auxg; return non-zero on failure. */
export function runAuxPipeline(auxg: Graph): number {
  dotRank(auxg);
  const r = dotMincross(auxg);
  if (r !== 0) return r;
  return dotPosition(auxg);
}

/** Run sameports + splines (no normalize) on auxg; return non-zero on failure. */
export function runAuxSplines(auxg: Graph): number {
  dotSameports(auxg);
  return dotSplines_(auxg, false);
}

// ---------------------------------------------------------------------------
// make_flat_adj_edges — recursive pipeline for adjacent flat edges
// @see lib/dotgen/dotsplines.c:make_flat_adj_edges
// ---------------------------------------------------------------------------

/**
 * Route flat edges between adjacent nodes by running the full dot pipeline
 * on a cloned subgraph (rotated 90°).
 *
 * Acceptance criterion 1: after this call, the cloned graph's nodes have
 * coord set (verified by dotPosition setting ND_coord).
 *
 * @see lib/dotgen/dotsplines.c:make_flat_adj_edges
 */
/** Aux graph + the two cloned endpoints + original→aux edge map. */
interface FlatAux { auxg: Graph; auxt: Node; auxh: Node; alg: Map<Edge, Edge>; }

/** Walk an edge to its NORMAL original. @see make_flat_adj_edges (ED_to_orig loop) */
function toNormalEdge(e: Edge): Edge {
  let cur = e;
  while ((cur.info.edge_type ?? NORMAL) !== NORMAL && cur.info.to_orig != null) {
    cur = cur.info.to_orig;
  }
  return cur;
}

/** True when an edge has no declared port on either end. */
function isPortless(e: Edge): boolean {
  return !e.info.tail_port.defined && !e.info.head_port.defined;
}

/** Clone one edge into the aux graph, oriented tail→head from the original. */
function cloneFlatEdge(auxg: Graph, otn: Node, auxt: Node, auxh: Node, orig: Edge): Edge {
  return orig.tail === otn
    ? cloneEdge(auxg, auxt, auxh, orig) : cloneEdge(auxg, auxh, auxt, orig);
}

/**
 * Build the rotated auxiliary graph: clone tail/head + each edge, then add a
 * heavy ordering edge so the pair lands on adjacent ranks.
 * @see lib/dotgen/dotsplines.c:make_flat_adj_edges (clone + hvye)
 */
function buildFlatAux(g: Graph, edges: Edge[], cnt: number): FlatAux {
  const otn = edges[0].tail;
  const flip = g.info.flip ?? false;
  const auxg = cloneGraph(g);
  const auxt = cloneNode(auxg, flip ? edges[0].head : otn);
  const auxh = cloneNode(auxg, flip ? otn : edges[0].head);
  const alg = new Map<Edge, Edge>();
  let hvye: Edge | null = null;
  for (let i = 0; i < cnt; i++) {
    const orig = toNormalEdge(edges[i]);
    const auxe = cloneFlatEdge(auxg, otn, auxt, auxh, orig);
    alg.set(orig, auxe);
    if (hvye === null && isPortless(orig)) hvye = auxe;
  }
  if (hvye === null) { hvye = new EdgeClass(auxt, auxh, ''); auxg.edges.push(hvye); }
  hvye.info.weight = 10000;
  return { auxg, auxt, auxh, alg };
}

/** True if vn is a real (NORMAL) or labeled-virtual node — blocks adjacency. */
function blocksAdjacency(vn: Node | null): boolean {
  if (vn === null) return false;
  const t = vn.info.node_type ?? NORMAL;
  return t === NORMAL || (t === VIRTUAL && vn.info.label != null);
}

/** True if no adjacency-blocking node sits strictly between rank orders lo..hi. */
function noBlockerBetween(v: ReadonlyArray<Node | null>, lo: number, hi: number): boolean {
  for (let i = lo + 1; i < hi; i++) {
    if (blocksAdjacency(v[i] ?? null)) return false;
  }
  return true;
}

/** Reposition aux nodes into a frame aligned with the original graph. */
function repositionFlatAux(g: Graph, edges: Edge[], aux: FlatAux): void {
  const otn = edges[0].tail, ohn = edges[0].head;
  const flip = g.info.flip ?? false;
  const rightx = ohn.info.coord.x, leftx = otn.info.coord.x;
  const stn = flip ? ohn : otn;
  const shn = flip ? otn : ohn;
  const midx = (stn.info.coord.x - stn.info.rw + shn.info.coord.x + shn.info.lw) / 2;
  const midy = (aux.auxt.info.coord.x + aux.auxh.info.coord.x) / 2;
  for (const n of aux.auxg.nodes.values()) {
    if (n === aux.auxt) n.info.coord = { x: midy, y: rightx };
    else if (n === aux.auxh) n.info.coord = { x: midy, y: leftx };
    else n.info.coord = { x: n.info.coord.x, y: midx };
  }
}

/** transformf the aux edge's spline + arrowhead onto the original edge. */
function copyOneFlatSpline(
  orig: Edge, auxe: Edge, del: Point, flip: boolean, bb: Box | undefined,
): void {
  const auxbz = auxe.info.spl?.list[0];
  if (auxbz === undefined) return;
  const bz = newSpline(orig, auxbz.list.length);
  bz.sflag = auxbz.sflag;
  bz.eflag = auxbz.eflag;
  bz.sp = transformf(auxbz.sp, del, flip);
  bz.ep = transformf(auxbz.ep, del, flip);
  for (let j = 0; j < auxbz.list.length; j++) bz.list[j] = transformf(auxbz.list[j], del, flip);
  // Grow the graph bb by each transformed bezier segment. @see dotsplines.c:1270
  if (bb !== undefined) {
    for (let j = 0; j + 3 < bz.list.length; j += 3) {
      updateBbBz(bb, [bz.list[j], bz.list[j + 1], bz.list[j + 2], bz.list[j + 3]]);
    }
  }
  const rec = auxe.info as unknown as Record<string, unknown>;
  const arrow = rec._arrowPts as Point[] | undefined;
  if (arrow !== undefined) {
    (orig.info as unknown as Record<string, unknown>)._arrowPts =
      arrow.map(p => transformf(p, del, flip));
  }
}

/** Copy every routed aux spline back to its original edge. */
function copyFlatSplines(g: Graph, edges: Edge[], aux: FlatAux): void {
  const otn = edges[0].tail;
  const flip = g.info.flip ?? false;
  const stn = flip ? edges[0].head : otn;
  const at = aux.auxt.info.coord;
  const del = flip
    ? { x: stn.info.coord.x - at.y, y: stn.info.coord.y + at.x }
    : { x: stn.info.coord.x - at.x, y: stn.info.coord.y - at.y };
  for (let i = 0; i < edges.length; i++) {
    const orig = toNormalEdge(edges[i]);
    const auxe = aux.alg.get(orig);
    if (auxe !== undefined) copyOneFlatSpline(orig, auxe, del, flip, g.info.bb);
  }
}

/**
 * Route adjacent flat edges (with ports) via a rotated auxiliary layout, then
 * transform the resulting splines back onto the original edges. Installs splines
 * directly on the originals (returns 0 on success). Records and the no-port
 * makeSimpleFlat branch are out of scope (callers gate on a side port).
 * @see lib/dotgen/dotsplines.c:make_flat_adj_edges
 */
export function makeFlatAdjEdges(g: Graph, edges: Edge[], cnt: number, _et: number): number {
  const aux = buildFlatAux(g, edges, cnt);
  dotInitNodeEdge(aux.auxg);
  dotRank(aux.auxg);
  if (dotMincross(aux.auxg) !== 0) return 1;
  if (dotPosition(aux.auxg) !== 0) return 1;
  repositionFlatAux(g, edges, aux);
  dotSameports(aux.auxg);
  dotSplines_(aux.auxg, false);
  gvPostprocess(aux.auxg);
  copyFlatSplines(g, edges, aux);
  cleanupCloneGraph(aux.auxg);
  return 0;
}

/**
 * True when a same-rank edge's endpoints are adjacent in rank order (no NORMAL
 * or labeled-virtual node between them) — the make_flat_adj_edges case.
 * @see lib/dotgen/flat.c:checkFlatAdjacent
 */
export function isFlatAdjacent(g: Graph, e: Edge): boolean {
  const r = e.tail.info.rank;
  if (r === undefined || e.head.info.rank !== r) return false;
  const rank = g.info.rank?.[r];
  if (rank === undefined) return false;
  const to = e.tail.info.order ?? 0;
  const ho = e.head.info.order ?? 0;
  return noBlockerBetween(rank.v, Math.min(to, ho), Math.max(to, ho));
}

// ---------------------------------------------------------------------------
// make_flat_edge — dispatch flat edge routing
// @see lib/dotgen/dotsplines.c:make_flat_edge
// ---------------------------------------------------------------------------

/**
 * Route a group of flat (same-rank) edges.
 * @see lib/dotgen/dotsplines.c:make_flat_edge
 */
export function makeFlatEdge(
  g: Graph,
  _sp: SplineInfo,
  edges: Edge[],
  cnt: number,
  et: number,
): number {
  if (cnt === 0 || edges.length === 0) return 0;
  const isAdj = edges.some(e => (e.info.adjacent ?? 0) !== 0);
  if (isAdj) return makeFlatAdjEdges(g, edges, cnt, et);
  // Non-adjacent flat edges: full routing deferred
  return 0;
}

// ---------------------------------------------------------------------------
// routeFlatEdgeFaithful — faithful side-port routing for a single flat edge
// @see lib/dotgen/dotsplines.c:make_flat_edge (non-adjacent, non-labeled,
//      EDGETYPE_SPLINE: the top-routing branch + make_flat_bottom_edges),
//      makeFlatEnd / makeBottomFlatEnd
// ---------------------------------------------------------------------------

/**
 * makeFlatEnd (side=TOP) / makeBottomFlatEnd (side=BOTTOM): seed the endpoint
 * box from maximal_bbox, set the side mask, run begin/endpath (FLATEDGE feeds
 * BeginFlatSide/EndFlatSide), then append the makeregularend box up to (TOP) or
 * down from (BOTTOM) the node's rank extent.
 * @see lib/dotgen/dotsplines.c:makeFlatEnd, makeBottomFlatEnd
 */
function makeFlatEndBox(parts: FlatEndParts): PathendT {
  const { ctx, P, e, n, side, ranksep, isBegin } = parts;
  const endp = freshEndp(maximalBbox(ctx, n, undefined, e));
  endp.sidemask = side;
  const args = {
    P, e, et: FLATEDGE, endp, merge: false,
    inEdges: [], outEdges: [], ranksep, pboxfn: null,
  };
  if (isBegin) beginPath(args); else endPath(args);
  const ranks = ctx.g.info.rank!;
  const ht2 = ranks[n.info.rank!].ht2;
  const y = side === TOP ? n.info.coord.y + ht2 : n.info.coord.y - ht2;
  appendRegularEnd(endp.nb, endp, side, y);
  return endp;
}

/**
 * The three connecting boxes for the top-routing branch (loop over the top).
 * @see lib/dotgen/dotsplines.c:make_flat_edge (boxes[], i=0)
 */
function topBoxes(tlast: Box, hlast: Box, stepx: number, stepy: number): Box[] {
  const b0: Box = {
    ll: { x: tlast.ll.x, y: tlast.ur.y },
    ur: { x: tlast.ur.x + stepx, y: tlast.ur.y + stepy },
  };
  const b1: Box = {
    ll: { x: tlast.ll.x, y: b0.ur.y },
    ur: { x: hlast.ur.x, y: b0.ur.y + stepy },
  };
  const b2: Box = {
    ll: { x: hlast.ll.x - stepx, y: hlast.ur.y },
    ur: { x: hlast.ur.x, y: b0.ur.y },
  };
  return [b0, b1, b2];
}

/**
 * The three connecting boxes for the bottom-routing branch (loop under).
 * @see lib/dotgen/dotsplines.c:make_flat_bottom_edges (boxes[], i=0)
 */
function bottomBoxes(tlast: Box, hlast: Box, stepx: number, stepy: number): Box[] {
  const b0: Box = {
    ll: { x: tlast.ll.x, y: tlast.ll.y - stepy },
    ur: { x: tlast.ur.x + stepx, y: tlast.ll.y },
  };
  const b1: Box = {
    ll: { x: tlast.ll.x, y: b0.ll.y - stepy },
    ur: { x: hlast.ur.x, y: b0.ll.y },
  };
  const b2: Box = {
    ll: { x: hlast.ll.x - stepx, y: b0.ll.y },
    ur: { x: hlast.ur.x, y: hlast.ll.y },
  };
  return [b0, b1, b2];
}

/**
 * Vertical space available for the loop. Top routing reads the rank above;
 * bottom routing reads the rank below; either way a node at the graph
 * boundary falls back to ranksep.
 * @see lib/dotgen/dotsplines.c:make_flat_edge / make_flat_bottom_edges (vspace)
 */
function flatVspace(g: Graph, tn: Node, top: boolean): number {
  const ranks = g.info.rank!;
  const r = tn.info.rank!;
  if (top) {
    if (r <= 0) return graphRanksep(g);
    const prevIdx = (g.info.has_labels & EDGE_LABEL) !== 0 ? r - 2 : r - 1;
    const prev = ranks[prevIdx];
    return prev.v[0].info.coord.y - prev.ht1 - tn.info.coord.y - ranks[r].ht2;
  }
  if (r >= (g.info.maxrank ?? 0)) return graphRanksep(g);
  const next = ranks[r + 1];
  return tn.info.coord.y - ranks[r].pht1 - (next.v[0].info.coord.y + next.pht2);
}

/** A fresh empty path for begin/route/end assembly. */
function freshFlatPath(): Path {
  return { start: makePort(), end: makePort(), nbox: 0, boxes: [], data: null };
}

/** Per-caller spline_info bounds (C builds its own `sd` per orchestrator). */
function flatBboxCtx(g: Graph): BboxCtx {
  return {
    g,
    sp: {
      leftBound: computeLeftBound(g),
      rightBound: computeRightBound(g),
      splinesep: (g.info.nodesep ?? 18) / 2,
    },
  };
}

/**
 * Routing-side decision: bottom routing fires when a BOTTOM port faces away
 * from a non-TOP opposite end, exactly as C's
 * `(tside==BOTTOM && hside!=TOP) || (hside==BOTTOM && tside!=TOP)`.
 * @see lib/dotgen/dotsplines.c:make_flat_edge (tside/hside test)
 */
function flatSide(e: Edge): { bottom: boolean; side: number } {
  const tside = resolvePort(e.tail, e.head, e.info.tail_port).side ?? 0;
  const hside = resolvePort(e.head, e.tail, e.info.head_port).side ?? 0;
  const bottom = (tside === BOTTOM && hside !== TOP) || (hside === BOTTOM && tside !== TOP);
  return { bottom, side: bottom ? BOTTOM : TOP };
}

/** Concatenate tail boxes (fwd), the 3 connecting boxes, head boxes (rev). */
function assembleFlatPath(P: Path, tend: PathendT, hend: PathendT, mid: Box[]): void {
  for (let i = 0; i < tend.boxn; i++) addBox(P, tend.boxes[i]);
  for (const b of mid) addBox(P, b);
  for (let i = hend.boxn - 1; i >= 0; i--) addBox(P, hend.boxes[i]);
}

/**
 * Route a single same-rank (flat) edge carrying a side-mask port through the
 * faithful `beginPath → routeSplines → endPath → clipAndInstall` pipeline.
 * Returns spline control points in graphviz-internal (y-up) coordinates, or
 * null when the edge is not a same-rank edge. Does NOT clip or install — the
 * caller (routeOneEdge) does that via clipAndInstall, mirroring how SR3 wires
 * the regular faithful path.
 *
 * @see lib/dotgen/dotsplines.c:make_flat_edge (cnt=1, non-adjacent spline)
 */
export function routeFlatEdgeFaithful(g: Graph, e: Edge): Point[] | null {
  const tn = e.tail;
  const r = tn.info.rank;
  if (g.info.rank === undefined || r === undefined || e.head.info.rank !== r) return null;
  const { bottom, side } = flatSide(e);
  const ctx = flatBboxCtx(g);
  const ranksep = graphRanksep(g);
  const P = freshFlatPath();
  const tend = makeFlatEndBox({ ctx, P, e, n: tn, side, ranksep, isBegin: true });
  const hend = makeFlatEndBox({ ctx, P, e, n: e.head, side, ranksep, isBegin: false });
  const stepx = (g.info.nodesep ?? 18) / 2;
  const stepy = flatVspace(g, tn, !bottom) / 2;
  const tlast = tend.boxes[tend.boxn - 1];
  const hlast = hend.boxes[hend.boxn - 1];
  const mid = bottom
    ? bottomBoxes(tlast, hlast, stepx, stepy)
    : topBoxes(tlast, hlast, stepx, stepy);
  assembleFlatPath(P, tend, hend, mid);
  return routeSplines(P);
}
