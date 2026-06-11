// SPDX-License-Identifier: EPL-2.0

/**
 * Node/edge separation factors — expand_t, parseFactor, sepFactor,
 * esepFactor from neatogen's adjust.c.
 *
 * @see lib/neatogen/adjust.c (15.0.0)
 * @see lib/neatogen/adjust.h (15.0.0)
 */

import type { Graph } from '../../model/graph.js';
import { aggetGraph } from '../fdp/fdp-model.js';

/** @see lib/neatogen/adjust.h:expand_t */
export interface ExpandT {
  x: number;
  y: number;
  /** Margins are absolute additions (points) rather than scale factors. */
  doAdd: boolean;
}

/** Default esep/sep ratio. @see lib/neatogen/adjust.c:SEPFACT */
export const SEPFACT = 0.8;
/** Default margin in points. @see lib/neatogen/adjust.h:DFLT_MARGIN */
export const DFLT_MARGIN = 4;

/**
 * Convert a "sep" attribute string into an ExpandT.
 * "+x,y" becomes {x, y, doAdd:true}; "x,y" becomes
 * {1 + x/sepfact, 1 + y/sepfact, doAdd:false}.
 * Returns null on parse failure (C returns 0).
 *
 * @see lib/neatogen/adjust.c:parseFactor
 */
export function parseFactor(
  s: string,
  sepfact: number,
  dflt: number,
): ExpandT | null {
  let str = s.trimStart();
  let doAdd = false;
  if (str.startsWith('+')) {
    str = str.slice(1);
    doAdd = true;
  }
  const pair = scanDoublePair(str);
  if (pair === null) return null;
  const { x, y } = pair;
  if (doAdd) return parseAddFactor(x, y, sepfact, dflt);
  return { x: 1.0 + x / sepfact, y: 1.0 + y / sepfact, doAdd: false };
}

/** sscanf(s, "%lf,%lf") with the i==1 → y=x fallback. */
function scanDoublePair(str: string): { x: number; y: number } | null {
  const numRe = String.raw`-?[0-9.]+(?:[eE][-+]?[0-9]+)?`;
  const m = new RegExp(
    String.raw`^\s*(${numRe})\s*(?:,\s*(${numRe}))?`,
  ).exec(str);
  if (m === null || m[1] === undefined) return null;
  const x = parseFloat(m[1]);
  if (Number.isNaN(x)) return null;
  const y = m[2] !== undefined ? parseFloat(m[2]) : x;
  return { x, y };
}

/** The doAdd clamping branches of parseFactor. @see adjust.c:1021-1036 */
function parseAddFactor(
  x: number,
  y: number,
  sepfact: number,
  dflt: number,
): ExpandT {
  if (sepfact > 1) {
    return { x: Math.min(dflt, x / sepfact), y: Math.min(dflt, y / sepfact), doAdd: true };
  }
  if (sepfact < 1) {
    return { x: Math.max(dflt, x / sepfact), y: Math.max(dflt, y / sepfact), doAdd: true };
  }
  return { x, y, doAdd: true };
}

/**
 * Node separation for overlap adjustment: "sep" attr, then "esep"
 * scaled by 1/SEPFACT, then +4pt.
 * @see lib/neatogen/adjust.c:sepFactor
 */
export function sepFactor(g: Graph): ExpandT {
  const sep = aggetGraph(g, 'sep');
  if (sep !== undefined) {
    const pm = parseFactor(sep, 1.0, 0);
    if (pm !== null) return pm;
  }
  const esep = aggetGraph(g, 'esep');
  if (esep !== undefined) {
    const pm = parseFactor(esep, SEPFACT, DFLT_MARGIN);
    if (pm !== null) return pm;
  }
  return { x: DFLT_MARGIN, y: DFLT_MARGIN, doAdd: true };
}

/**
 * Edge separation for spline routing: smaller than sepFactor so the
 * spline code does not see overlaps the adjust pass left tight.
 * @see lib/neatogen/adjust.c:esepFactor
 */
export function esepFactor(g: Graph): ExpandT {
  const esep = aggetGraph(g, 'esep');
  if (esep !== undefined) {
    const pm = parseFactor(esep, 1.0, 0);
    if (pm !== null) return pm;
  }
  const sep = aggetGraph(g, 'sep');
  if (sep !== undefined) {
    const pm = parseFactor(sep, 1.0 / SEPFACT, SEPFACT * DFLT_MARGIN);
    if (pm !== null) return pm;
  }
  return { x: SEPFACT * DFLT_MARGIN, y: SEPFACT * DFLT_MARGIN, doAdd: true };
}
