// SPDX-License-Identifier: EPL-2.0

/**
 * Faithful cnt>=2 non-adjacent flat multi-edge routing.
 *
 * C make_flat_edge (top branch, dotsplines.c:1502) and make_flat_bottom_edges
 * (bottom branch, 1418) group every non-labeled, identical-port, non-adjacent
 * flat edge between a same-rank node pair into ONE call and NEST their splines:
 * `stepx = Multisep/(cnt+1)`, `stepy = vspace/(cnt+1)`; ONE shared makeFlatEnd
 * tail+head; then edge `i` is offset by `(i+1)*step` on the two END boxes while
 * the MIDDLE box keeps plain `stepy`. cnt=1 reduces to routeFlatEdgeFaithful
 * (`Multisep/2 = nodesep/2`, `(0+1)*step = step`) — byte-identical (AD-1).
 *
 * The port routes each non-adjacent flat independently at `nodesep/2`, so cnt>=2
 * edges come out identical/overlapping; this module restores the nesting.
 *
 * @see lib/dotgen/dotsplines.c:make_flat_edge, make_flat_bottom_edges, dot_splines_
 */

import type { Graph } from '../../model/graph.js';
import type { Edge } from '../../model/edge.js';
import type { Node } from '../../model/node.js';
import type { Port, Box } from '../../model/geom.js';
import type { Path, PathendT } from '../../common/types.js';
import { routeSplines } from '../../common/splines-routespl.js';
import { clipAndInstall } from '../../common/splines-clip.js';
import { graphRanksep } from './position-aux.js';
import { buildDotSinfo } from './self-loop.js';
import {
  isFlatAdjacent, makeFlatEndBox, topBoxes, bottomBoxes, flatSide, flatVspace,
  freshFlatPath, assembleFlatPath, flatBboxCtx,
} from './splines-flat.js';

/** Loop-invariant routing context shared across the cnt-loop iterations.
 * Declared here (not between functions) so lizard's length accounting does not
 * fold it into a neighbour. @see lizard-length-inter-comment */
interface GroupRouteCtx {
  P: Path;
  tend: PathendT;
  hend: PathendT;
  tlast: Box;
  hlast: Box;
  bottom: boolean;
  stepx: number;
  stepy: number;
  /** Geometric left end node of the channel (lower order). routeSplines yields
   * points left→right; an edge whose tail is the RIGHT node is reversed so the
   * installed spline runs tail→head, matching C's clip_and_install orientation. */
  leftNode: Node;
}


/**
 * portcmp == 0: both undefined, or both defined with an equal aiming point.
 * @see lib/dotgen/dotsplines.c:portcmp
 */
function portEq(a: Port, b: Port): boolean {
  if (!a.defined && !b.defined) return true;
  if (!a.defined || !b.defined) return false;
  return a.p.x === b.p.x && a.p.y === b.p.y;
}

/** The declared ports of e oriented relative to the left node `lo`. */
function flatPortKey(e: Edge, lo: Node): { loP: Port; hiP: Port } {
  return e.tail === lo
    ? { loP: e.info.tail_port, hiP: e.info.head_port }
    : { loP: e.info.head_port, hiP: e.info.tail_port };
}

/** True when x is an unrouted non-adjacent same-rank flat edge (C make_flat_edge
 * routes EVERY non-adjacent flat; side ports are not a precondition). */
function isNonAdjGroupable(x: Edge, g: Graph): boolean {
  return x.info.spl === undefined
    && x.tail.info.rank !== undefined
    && x.tail.info.rank === x.head.info.rank
    && !isFlatAdjacent(g, x);
}

/** True when x's ports (oriented to lo) equal the lead key (C portcmp == 0). */
function samePortsAs(x: Edge, lo: Node, key: { loP: Port; hiP: Port }): boolean {
  const k = flatPortKey(x, lo);
  return portEq(k.loP, key.loP) && portEq(k.hiP, key.hiP);
}

/**
 * Collect all unrouted non-adjacent same-rank side-port flat edges between e's
 * endpoints that share e's tail/head ports (C portcmp), ordered so group[0].tail
 * is the lower-order (left) node, ties by seq (AD-3). Mirrors edge-route.ts:
 * collectAdjacentFlatGroup with the non-adjacent + identical-port group key.
 * @see lib/dotgen/dotsplines.c:dot_splines_ (portcmp 370-373), make_flat_edge
 */
export function collectNonAdjacentFlatGroup(e: Edge, g: Graph): Edge[] {
  const u = e.tail, v = e.head;
  const lo = (u.info.order ?? 0) <= (v.info.order ?? 0) ? u : v;
  const key = flatPortKey(e, lo);
  const sharesPair = (x: Edge): boolean =>
    (x.tail === u && x.head === v) || (x.tail === v && x.head === u);
  // C's edgecmp keeps a flat group contiguous only while labels are equal
  // (ED_label(e0)!=ED_label(e1) breaks the run); a labeled opposing leg must not
  // be pulled into an unlabeled rep's group. @see lib/dotgen/dotsplines.c:edgecmp
  const group = g.edges.filter(
    x => sharesPair(x) && isNonAdjGroupable(x, g) && samePortsAs(x, lo, key)
      && x.info.label === e.info.label);
  group.sort((a, b) => Number(b.tail === lo) - Number(a.tail === lo) || a.seq - b.seq);
  return group;
}

/**
 * Deep-copy a pathend's boxes so routeSplines (which mutates boxes in place)
 * cannot corrupt the shared tend/hend reused across the cnt-loop. C copies each
 * box by value via add_box; the port stores references, so the loop must copy.
 * @see lib/common/routespl.c:routesplines (mutates boxes), add_box (value copy)
 */
function copyPathEnd(end: PathendT): PathendT {
  return {
    ...end,
    boxes: end.boxes.map(b => ({ ll: { ...b.ll }, ur: { ...b.ur } })),
  };
}

/**
 * Build edge i's three connecting boxes (END boxes offset (i+1)*step, MIDDLE
 * plain stepy), assemble the path, route, and clip+install on e. Resets P.nbox
 * first (C: `P->nbox = 0` per iteration). Returns false on an empty route.
 * @see lib/dotgen/dotsplines.c:make_flat_edge / make_flat_bottom_edges (loop body)
 */
function routeGroupEdge(e: Edge, i: number, c: GroupRouteCtx): boolean {
  c.P.nbox = 0;
  const endStepX = (i + 1) * c.stepx;
  const endStepY = (i + 1) * c.stepy;
  const mid = c.bottom
    ? bottomBoxes(c.tlast, c.hlast, endStepX, endStepY, c.stepy)
    : topBoxes(c.tlast, c.hlast, endStepX, endStepY, c.stepy);
  assembleFlatPath(c.P, copyPathEnd(c.tend), copyPathEnd(c.hend), mid);
  const pts = routeSplines(c.P);
  if (pts === null || pts.length === 0) return false;
  // routeSplines returns points left→right (tend = leftNode). Reverse for an edge
  // whose tail is the right node so the points run tail→head; pass ignoreSwap so
  // clipAndInstall clips/arrows by the real tail/head instead of re-deriving the
  // orientation from node order (which would undo the reversal).
  // @see lib/dotgen/dotsplines.c:make_flat_edge (clip_and_install)
  if (e.tail !== c.leftNode) pts.reverse();
  clipAndInstall(e, e.head, pts, pts.length, { ...buildDotSinfo(), ignoreSwap: true });
  return true;
}

/**
 * Faithful make_flat_edge / make_flat_bottom_edges cnt-loop: ONE shared
 * makeFlatEnd tail+head; for i in 0..cnt-1 route edge i nested by (i+1)*step.
 * Installs spl on every edges[i]; returns true iff all installed. cnt=1 reduces
 * to routeFlatEdgeFaithful (AD-1). `edges` must be group-ordered (collect...).
 * @see lib/dotgen/dotsplines.c:make_flat_edge, make_flat_bottom_edges
 */
export function routeFlatEdgeGroupFaithful(g: Graph, edges: Edge[], cnt: number): boolean {
  const lead = edges[0];
  if (g.info.rank === undefined || lead.tail.info.rank === undefined
    || lead.head.info.rank !== lead.tail.info.rank) return false;
  // C makefwdedge: build the channel left→right by node order, else the middle
  // box inverts for a right-to-left (tail right of head) flat edge.
  const tailIsLeft = (lead.tail.info.order ?? 0) <= (lead.head.info.order ?? 0);
  const leftNode = tailIsLeft ? lead.tail : lead.head;
  const rightNode = tailIsLeft ? lead.head : lead.tail;
  // C makefwdedge: the box-building sample edge must run left→right so beginpath
  // anchors the path START at the LEFT node (not the original tail). For a
  // right-to-left flat edge, swap tail/head + ports for the sample only; the
  // per-edge clip/install still uses the original edge.
  // @see lib/dotgen/dotsplines.c:make_flat_edge (makefwdedge), makefwdedge
  const sample: Edge = tailIsLeft ? lead : {
    ...lead, tail: leftNode, head: rightNode,
    info: { ...lead.info, tail_port: lead.info.head_port, head_port: lead.info.tail_port },
  } as Edge;
  const { bottom, side } = flatSide(sample);
  const ctx = flatBboxCtx(g);
  const ranksep = graphRanksep(g);
  const P = freshFlatPath();
  const tend = makeFlatEndBox({ ctx, P, e: sample, n: leftNode, side, ranksep, isBegin: true });
  const hend = makeFlatEndBox({ ctx, P, e: sample, n: rightNode, side, ranksep, isBegin: false });
  const stepx = (g.info.nodesep ?? 18) / (cnt + 1);
  const stepy = flatVspace(g, leftNode, !bottom) / (cnt + 1);
  const rc: GroupRouteCtx = {
    P, tend, hend, tlast: tend.boxes[tend.boxn - 1], hlast: hend.boxes[hend.boxn - 1],
    bottom, stepx, stepy, leftNode,
  };
  for (let i = 0; i < cnt; i++) {
    if (!routeGroupEdge(edges[i], i, rc)) return false;
  }
  return true;
}
