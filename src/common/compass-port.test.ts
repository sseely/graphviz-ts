// SPDX-License-Identifier: EPL-2.0

/**
 * compassPort geometry: maps a compass string to an aiming point (p), slope
 * (theta), and side on a node's bbox. Values verified against C graphviz
 * 15.0.0 (lib/common/shapes.c:compassPort:2733-2840). NOTE: north theta is
 * +π/2 and south is −π/2 (graphviz y-up); the mission brief's acceptance
 * values had the sign reversed — C is the spec.
 *
 * @see lib/common/shapes.c:compassPort
 */

import { describe, it, expect } from 'vitest';
import { compassPort } from './compass-port.js';
import { makePort } from '../model/edgeInfo.js';
import { makeNodeInfo } from '../model/nodeInfo.js';
import { BOTTOM, RIGHT, TOP, LEFT } from './splines-constants.js';

const ALL_SIDES = BOTTOM | RIGHT | TOP | LEFT;

/** A 54×36 node centered at the origin, rankdir=TB (no flip). */
function originNode() {
  const info = makeNodeInfo();
  info.coord = { x: 0, y: 0 };
  info.lw = 27; info.rw = 27; info.ht = 36;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { info, root: { info: { rankdir: 0 } } } as any;
}

function resolve(compass: string) {
  const pp = makePort();
  compassPort(originNode(), { bp: null, compass, sides: ALL_SIDES }, pp);
  return pp;
}

describe('compassPort — cardinal directions', () => {
  it('"n" → top point, theta +π/2, side TOP', () => {
    const p = resolve('n');
    expect(p.p).toEqual({ x: 0, y: 18 });
    expect(p.theta).toBeCloseTo(Math.PI / 2, 5);
    expect(p.side & TOP).toBe(TOP);
    expect(p.defined).toBe(true);
    // C sets clip=false for compass ports — the port point is exact, no
    // further node-boundary clipping. @see shapes.c:2808
    expect(p.clip).toBe(false);
  });

  it('"s" → bottom point, theta −π/2, side BOTTOM', () => {
    const p = resolve('s');
    expect(p.p).toEqual({ x: 0, y: -18 });
    expect(p.theta).toBeCloseTo(-Math.PI / 2, 5);
    expect(p.side & BOTTOM).toBe(BOTTOM);
  });

  it('"e" → right point theta 0; "w" → left point theta π', () => {
    expect(resolve('e').p).toEqual({ x: 27, y: 0 });
    expect(resolve('e').theta).toBeCloseTo(0, 5);
    expect(resolve('w').p).toEqual({ x: -27, y: 0 });
    expect(resolve('w').theta).toBeCloseTo(Math.PI, 5);
  });
});

describe('compassPort — diagonals, dyna, default', () => {
  it('"ne" (no shape insidefn) → bbox corner {27,18}, theta π/4', () => {
    const p = resolve('ne');
    expect(p.p).toEqual({ x: 27, y: 18 });
    expect(p.theta).toBeCloseTo(Math.PI / 4, 5);
  });

  // The C ictxt path: with a node shape inside-function, a diagonal compass
  // point lands on the actual shape boundary (via compassPoint → bezierClip),
  // not the bbox corner. @see lib/common/shapes.c:compassPort/compassPoint
  it('"ne" with an ellipse insidefn → on the boundary, not the corner', () => {
    const rx = 27;
    const ry = 18;
    const n = originNode();
    // Inject ND_shape(n)->fns->insidefn (center-relative ellipse test).
    n.info.shape = {
      fns: {
        insidefn: (_ctx: unknown, p: { x: number; y: number }): boolean =>
          (p.x * p.x) / (rx * rx) + (p.y * p.y) / (ry * ry) < 1,
      },
    };
    const pp = makePort();
    compassPort(n, { bp: null, compass: 'ne', sides: ALL_SIDES }, pp);
    // Boundary along the (1,1) ray ≈ (14.98, 14.98), well inside the corner.
    expect(pp.p.x).toBeCloseTo(pp.p.y, 0); // 45° ray ⇒ x ≈ y
    expect(pp.p.x).toBeGreaterThan(13);
    expect(pp.p.x).toBeLessThan(17); // NOT the bbox corner x=27
    // bezierClip's 0.5pt bisection lands just inside the boundary (≈0.95);
    // the bbox corner (27,18) would give 2.0.
    const onBoundary = (pp.p.x * pp.p.x) / (rx * rx) + (pp.p.y * pp.p.y) / (ry * ry);
    expect(onBoundary).toBeGreaterThan(0.85);
    expect(onBoundary).toBeLessThanOrEqual(1.0);
  });

  it('"_" (dyna) → dyna true, defined false', () => {
    const p = resolve('_');
    expect(p.dyna).toBe(true);
    expect(p.defined).toBe(false);
  });

  it('"" (no compass) → default Center port (defined false, p zero)', () => {
    const p = resolve('');
    expect(p.defined).toBe(false);
    expect(p.dyna).toBe(false);
    expect(p.p).toEqual({ x: 0, y: 0 });
  });
});
