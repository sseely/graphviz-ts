// SPDX-License-Identifier: EPL-2.0

/**
 * TypeScript port of lib/dotgen/dotinit.c — initialisation helpers for
 * the dot layout pipeline (dot_init_node, dot_init_edge, dot_init_subg,
 * dot_init_node_edge, removeFill, dot_cleanup).
 *
 * @see lib/dotgen/dotinit.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import { commonInitNode, lateInt, lateDouble, layoutMeasurer } from '../../common/nodeinit.js';
import { POINTS_PER_INCH } from '../../model/geom.js';
import { makeDrawing } from '../../model/layoutParams.js';
import type { RatioKind } from '../../model/layoutParams.js';
import { nonconstraintEdge } from './classify.js';
import { nodeAttr } from '../../common/poly-init.js';
import { NORMAL, deleteFastNode, removeFromRank } from './fastgr.js';
import { mapbool } from './rank.js';
import { initEdgeLabels } from '../../common/edge-label-init.js';
import type { TextMeasurer } from '../../common/textmeasure.js';
import { doGraphLabel } from './graph-label.js';
import { agsubg, agdelnode, agdelsubg } from '../../model/cgraph-ops.js';
import { nodesInSeq } from './decomp.js';

// ---------------------------------------------------------------------------
// RANKDIR constants
// @see lib/common/const.h RANKDIR_TB/LR/BT/RL
// ---------------------------------------------------------------------------

/** @see lib/common/const.h:RANKDIR_TB */
export const RANKDIR_TB = 0;
/** @see lib/common/const.h:RANKDIR_LR */
export const RANKDIR_LR = 1;
/** @see lib/common/const.h:RANKDIR_BT */
export const RANKDIR_BT = 2;
/** @see lib/common/const.h:RANKDIR_RL */
export const RANKDIR_RL = 3;

// ---------------------------------------------------------------------------
// nodesep / ranksep separation defaults — @see lib/common/const.h:85-88
// ---------------------------------------------------------------------------

const DEFAULT_NODESEP = 0.25;
const MIN_NODESEP = 0.02;
const DEFAULT_RANKSEP = 0.5;
const MIN_RANKSEP = 0.02;

/** Inches→points exactly as C's POINTS macro: ROUND(in * 72). @see geom.h:62 */
function points(inches: number): number {
  return Math.round(inches * POINTS_PER_INCH);
}

/**
 * Parse the `nodesep` and `ranksep` graph attributes into g.info, mirroring
 * graph_init. nodesep is a plain late_double; ranksep additionally honours the
 * `equally` keyword (sets exact_ranksep) and a bare number that may be followed
 * by text. Absent attrs yield POINTS(DEFAULT_*) = 18 / 36, matching the prior
 * dotInitSubg defaults (so non-setting graphs stay identical).
 * @see lib/common/input.c:665-681
 */
function parseSepAttrs(g: Graph): void {
  g.info.nodesep = points(lateDouble(g.attrs.get('nodesep'), DEFAULT_NODESEP, MIN_NODESEP));
  const p = g.attrs.get('ranksep');
  let xf = DEFAULT_RANKSEP;
  if (p !== undefined && p !== '') {
    // C: sscanf(p, "%lf", &xf) == 0 → no leading number → DEFAULT_RANKSEP.
    const parsed = Number.parseFloat(p);
    xf = Number.isNaN(parsed) ? DEFAULT_RANKSEP : Math.max(parsed, MIN_RANKSEP);
    if (p.includes('equally')) g.info.exact_ranksep = true;
  }
  g.info.ranksep = points(xf);
}

/** sscanf("%lf")-style float token. @see lib/common/input.c:476 getdoubles2ptf */
const SIZE_FLOAT = '[-+]?[0-9.]+(?:[eE][-+]?[0-9]+)?';
const SIZE_XY_RE = new RegExp(`^\\s*(${SIZE_FLOAT})\\s*,\\s*(${SIZE_FLOAT})(.?)`);
const SIZE_X_RE = new RegExp(`^\\s*(${SIZE_FLOAT})(.?)`);

/**
 * Local port of `getdoubles2ptf(g,"size",…)`: parse `"x,y"` (or a lone `"x"`
 * meaning square) → points, with a trailing `!` as the *filled* flag. Returns
 * null when absent or non-positive. Re-derived here rather than imported from
 * `gvc/viewport` to avoid a layout→render dependency edge (ADR-2 deviation, same
 * result). @see lib/common/input.c:476 getdoubles2ptf
 */
function parseSizePoints(raw: string | undefined): { x: number; y: number; filled: boolean } | null {
  if (raw === undefined) return null;
  const xy = SIZE_XY_RE.exec(raw);
  if (xy) {
    const xf = Number(xy[1]);
    const yf = Number(xy[2]);
    if (xf > 0 && yf > 0) return { x: points(xf), y: points(yf), filled: xy[3] === '!' };
  }
  const x = SIZE_X_RE.exec(raw);
  if (x) {
    const xf = Number(x[1]);
    if (xf > 0) return { x: points(xf), y: points(xf), filled: x[2] === '!' };
  }
  return null;
}

/**
 * Port of `setRatio` (input.c:576): map the `ratio` attr to a RatioKind. A
 * positive numeric value is R_VALUE; anything else absent/unrecognized → none.
 * @see lib/common/input.c:576 setRatio
 */
function parseRatioKind(g: Graph): RatioKind | undefined {
  const p = g.attrs.get('ratio');
  if (p === undefined) return undefined;
  if (p === 'auto') return 'auto';
  if (p === 'compress') return 'compress';
  if (p === 'expand') return 'expand';
  if (p === 'fill') return 'fill';
  return Number.parseFloat(p) > 0 ? 'value' : undefined;
}

/**
 * Populate `g.info.drawing` for the ratio kinds whose layout reshape is ported
 * AND corpus-validated: `compress` (compressGraph x-NS, position-cluster.ts) and
 * `fill` (setAspect R_FILL, position-bbox.ts — scales node coords by
 * size/bbox per axis). `expand`/`value` have the math in setAspect but no corpus
 * coverage, and `auto` needs `idealsize` (unported); all three stay deferred —
 * leaving `drawing` unset keeps setAspect/compressGraph a no-op for them.
 * @see lib/dotgen/position.c:set_aspect (904), compress_graph (501);
 *      lib/common/input.c:576 setRatio, 694 size
 */
function parseRatioDrawing(g: Graph): void {
  const kind = parseRatioKind(g);
  if (kind !== 'compress' && kind !== 'fill') return;
  const sz = parseSizePoints(g.attrs.get('size'));
  g.info.drawing = makeDrawing({
    ratioKind: kind,
    size: sz ? { x: sz.x, y: sz.y } : { x: 0, y: 0 },
    filled: sz?.filled ?? false,
  });
}

// ---------------------------------------------------------------------------
// dotGraphInit — parse rankdir and propagate to subgraphs (graph_init semantics)
// @see lib/common/input.c:600-663 graph_init
// @see lib/dotgen/dotinit.c:352 initSubg (GD_rankdir2 propagation)
// ---------------------------------------------------------------------------

/**
 * Parse the `rankdir` graph attribute and store the encoded value on g.info.rankdir.
 * Mirrors C's graph_init SET_RANKDIR with use_rankdir=true for the dot engine:
 *   SET_RANKDIR(g, (rankdir << 2) | rankdir)
 * Also sets g.info.flip = (rankdir & 1) == 1 (true for LR and RL).
 *
 * @see lib/common/input.c:600-663 graph_init
 * @see lib/common/types.h:GD_rankdir2
 */
export function dotGraphInit(g: Graph): void {
  // EdgeLabelsDone reset at layout start (AD2 per-layout semantics)
  // @see lib/common/input.c:711
  g.info.edgeLabelsDone = false;
  let rankdir = RANKDIR_TB;
  const p = g.attrs.get('rankdir');
  if (p === 'LR') rankdir = RANKDIR_LR;
  else if (p === 'BT') rankdir = RANKDIR_BT;
  else if (p === 'RL') rankdir = RANKDIR_RL;
  // SET_RANKDIR: effective rankdir in bits 0-1, real rankdir in bits 2-3
  g.info.rankdir = (rankdir << 2) | rankdir;
  // GD_flip: bit 0 of effective rankdir
  g.info.flip = (rankdir & 1) === 1;
  // Propagate to subgraphs (dotinit.c:352: GD_rankdir2(sg) = GD_rankdir2(g))
  initSubgraphRankdir(g);
  // nodesep / ranksep (input.c:665-681) — parsed here so the values are set
  // before dotInitSubg's defaults and before ranking uses GD_ranksep.
  parseSepAttrs(g);
  // ratio + size → g.info.drawing (input.c:693-694: setRatio then size). Scoped
  // to ratio=compress (compressGraph) + ratio=fill (setAspect R_FILL).
  // @see input.c:576,694
  parseRatioDrawing(g);
  // concentrate (input.c:708-709): Concentrate = mapbool(agget(g,"concentrate")).
  // Gates both the class2 merge path (classify.ts) and dot_concentrate
  // (position.ts). @see lib/common/input.c:708, lib/common/globals.h:Concentrate
  g.info.concentrate = mapbool(g.attrs.get('concentrate'));
  // Root graph label: dimensions measured here so bb expansion in gvPostprocess
  // has the dimen available. Cluster labels are handled by buildSkeleton/rank.ts.
  // HTML labels not yet supported — plain-text only.
  // @see lib/common/input.c:719 (do_graph_label call at end of graph_init)
  doGraphLabel(g, layoutMeasurer(g));
}

/**
 * Recursively propagate the root graph's rankdir2 to all subgraphs.
 * @see lib/dotgen/dotinit.c:352
 */
function initSubgraphRankdir(g: Graph): void {
  const nc = g.info.n_cluster ?? 0;
  const clust = g.info.clust;
  for (let c = 1; c <= nc; c++) {
    if (clust && clust[c - 1]) {
      const sg = clust[c - 1];
      sg.info.rankdir = g.info.rankdir;
      sg.info.flip = g.info.flip;
      initSubgraphRankdir(sg);
    }
  }
}

// ---------------------------------------------------------------------------
// CL_CROSS — cost of cluster skeleton edge crossing
// @see lib/common/const.h:CL_CROSS
// ---------------------------------------------------------------------------

/**
 * Crossing penalty for cluster-skeleton / same-group edges.
 * C uses 1000 except under _WIN32, where 100 avoids a 16-bit overflow.
 * The oracle platform (and every modern build) takes the 1000 branch;
 * mincross best-order selection on penalty plateaus depends on it.
 * @see lib/common/const.h:CL_CROSS
 */
export const CL_CROSS = 1000;

// ---------------------------------------------------------------------------
// dotInitNode
// ---------------------------------------------------------------------------

/**
 * Initialises per-node layout data for the dot engine.
 * Mirrors dot_init_node: binds Agnodeinfo_t and allocates edge lists.
 *
 * @see lib/dotgen/dotinit.c:dot_init_node
 */
export function dotInitNode(n: Node): void {
  n.info.UF_size = 1;
  if (!n.info.in)       n.info.in       = { list: [], size: 0 };
  if (!n.info.out)      n.info.out      = { list: [], size: 0 };
  if (!n.info.flat_in)  n.info.flat_in  = { list: [], size: 0 };
  if (!n.info.flat_out) n.info.flat_out = { list: [], size: 0 };
  if (!n.info.other)    n.info.other    = { list: [], size: 0 };
  // Default lw = rw = 0.75in/2 × 72 = 27 pts; ht = 0.5in × 72 = 36 pts
  if (!n.info.lw) n.info.lw = 27;
  if (!n.info.rw) n.info.rw = 27;
  if (!n.info.ht) n.info.ht = 36;
  // Mark as a real (NORMAL) node so firstNormalNode() can find it.
  n.info.node_type = NORMAL;
}

// ---------------------------------------------------------------------------
// dotInitEdge
// ---------------------------------------------------------------------------

/**
 * True when tail and head carry the same non-empty `group` attribute.
 * C compares interned refstr pointers (`tailgroup == headgroup`); cgraph's
 * per-graph string pool makes that exactly content equality, and the
 * `tailgroup[0]` guard excludes the shared "" default.
 * @see lib/dotgen/dotinit.c:dot_init_edge (tailgroup/headgroup check)
 */
export function sameNonemptyGroup(e: Edge): boolean {
  const tailgroup = nodeAttr(e.tail, e.tail.root, 'group') ?? '';
  const headgroup = nodeAttr(e.head, e.head.root, 'group') ?? '';
  return tailgroup !== '' && tailgroup === headgroup;
}

/**
 * Reads the `constraint` edge attr and stores the parsed boolean on e.info.
 * Absent or empty attr leaves e.info.constraint unchanged (C: constr[0] guard).
 * @see lib/dotgen/rank.c:is_nonconstraint
 * @see lib/common/utils.c:mapbool
 */
function initEdgeConstraint(e: Edge): void {
  const s = e.attrs.get('constraint');
  if (s !== undefined && s !== '') e.info.constraint = mapbool(s);
}

/**
 * Applies the same-group penalty to xpenalty and weight.
 * @see lib/dotgen/dotinit.c:dot_init_edge (tailgroup/headgroup block)
 */
function applyGroupPenalty(e: Edge): void {
  if (!sameNonemptyGroup(e)) return;
  e.info.xpenalty = CL_CROSS;
  e.info.weight = (e.info.weight ?? 1) * 100;
}

/**
 * Zeroes xpenalty and weight when the edge is a non-constraint edge.
 * @see lib/dotgen/dotinit.c:dot_init_edge:73-76
 */
function applyNonconstraintZero(e: Edge): void {
  if (!nonconstraintEdge(e)) return;
  e.info.xpenalty = 0;
  e.info.weight = 0;
}

/**
 * Initialises per-edge layout data for the dot engine.
 * Mirrors dot_init_edge: sets weight, count, xpenalty, minlen.
 *
 * @see lib/dotgen/dotinit.c:dot_init_edge
 */
export function dotInitEdge(e: Edge): void {
  initEdgeConstraint(e);
  // C: ED_weight(e) = late_int(e, E_weight, 1, 0) — honor an explicit weight
  // attr (default 1, min 0). dotInitEdge is re-run on edges the flat-label
  // machinery has stamped with a synthetic weight (e.g. 10000); preserve that
  // when there is no attr, rather than resetting to the default. The group/
  // nonconstraint adjustments below then apply on top, matching C's order.
  // @see lib/dotgen/dotinit.c:65
  e.info.weight = e.attrs.has('weight')
    ? lateInt(e.attrs.get('weight'), 1, 0)
    : (e.info.weight ?? 1);
  e.info.count = 1;
  e.info.xpenalty = 1;
  applyGroupPenalty(e);
  applyNonconstraintZero(e);
  // late_int semantics: default 1, minimum 0.
  // @see lib/dotgen/dotinit.c:85  ED_minlen(e) = late_int(e, E_minlen, 1, 0)
  e.info.minlen = lateInt(e.attrs.get('minlen'), 1, 0);
  // samehead / sametail group ids for shared-port merging. C reads these via
  // agxget(e, E_samehead/E_sametail) in dot_sameports and treats an empty
  // string (id[0] == '\0') as "no group". Without populating these, the ported
  // dotSameports (wired in index.ts) never fires and same-* edges route to the
  // node center instead of a merged port. @see lib/dotgen/sameport.c:dot_sameports
  const sh = e.attrs.get('samehead');
  e.info.samehead = sh ? sh : undefined;
  const st = e.attrs.get('sametail');
  e.info.sametail = st ? st : undefined;
}

// ---------------------------------------------------------------------------
// dotInitSubg
// ---------------------------------------------------------------------------

/**
 * Recursively initialises subgraph-level attributes with defaults.
 * Mirrors dot_init_subg: binds Agraphinfo_t and propagates params.
 *
 * nodesep defaults: 0.25 in × 72 = 18 pts; ranksep: 0.5 in × 72 = 36 pts.
 *
 * @see lib/dotgen/dotinit.c:dot_init_subg
 */
export function dotInitSubg(g: Graph): void {
  if (g.info.nodesep === undefined) g.info.nodesep = 18;
  if (g.info.ranksep === undefined) g.info.ranksep = 36;
  const nc = g.info.n_cluster ?? 0;
  const clust = g.info.clust;
  for (let c = 1; c <= nc; c++) {
    if (clust && clust[c - 1]) dotInitSubg(clust[c - 1]);
  }
}

// ---------------------------------------------------------------------------
// dotInitNodeEdge
// ---------------------------------------------------------------------------

/**
 * Calls commonInitNode (shape-aware, label-driven sizing) then
 * dotInitNode for every node, then dotInitEdge for every edge.
 *
 * @see lib/dotgen/dotinit.c:dot_init_node_edge
 * @see lib/dotgen/dotinit.c:dot_init_node (common_init_node + gv_nodesize)
 */
export function dotInitNodeEdge(g: Graph): void {
  for (const n of nodesInSeq(g)) {
    commonInitNode(n, g);
    dotInitNode(n);
  }
  const measurer = (g.root.info.gvc as { textMeasurer?: TextMeasurer } | undefined)?.textMeasurer;
  for (const e of g.edges) {
    dotInitEdge(e);
    if (measurer) initEdgeLabels(e, g, measurer);
  }
}

// ---------------------------------------------------------------------------
// removeFill
// ---------------------------------------------------------------------------

/**
 * Deletes the placeholder fill-nodes inserted by fillRanks (NEW_RANK mode)
 * once positioning is done, so they never render. Looks up the `_new_rank`
 * subgraph under the root graph; if absent (the common no-newrank case) this
 * is a no-op. Operates on `g.root` throughout because fillRanks created the
 * fill nodes and their ranks under the root.
 *
 * @see lib/dotgen/dotinit.c:removeFill
 */
export function removeFill(g: Graph): void {
  const sg = agsubg(g.root, '_new_rank', false);
  if (sg === null) return;
  // Snapshot first: agdelnode mutates membership (including sg) during the
  // loop. C's nxt = agnxtnode look-ahead tolerates deleting the current node;
  // the snapshot is its faithful equivalent.
  const fillNodes = nodesInSeq(sg);
  for (const n of fillNodes) {
    deleteFastNode(g.root, n);
    removeFromRank(g.root, n);
    // dot_cleanup_node has no equivalent in this port (GC reclaims the node).
    agdelnode(g.root, n);
  }
  agdelsubg(g.root, sg);
}

// ---------------------------------------------------------------------------
// dotCleanup
// ---------------------------------------------------------------------------

/**
 * Clears all edge lists and linked-list pointers from nodes in the fast-graph,
 * releasing layout state without destroying the underlying graph structure.
 *
 * Mirrors dot_cleanup: frees virtual node list then per-node edge lists.
 *
 * @see lib/dotgen/dotinit.c:dot_cleanup
 */
export function dotCleanup(g: Graph): void {
  let n: Node | undefined = g.info.nlist;
  while (n !== undefined) {
    const next: Node | undefined = n.info.next;
    n.info.in       = undefined;
    n.info.out      = undefined;
    n.info.flat_in  = undefined;
    n.info.flat_out = undefined;
    n.info.other    = undefined;
    n.info.next     = undefined;
    n.info.prev     = undefined;
    n = next;
  }
  g.info.nlist = undefined;
}
