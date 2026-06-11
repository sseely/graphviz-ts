// SPDX-License-Identifier: EPL-2.0

/**
 * Layout normalization: translate the first node to the origin and
 * rotate so the first edge points at the "normalize" angle. A no-op
 * unless the attribute is set — and fdp calls it on derived
 * components, which never inherit the user's normalize attribute
 * (deriveGraph copies only overlap/sep/K), so for fdp this is
 * faithfully dead unless set on the derived chain.
 *
 * @see lib/neatogen/adjust.c:normalize (15.0.0)
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import { aggetGraph } from './fdp-model.js';

/** mapbool for the "normalize" attr. @see lib/common/utils.c:mapbool */
function mapbool(s: string): boolean {
  const t = s.toLowerCase();
  if (t === 'false' || t === 'no') return false;
  if (t === 'true' || t === 'yes') return true;
  const v = parseInt(s, 10);
  return !Number.isNaN(v) && v !== 0;
}

/**
 * Angle from the "normalize" attribute in radians, or null if unset.
 * Guarantees −π < φ ≤ π.
 * @see lib/neatogen/adjust.c:angleSet (15.0.0)
 */
function angleSet(g: Graph): number | null {
  const a = aggetGraph(g, 'normalize');
  if (a === undefined || a === '') return null;
  const ang = parseAngle(a);
  if (ang === null) return null;
  return wrapDegrees(ang) * (Math.PI / 180);
}

/** strtod with the mapbool fallback of angleSet. */
function parseAngle(a: string): number | null {
  const m = /^-?[\d.]+(?:[eE][-+]?\d+)?/.exec(a);
  if (m !== null) return parseFloat(m[0]);
  /* no number */
  return mapbool(a) ? 0.0 : null;
}

/** Wrap to (−180, 180]. */
function wrapDegrees(ang: number): number {
  while (ang > 180) ang -= 360;
  while (ang <= -180) ang += 360;
  return ang;
}

/**
 * If "normalize" is set, move the first node to the origin, then
 * rotate the layout so the first edge sits at the given angle.
 * @see lib/neatogen/adjust.c:normalize (15.0.0)
 */
export function normalizeG(g: Graph): void {
  const phi0 = angleSet(g);
  if (phi0 === null) return;

  const nodes = [...g.nodes.values()];
  const first = nodes[0];
  if (first === undefined) return;
  const px = first.info.pos![0]!;
  const py = first.info.pos![1]!;
  for (const v of nodes) {
    v.info.pos![0]! -= px;
    v.info.pos![1]! -= py;
  }

  let e = null;
  for (const v of nodes) {
    const out = v.outEdges(g);
    if (out.length > 0) { e = out[0]!; break; }
  }
  if (e === null) return;

  /* rotation necessary; pos => ccw */
  const phi = phi0 - Math.atan2(
    e.head.info.pos![1]! - e.tail.info.pos![1]!,
    e.head.info.pos![0]! - e.tail.info.pos![0]!);
  if (phi) rotateAll(nodes, e.tail, phi);
}

/** Rotate all positions by phi about the orig node. */
function rotateAll(nodes: Node[], orig: Node, phi: number): void {
  const ox = orig.info.pos![0]!;
  const oy = orig.info.pos![1]!;
  const cosv = Math.cos(phi);
  const sinv = Math.sin(phi);
  for (const v of nodes) {
    const x = v.info.pos![0]! - ox;
    const y = v.info.pos![1]! - oy;
    v.info.pos![0] = x * cosv - y * sinv + ox;
    v.info.pos![1] = x * sinv + y * cosv + oy;
  }
}
