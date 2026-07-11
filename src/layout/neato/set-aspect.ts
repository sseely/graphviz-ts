// SPDX-License-Identifier: EPL-2.0

/**
 * neato-family aspect-ratio handling — _neato_set_aspect and its helpers.
 *
 * C's graph_init parses ratio/size into GD_drawing for every engine; the
 * spline_edges0(g, true) entry then reshapes the layout via neato_set_aspect
 * before routing: fill/expand/value scale ND_pos (and the bb), compress and
 * auto only normalize the origin. The dot engine has its own setAspect and
 * never reaches this path.
 *
 * @see lib/neatogen/neatosplines.c:1023 _neato_set_aspect
 * @see lib/neatogen/neatosplines.c:992 neato_translate
 * @see lib/common/input.c (setRatio / graph_init)
 */

import type { Graph } from '../../model/graph.js';
import type { RatioKind } from '../../model/layoutParams.js';
import { makeDrawing } from '../../model/layoutParams.js';
import { parseDrawingSize } from '../../gvc/viewport.js';
import { shiftEdgePoints } from '../pack/index.js';

const POINTS_PER_INCH = 72;

/** setRatio's ratio-attr mapping. @see lib/common/input.c:setRatio */
function neatoRatioKind(g: Graph): { kind: RatioKind; ratio: number } | null {
  const p = g.attrs.get('ratio');
  if (p === undefined) return null;
  if (p === 'auto') return { kind: 'auto', ratio: 0 };
  if (p === 'compress') return { kind: 'compress', ratio: 0 };
  if (p === 'expand') return { kind: 'expand', ratio: 0 };
  if (p === 'fill') return { kind: 'fill', ratio: 0 };
  const v = Number.parseFloat(p);
  return v > 0 ? { kind: 'value', ratio: v } : null;
}

/**
 * `size` attr in points (+ '!' filled flag). C's getdoubles2ptf stores the
 * size via the POINTS() macro = ROUND(inches * 72), i.e. integer points — the
 * value _neato_set_aspect divides by GD_bb to form the fill/expand factors.
 * Delegates to the dot-path parser so both engines round size identically;
 * skipping the ROUND left size as float inches*72, which perturbed the fill
 * x-scale by ~0.17% on ratio=fill layouts (1855 under circo/twopi/osage).
 * @see lib/common/input.c:476 getdoubles2ptf / lib/common/geom.h:62 POINTS
 */
function neatoSizePoints(raw: string | undefined): { x: number; y: number } | null {
  const sz = parseDrawingSize(raw);
  return sz ? { x: sz.x, y: sz.y } : null;
}

/**
 * Populate g.info.drawing with the ratio/size fields _neato_set_aspect reads,
 * mirroring graph_init's engine-neutral parse. No-op when the dot-side init
 * already parsed a drawing.
 */
export function parseNeatoDrawing(g: Graph): void {
  if (g.info.drawing !== undefined) return;
  const rk = neatoRatioKind(g);
  const sz = neatoSizePoints(g.attrs.get('size'));
  if (rk === null && sz === null) return;
  g.info.drawing = makeDrawing({
    ratioKind: rk?.kind ?? 'none',
    ratio: rk?.ratio ?? 0,
    size: sz ? { x: sz.x, y: sz.y } : { x: 0, y: 0 },
  });
}

/** Scale g's bb and every cluster bb. @see neatosplines.c (scaleBB) */
function scaleBB(g: Graph, xf: number, yf: number): void {
  if (g.info.bb) {
    g.info.bb = {
      ll: { x: g.info.bb.ll.x * xf, y: g.info.bb.ll.y * yf },
      ur: { x: g.info.bb.ur.x * xf, y: g.info.bb.ur.y * yf },
    };
  }
  for (const sub of g.info.clust ?? []) scaleBB(sub, xf, yf);
}

/** Translate cluster bbs (translateG). @see neatosplines.c:974 */
function translateG(g: Graph, ll: { x: number; y: number }): void {
  if (g.info.bb) {
    g.info.bb = {
      ll: { x: g.info.bb.ll.x - ll.x, y: g.info.bb.ll.y - ll.y },
      ur: { x: g.info.bb.ur.x - ll.x, y: g.info.bb.ur.y - ll.y },
    };
  }
  for (const sub of g.info.clust ?? []) translateG(sub, ll);
}

/**
 * Translate the drawing so bb.LL is the origin: node pos (inches) and
 * xlabels, routed splines, then the bb tree.
 * @see lib/neatogen/neatosplines.c:992 neato_translate
 */
export function neatoTranslate(g: Graph): void {
  const bb = g.info.bb;
  if (!bb) return;
  const ll = bb.ll;
  const ox = ll.x / POINTS_PER_INCH;
  const oy = ll.y / POINTS_PER_INCH;
  for (const n of g.nodes.values()) {
    if (!n.info.pos) n.info.pos = [0, 0];
    n.info.pos[0] = (n.info.pos[0] ?? 0) - ox;
    n.info.pos[1] = (n.info.pos[1] ?? 0) - oy;
    const xl = n.info.xlabel as { set?: boolean; pos?: { x: number; y: number } } | undefined;
    if (xl?.set === true && xl.pos) {
      xl.pos = { x: xl.pos.x - ll.x, y: xl.pos.y - ll.y };
    }
  }
  for (const e of g.edges) {
    if (e.info.spl) shiftEdgePoints(e, -ll.x, -ll.y);
  }
  translateG(g, ll);
}

/** The fill/expand/value scale factors; null → no scaling. */
function aspectFactors(g: Graph): { xf: number; yf: number } | null {
  const drawing = g.info.drawing!;
  const bb = g.info.bb!;
  if (drawing.ratioKind === 'fill') {
    // fill is weird because both X and Y can stretch
    if (drawing.size.x <= 0) return null;
    let xf = drawing.size.x / bb.ur.x;
    let yf = drawing.size.y / bb.ur.y;
    if (xf < 1.0 || yf < 1.0) {
      if (xf < yf) { yf /= xf; xf = 1.0; }
      else { xf /= yf; yf = 1.0; }
    }
    return { xf, yf };
  }
  if (drawing.ratioKind === 'expand') {
    if (drawing.size.x <= 0) return null;
    const xf = drawing.size.x / bb.ur.x;
    const yf = drawing.size.y / bb.ur.y;
    if (xf > 1.0 && yf > 1.0) {
      const scale = Math.min(xf, yf);
      return { xf: scale, yf: scale };
    }
    return null;
  }
  if (drawing.ratioKind === 'value') {
    const desired = drawing.ratio;
    const actual = bb.ur.y / bb.ur.x;
    if (actual < desired) return { xf: 1.0, yf: desired / actual };
    return { xf: actual / desired, yf: 1.0 };
  }
  return null; // auto / compress: translate only
}

/**
 * Reshape the layout per ratio/size — assumes bb is computed and applies only
 * on the root graph. Returns true when node positions moved.
 * @see lib/neatogen/neatosplines.c:1023 _neato_set_aspect
 */
export function neatoSetAspectRatio(g: Graph): boolean {
  if (g.root !== g) return false;
  const drawing = g.info.drawing;
  if (!drawing || drawing.ratioKind === 'none') return false;
  const bb = g.info.bb;
  if (!bb) return false;
  let translated = false;
  if (bb.ll.x !== 0 || bb.ll.y !== 0) {
    translated = true;
    neatoTranslate(g);
  }
  // (GD_flip normalize skipped: effective rankdir is TB for every engine on
  // this path — neutralGraphRankdir clears flip.)
  const f = aspectFactors(g);
  if (f === null) return translated;
  const { xf, yf } = f;
  for (const n of g.nodes.values()) {
    if (!n.info.pos) continue;
    n.info.pos[0] = (n.info.pos[0] ?? 0) * xf;
    n.info.pos[1] = (n.info.pos[1] ?? 0) * yf;
  }
  scaleBB(g, xf, yf);
  return true;
}
