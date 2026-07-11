// SPDX-License-Identifier: EPL-2.0

/**
 * fdp expansion layout: grow the point-node layout so sized nodes do
 * not overlap, by force iteration with overlap-aware repulsion.
 *
 * Spec read at the 15.0.0 tag (the post-tag Mlimit force cutoff is
 * deliberately NOT ported — the golden refs predate it).
 *
 * The default overlap attribute is "9:prism": up to 9 x_layout tries,
 * then removeOverlapAs with the remaining mode. x_layout does NOT always
 * converge (many cluster/derived graphs reach the mode dispatch), so
 * removeOverlapAs wires the ported neato adjust machinery: AM_PRISM via
 * fdpAdjust, the scale family via scAdjust. On the GTS reference build
 * overlap=false resolves to AM_PRISM (value 1000), not a no-op.
 *
 * @see lib/fdpgen/xlayout.c (15.0.0)
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import { sepFactor, type ExpandT } from '../neato/sep-factor.js';
import { fdpAdjust, overlapPrismTries } from '../neato/fdp-adjust.js';
import { scAdjust } from '../neato/sc-adjust.js';
import {
  type XParams,
  dndata,
  disp,
  aggetGraph,
  P_PIN,
} from './fdp-model.js';
import { coincidentDelta } from './tlayout.js';
import { normalizeG } from './normalize.js';

/** @see lib/fdpgen/xlayout.c:DFLT_overlap */
const DFLT_OVERLAP = '9:prism';

/** PS2INCH @see lib/common/geom.h */
const PS2INCH = (x: number): number => x / 72;

// ---------------------------------------------------------------------------
// xParams / X_marg — static state (C statics, persist across calls)
// ---------------------------------------------------------------------------

/** @see lib/fdpgen/xlayout.c:xParams */
const xParams: XParams = {
  numIters: 60,
  T0: 0.0,
  K: 0.3,
  C: 1.5,
  loopcnt: 0,
};

/** @see lib/fdpgen/xlayout.c:X_marg */
let xMarg: ExpandT = { x: 0, y: 0, doAdd: false };

/** Overlap/non-overlap repulsion strengths for one try. */
interface RepStrength {
  /** X_ov = C·K². @see lib/fdpgen/xlayout.c:x_layout */
  ov: number;
  /** X_nonov = |E|·X_ov·2 / (|V|·(|V|−1)). */
  nonov: number;
}

/** Expanded half-width of n in inches. @see lib/fdpgen/xlayout.c:WD2 */
function wd2(n: Node): number {
  return xMarg.doAdd ? n.info.width / 2.0 + xMarg.x : n.info.width * xMarg.x / 2.0;
}

/** Expanded half-height of n in inches. @see lib/fdpgen/xlayout.c:HT2 */
function ht2(n: Node): number {
  return xMarg.doAdd ? n.info.height / 2.0 + xMarg.y : n.info.height * xMarg.y / 2.0;
}

/** Expanded radius of n. @see lib/fdpgen/xlayout.c:RAD */
function rad(n: Node): number {
  return Math.hypot(wd2(n), ht2(n));
}

/**
 * Initialize the local expansion parameters from the tlayout handoff.
 * @returns K² @see lib/fdpgen/xlayout.c:xinit_params
 */
function xinitParams(n: number, xpms: XParams): number {
  xParams.K = xpms.K;
  xParams.numIters = xpms.numIters;
  xParams.T0 = xpms.T0;
  xParams.loopcnt = xpms.loopcnt;
  if (xpms.C > 0.0) xParams.C = xpms.C;
  const K2 = xParams.K * xParams.K;
  if (xParams.T0 === 0.0) {
    xParams.T0 = xParams.K * Math.sqrt(n) / 5;
  }
  return K2;
}

/** @see lib/fdpgen/xlayout.c:cool */
function cool(t: number): number {
  return xParams.T0 * (xParams.numIters - t) / xParams.numIters;
}

// ---------------------------------------------------------------------------
// Overlap predicate
// ---------------------------------------------------------------------------

/** True if expanded node boxes overlap. @see lib/fdpgen/xlayout.c:overlap */
function overlap(p: Node, q: Node): boolean {
  const xdelta = Math.abs(q.info.pos![0]! - p.info.pos![0]!);
  const ydelta = Math.abs(q.info.pos![1]! - p.info.pos![1]!);
  return xdelta <= wd2(p) + wd2(q) && ydelta <= ht2(p) + ht2(q);
}

/** Number of overlapping pairs. @see lib/fdpgen/xlayout.c:cntOverlaps */
function cntOverlaps(g: Graph): number {
  let cnt = 0;
  const nodes = [...g.nodes.values()];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      cnt += overlap(nodes[i]!, nodes[j]!) ? 1 : 0;
    }
  }
  return cnt;
}

// ---------------------------------------------------------------------------
// Forces
// ---------------------------------------------------------------------------

/**
 * Overlap-aware repulsion; returns 1 if the pair overlaps.
 * The delta/dist2 computation of C's applyRep is inlined here; the
 * C doRep/applyRep split exists for the rand() re-roll loop on
 * coincident nodes (coincidentDelta), shared with tlayout.
 * @see lib/fdpgen/xlayout.c:doRep
 * @see lib/fdpgen/xlayout.c:applyRep
 */
function applyRep(p: Node, q: Node, rs: RepStrength): number {
  let xdelta = q.info.pos![0]! - p.info.pos![0]!;
  let ydelta = q.info.pos![1]! - p.info.pos![1]!;
  let dist2 = xdelta * xdelta + ydelta * ydelta;
  if (dist2 === 0.0) {
    const d = coincidentDelta();
    xdelta = d.xdelta;
    ydelta = d.ydelta;
    dist2 = xdelta * xdelta + ydelta * ydelta;
  }
  const ov = overlap(p, q) ? 1 : 0;
  const force = ov ? rs.ov / dist2 : rs.nonov / dist2;
  const dq = disp(q);
  const dp = disp(p);
  dq[0] += xdelta * force;
  dq[1] += ydelta * force;
  dp[0] -= xdelta * force;
  dp[1] -= ydelta * force;
  return ov;
}

/**
 * Attraction along edges, zero while the endpoints overlap.
 * @see lib/fdpgen/xlayout.c:applyAttr
 */
function applyAttr(p: Node, q: Node): void {
  if (overlap(p, q)) return;
  const xdelta = q.info.pos![0]! - p.info.pos![0]!;
  const ydelta = q.info.pos![1]! - p.info.pos![1]!;
  const dist = Math.hypot(xdelta, ydelta);
  const din = rad(p) + rad(q);
  const dout = dist - din;
  const force = dout * dout / ((xParams.K + din) * dist);
  const dq = disp(q);
  const dp = disp(p);
  dq[0] -= xdelta * force;
  dq[1] -= ydelta * force;
  dp[0] += xdelta * force;
  dp[1] += ydelta * force;
}

// ---------------------------------------------------------------------------
// adjust
// ---------------------------------------------------------------------------

/** Accumulate all forces; returns the overlap count. */
function accumForces(g: Graph, rs: RepStrength): number {
  let overlaps = 0;
  const nodes = [...g.nodes.values()];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    for (let j = i + 1; j < nodes.length; j++) {
      overlaps += applyRep(n, nodes[j]!, rs);
    }
    for (const e of n.outEdges(g)) {
      applyAttr(n, e.head);
    }
  }
  return overlaps;
}

/** Temperature-limited position update. @see xlayout.c:adjust (move loop) */
function moveNodes(g: Graph, temp: number): void {
  const temp2 = temp * temp;
  for (const n of g.nodes.values()) {
    if (dndata(n).pinned === P_PIN) continue;
    const dx = disp(n)[0];
    const dy = disp(n)[1];
    const len2 = dx * dx + dy * dy;
    if (len2 < temp2) {
      n.info.pos![0]! += dx;
      n.info.pos![1]! += dy;
    } else {
      const len = Math.sqrt(len2);
      n.info.pos![0]! += dx * temp / len;
      n.info.pos![1]! += dy * temp / len;
    }
  }
}

/**
 * One expansion iteration. Returns 0 if there were definitely no
 * overlaps; non-zero if overlaps existed before the move.
 * @see lib/fdpgen/xlayout.c:adjust
 */
function adjust(g: Graph, temp: number, rs: RepStrength): number {
  for (const n of g.nodes.values()) {
    const d = disp(n);
    d[0] = d[1] = 0;
  }
  const overlaps = accumForces(g, rs);
  if (overlaps === 0) return 0;
  moveNodes(g, temp);
  return overlaps;
}

// ---------------------------------------------------------------------------
// x_layout
// ---------------------------------------------------------------------------

/**
 * Expand the layout until nodes no longer overlap, up to `tries`
 * rounds with growing K. Returns the remaining overlap count.
 * @see lib/fdpgen/xlayout.c:x_layout
 */
function xLayout(g: Graph, pxpms: XParams, tries: number): number {
  xMarg = sepFactor(g);
  if (xMarg.doAdd) {
    xMarg = { x: PS2INCH(xMarg.x), y: PS2INCH(xMarg.y), doAdd: true };
  }
  let ov = cntOverlaps(g);
  if (ov === 0) return 0;

  const xpms: XParams = { ...pxpms };
  const K = xpms.K;
  for (let t = 0; ov && t < tries; ++t) {
    ov = xLayoutTry(g, xpms, ov);
    xpms.K += K; /* increase distance */
  }

  return ov;
}

/** One expansion try: cool from T0 until no overlaps or loopcnt. */
function xLayoutTry(g: Graph, xpms: XParams, ov: number): number {
  const nnodes = g.nodes.size;
  const nedges = g.edges.length;
  const K2 = xinitParams(nnodes, xpms);
  const xOv = xParams.C * K2;
  const rs: RepStrength = {
    ov: xOv,
    nonov: nedges * xOv * 2.0 / (nnodes * (nnodes - 1)),
  };
  for (let i = 0; i < xParams.loopcnt; i++) {
    const temp = cool(i);
    if (temp <= 0.0) break;
    ov = adjust(g, temp, rs);
    if (ov === 0) break;
  }
  return ov;
}

// ---------------------------------------------------------------------------
// fdp_xLayout
// ---------------------------------------------------------------------------

/** Parse the overlap attribute's optional "n:" try-count prefix. */
function parseOverlapTries(ovlp: string): { tries: number; rest: string } {
  const cp = ovlp.indexOf(':');
  if (cp >= 0 && (cp === 0 || /^[0-9]/.test(ovlp))) {
    const tries = Math.max(0, parseInt(ovlp, 10) || 0);
    return { tries, rest: ovlp.slice(cp + 1) };
  }
  return { tries: 0, rest: ovlp };
}

/**
 * Overlap-removal dispatch on the overlap attribute:
 *   ""/null → default "9:prism"; "n:mode" → n x_layout tries, then
 *   removeOverlap with mode; "true" → keep overlaps.
 * @see lib/fdpgen/xlayout.c:fdp_xLayout
 */
export function fdpXLayout(g: Graph, xpms: XParams): void {
  let ovlp = aggetGraph(g, 'overlap');
  if (ovlp === undefined || ovlp === '') ovlp = DFLT_OVERLAP;
  const { tries, rest } = parseOverlapTries(ovlp);
  if (tries && !xLayout(g, xpms, tries)) return;
  removeOverlapAs(g, rest);
}

/**
 * Mode-based overlap removal, mirroring C removeOverlapAs → getAdjustMode →
 * removeOverlapWith with the flag passed explicitly (the parsed "n:mode"
 * suffix, not the raw overlap attr). removeOverlapWith runs normalize +
 * simpleScale first, then dispatches on the resolved mode:
 *   AM_PRISM (prism*, or the boolean/false fallback on GTS) → fdpAdjust;
 *   scale family (scale/scalexy/compress) → scAdjust;
 *   AM_NONE ('' / 'true') and unported modes (voronoi) → no-op.
 * normalize reads "normalize" and simpleScale reads "scale"; deriveGraph
 * copies only overlap/sep/K, so both are faithfully dead here (as noted in
 * normalize.ts / sc-adjust.ts) unless set on the derived chain — simpleScale
 * follows the project's decision to leave it unported.
 * @see lib/neatogen/adjust.c:removeOverlapAs / removeOverlapWith / getAdjustMode
 */
function removeOverlapAs(g: Graph, flag: string): void {
  if (g.nodes.size < 2) return; // removeOverlapWith: <2 nodes short-circuits
  normalizeG(g); // removeOverlapWith runs normalize before the mode switch
  const ntry = overlapPrismTries(flag);
  if (ntry !== null) {
    fdpAdjust(g, ntry); // AM_PRISM
    return;
  }
  const mode = flag.toLowerCase();
  if (mode === 'scale') return void scAdjust(g, 1); // AM_NSCALE
  if (mode === 'scalexy') return void scAdjust(g, 0); // AM_SCALEXY
  if (mode === 'compress') return void scAdjust(g, -1); // AM_COMPRESS
  // Genuinely unported adjust algorithms: throw rather than silently leave
  // overlaps (no supported corpus input reaches these).
  if (UNPORTED_MODES.has(mode)) {
    throw new Error(
      `fdp: removeOverlapAs mode "${mode}" reached for graph "${g.name}" — ` +
      'that adjust algorithm (voronoi/oscale/vpsc/ortho/ipsep) is not ported',
    );
  }
  // AM_NONE ('', 'true', any boolean-true) → no overlap removal.
}

/** Named adjust modes whose C algorithm is not ported (would silently
 * leave overlaps). @see lib/neatogen/adjust.c:removeOverlapWith switch */
const UNPORTED_MODES = new Set([
  'voronoi', 'oscale', 'vpsc', 'ipsep',
  'ortho', 'ortho_yx', 'orthoxy', 'orthoyx',
  'portho', 'portho_yx', 'porthoxy', 'porthoyx',
]);
