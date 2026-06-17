// SPDX-License-Identifier: EPL-2.0

/**
 * Label placement for edge virtual nodes and port labels.
 *
 * @see lib/dotgen/dotsplines.c:place_vnlabel, setEdgeLabelPos
 * @see lib/common/splines.c:place_portlabel (lines 1316-1360)
 * @see lib/dotgen/dotsplines.c:440-458 (port-label placement loop)
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { TextlabelT } from '../../common/types.js';
import { VIRTUAL } from './fastgr.js';
import { HEAD_LABEL, TAIL_LABEL, IGNORED } from './rank.js';
import { lateDouble } from '../../common/nodeinit.js';

// ---------------------------------------------------------------------------
// TextLabel interface (minimal — full type deferred to Batch 5b)
// ---------------------------------------------------------------------------

/** Minimal label shape sufficient for placement. */
export interface TextLabel {
  pos: { x: number; y: number };
  dimen: { x: number; y: number };
  set: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cast an unknown label to TextLabel if it has the required shape. */
export function asTextLabel(label: unknown): TextLabel | undefined {
  const l = label as Record<string, unknown>;
  if (l && typeof l['pos'] === 'object' && typeof l['dimen'] === 'object') {
    return l as unknown as TextLabel;
  }
  return undefined;
}

/** Walk to_orig until edge_type is NORMAL (0). */
export function findNormalOutEdge(first: Edge): Edge | undefined {
  let e: Edge | undefined = first;
  while (e && (e.info.edge_type ?? 0) !== 0) e = e.info.to_orig;
  return e;
}

/** Compute label x-position from node coord, dimen, and flip flag. */
export function labelXPos(n: Node, l: TextLabel): number {
  const flip = !!(n.root?.info.flip);
  const width = flip ? l.dimen.y : l.dimen.x;
  return n.info.coord.x + width / 2.0;
}

// ---------------------------------------------------------------------------
// place_vnlabel
// @see lib/dotgen/dotsplines.c:place_vnlabel
// ---------------------------------------------------------------------------

/**
 * Assign position of an edge label from its virtual node.
 * @see lib/dotgen/dotsplines.c:place_vnlabel
 */
export function placeVnlabel(n: Node): void {
  if ((n.info.in?.size ?? 0) === 0) return; // skip flat edge labels
  const first = n.info.out?.list[0];
  if (!first) return;
  const e = findNormalOutEdge(first);
  if (!e) return;
  const l = asTextLabel(e.info.label);
  if (!l) return;
  l.pos.x = labelXPos(n, l);
  l.pos.y = n.info.coord.y;
  l.set = true;
}

// ---------------------------------------------------------------------------
// setEdgeLabelPos
// @see lib/dotgen/dotsplines.c:setEdgeLabelPos
// ---------------------------------------------------------------------------

/** Set label pos from posAlg edge for virtual label nodes. */
export function setAlgLabelPos(n: Node): void {
  const fe = n.info.posAlg;
  if (!fe) return;
  const l = asTextLabel(fe.info.label);
  if (!l) return;
  l.pos = { x: n.info.coord.x, y: n.info.coord.y };
  l.set = true;
}

/**
 * Set edge label position information for regular and non-adjacent flat edges.
 * @see lib/dotgen/dotsplines.c:setEdgeLabelPos
 */
export function setEdgeLabelPos(g: Graph): void {
  for (let n: Node | undefined = g.info.nlist; n; n = n.info.next) {
    if ((n.info.node_type ?? 0) !== VIRTUAL) continue;
    if (n.info.posAlg) setAlgLabelPos(n);
    else if (n.info.label) placeVnlabel(n);
  }
}

// ---------------------------------------------------------------------------
// Port-label constants
// @see lib/common/const.h:PORT_LABEL_DISTANCE / PORT_LABEL_ANGLE
// ---------------------------------------------------------------------------

/** Default port-label distance in points. @see lib/common/const.h:PORT_LABEL_DISTANCE */
export const PORT_LABEL_DISTANCE = 10;

/** Default port-label angle in degrees (CW negative). @see lib/common/const.h:PORT_LABEL_ANGLE */
export const PORT_LABEL_ANGLE = -25;

// ---------------------------------------------------------------------------
// cubicBezierAt — de Casteljau at parameter t (Bezier() in utils.c)
// @see lib/common/utils.c:175-203
// ---------------------------------------------------------------------------

/**
 * Evaluate a cubic Bezier curve at parameter t using the de Casteljau
 * triangle computation.  Requires pts[0..3].  No Left/Right subdivision
 * output needed here, so they are omitted.
 *
 * @see lib/common/utils.c:Bezier
 */
function cubicBezierAt(pts: readonly { x: number; y: number }[], t: number): { x: number; y: number } {
  // Triangle computation (degree = 3)
  const p0 = pts[0], p1 = pts[1], p2 = pts[2], p3 = pts[3];
  const mt = 1.0 - t;
  // Level 1
  const q0 = { x: mt * p0.x + t * p1.x, y: mt * p0.y + t * p1.y };
  const q1 = { x: mt * p1.x + t * p2.x, y: mt * p1.y + t * p2.y };
  const q2 = { x: mt * p2.x + t * p3.x, y: mt * p2.y + t * p3.y };
  // Level 2
  const r0 = { x: mt * q0.x + t * q1.x, y: mt * q0.y + t * q1.y };
  const r1 = { x: mt * q1.x + t * q2.x, y: mt * q1.y + t * q2.y };
  // Level 3
  return { x: mt * r0.x + t * r1.x, y: mt * r0.y + t * r1.y };
}

// ---------------------------------------------------------------------------
// Bezier endpoint extraction helpers
// @see lib/common/splines.c:place_portlabel:1331-1351
// ---------------------------------------------------------------------------

type BezierSeg = { list: { x: number; y: number }[]; sflag: number; eflag: number; sp: { x: number; y: number }; ep: { x: number; y: number } };

/**
 * Extract (pe = endpoint, pf = near-endpoint) for the tail end of the spline.
 * pe is the exact endpoint; pf is a point 10% along the curve toward the head,
 * used to compute the tangent direction for label placement.
 *
 * @see lib/common/splines.c:place_portlabel:1331-1339
 */
function tailEndpoints(bez: BezierSeg): { pe: { x: number; y: number }; pf: { x: number; y: number } } {
  if (bez.sflag) {
    return { pe: bez.sp, pf: bez.list[0] };
  }
  const pe = bez.list[0];
  const pf = cubicBezierAt(bez.list, 0.1);
  return { pe, pf };
}

/**
 * Extract (pe = endpoint, pf = near-endpoint) for the head end of the spline.
 * pe is the exact endpoint; pf is a point 90% along the curve from the tail,
 * used to compute the tangent direction for label placement.
 *
 * @see lib/common/splines.c:place_portlabel:1341-1351
 */
function headEndpoints(bez: BezierSeg): { pe: { x: number; y: number }; pf: { x: number; y: number } } {
  if (bez.eflag) {
    return { pe: bez.ep, pf: bez.list[bez.list.length - 1] };
  }
  const pe = bez.list[bez.list.length - 1];
  const last4 = bez.list.slice(bez.list.length - 4);
  const pf = cubicBezierAt(last4, 0.9);
  return { pe, pf };
}

// ---------------------------------------------------------------------------
// place_portlabel
// @see lib/common/splines.c:1316-1360
// ---------------------------------------------------------------------------

/**
 * Place the head or tail port label for edge e.
 *
 * Returns true on success, false when:
 *   - edge_type is IGNORED, or
 *   - neither labelangle nor labeldistance attrs are set (labels are then
 *     treated as external xlabel-style labels, not placed here), or
 *   - the spline is not yet computed.
 *
 * NOTE: The C code only places port labels when at least one of
 * E_labelangle / E_labeldistance has a non-empty value. When both are
 * absent (the common case), it returns 0 and the labels remain unpositioned.
 * In the C pipeline the renderer then falls back to xlabel-style placement.
 * For the quarantine reference, the labels *are* placed — meaning one of
 * the two attrs has an implicit value in the C attr-symbol table.  We
 * replicate the C condition faithfully: check whether the edge's own
 * attrs contain a non-empty value for either key.
 *
 * @see lib/common/splines.c:place_portlabel
 */
export function placePortlabel(e: Edge, headP: boolean): boolean {
  if (edgeTypeIgnored(e)) return false;
  if (noAngleAttrs(e)) return false;
  if (labelMissing(e, headP)) return false;
  if (splineMissing(e)) return false;
  return applyPortlabelPos(e, headP);
}

/** True when edge_type is IGNORED (0 when unset counts as not-IGNORED). */
function edgeTypeIgnored(e: Edge): boolean {
  const et = e.info.edge_type;
  if (et === undefined) return false;
  return et === IGNORED;
}

/** True when neither labelangle nor labeldistance has a non-empty value. */
function noAngleAttrs(e: Edge): boolean {
  const a = e.attrs.get('labelangle');
  const d = e.attrs.get('labeldistance');
  if (a !== undefined && a !== '') return false;
  if (d !== undefined && d !== '') return false;
  return true;
}

/** True when the relevant port label is absent. */
function labelMissing(e: Edge, headP: boolean): boolean {
  if (headP) return e.info.head_label === undefined;
  return e.info.tail_label === undefined;
}

/** True when no computed spline exists yet. */
function splineMissing(e: Edge): boolean {
  if (e.info.spl === undefined) return true;
  return e.info.spl.list.length === 0;
}

/**
 * Compute and write position for one port label; returns true.
 * Pre-condition: guards passed (label exists, spline exists).
 * @see lib/common/splines.c:place_portlabel:1353-1359
 */
function applyPortlabelPos(e: Edge, headP: boolean): boolean {
  const spl  = e.info.spl!;
  const ends = headP
    ? headEndpoints(spl.list[spl.list.length - 1])
    : tailEndpoints(spl.list[0]);
  const l           = headP ? e.info.head_label! : e.info.tail_label!;
  const angleStr    = e.attrs.get('labelangle')    ?? '';
  const distanceStr = e.attrs.get('labeldistance') ?? '';
  writePortlabelPos(l, ends.pe, ends.pf, angleStr, distanceStr);
  return true;
}

/**
 * Write pos onto label given endpoint pair and attr strings.
 * @see lib/common/splines.c:place_portlabel:1353-1359
 */
function writePortlabelPos(
  l: TextlabelT,
  pe: { x: number; y: number },
  pf: { x: number; y: number },
  angleStr: string,
  distanceStr: string,
): void {
  const angleDeg = lateDouble(angleStr, PORT_LABEL_ANGLE, -180.0);
  const angle    = Math.atan2(pf.y - pe.y, pf.x - pe.x) + (Math.PI / 180) * angleDeg;
  const distMult = lateDouble(distanceStr || undefined, 1.0, 0.0);
  const dist     = PORT_LABEL_DISTANCE * distMult;
  l.pos.x = pe.x + dist * Math.cos(angle);
  l.pos.y = pe.y + dist * Math.sin(angle);
  l.set   = true;
}

// ---------------------------------------------------------------------------
// updateBB — extend graph bb to include label
// @see lib/dotgen/dotsplines.c:446 (updateBB call)
// ---------------------------------------------------------------------------

/** Expand g.info.bb to include the label's bounding box. */
export function updateBB(g: Graph, l: TextlabelT): void {
  const bb = g.info.bb;
  const hw = l.dimen.x / 2;
  const hh = l.dimen.y / 2;
  if (l.pos.x - hw < bb.ll.x) bb.ll.x = l.pos.x - hw;
  if (l.pos.y - hh < bb.ll.y) bb.ll.y = l.pos.y - hh;
  if (l.pos.x + hw > bb.ur.x) bb.ur.x = l.pos.x + hw;
  if (l.pos.y + hh > bb.ur.y) bb.ur.y = l.pos.y + hh;
}

// ---------------------------------------------------------------------------
// placeRegularEdgeLabels — post-routing label placement loop
// @see lib/dotgen/dotsplines.c:422-430
// ---------------------------------------------------------------------------

/**
 * After edge routing completes, place regular edge labels from virtual nodes
 * and expand the graph bounding box to include each label.
 *
 * Called once per graph after the parallel-edge routing loop and before
 * edge_normalize.  Mirrors the C post-routing place_vnlabel + updateBB loop
 * at dotsplines.c:422-430.  Flat-edge virtual nodes (in.size == 0) are
 * skipped inside placeVnlabel as in C.
 *
 * @see lib/dotgen/dotsplines.c:422-430
 */
export function placeRegularEdgeLabels(g: Graph): void {
  for (let n: Node | undefined = g.info.nlist; n; n = n.info.next) {
    if ((n.info.node_type ?? 0) !== VIRTUAL) continue;
    const l = n.info.label as TextlabelT | undefined;
    if (!l) continue;
    placeVnlabel(n);
    if (l.set) updateBB(g, l);
  }
}

// ---------------------------------------------------------------------------
// placePortLabels — the placement loop from dotsplines.c:440-458
// @see lib/dotgen/dotsplines.c:440-458
// ---------------------------------------------------------------------------

/**
 * C only places port labels here when a labelangle or labeldistance
 * attribute symbol is declared; otherwise the labels are handled by the
 * external-label pass (addXLabels — unported, see mission 9 journal).
 * @see lib/dotgen/dotsplines.c:440 (E_labelangle || E_labeldistance guard)
 */
function portLabelAttrsDeclared(g: Graph): boolean {
  if (g.attrs.has('labelangle') || g.attrs.has('labeldistance')) return true;
  for (const e of g.edges) {
    if (e.attrs.has('labelangle') || e.attrs.has('labeldistance')) return true;
  }
  return false;
}

/**
 * Walk all nodes and edges; call placePortlabel for head/tail labels.
 * @see lib/dotgen/dotsplines.c:440-458
 */
export function placePortLabels(g: Graph): void {
  if (!portLabelAttrsDeclared(g)) return;
  const hasLabels = g.info.has_labels !== undefined ? g.info.has_labels : 0;
  if (hasLabels & HEAD_LABEL) placeHeadLabels(g);
  if (hasLabels & TAIL_LABEL) placeTailLabels(g);
}

/**
 * Place head port labels for all in-edges of every node.
 * @see lib/dotgen/dotsplines.c:442-447
 */
function placeHeadLabels(g: Graph): void {
  for (const n of g.nodes.values()) {
    for (const e of g.edges) {
      if (e.head !== n) continue;
      if (e.info.head_label === undefined) continue;
      if (placePortlabel(e, true)) updateBB(g, e.info.head_label);
    }
  }
}

/**
 * Place tail port labels for all out-edges of every node.
 * @see lib/dotgen/dotsplines.c:449-455
 */
function placeTailLabels(g: Graph): void {
  for (const n of g.nodes.values()) {
    for (const e of g.edges) {
      if (e.tail !== n) continue;
      if (e.info.tail_label === undefined) continue;
      if (placePortlabel(e, false)) updateBB(g, e.info.tail_label);
    }
  }
}
