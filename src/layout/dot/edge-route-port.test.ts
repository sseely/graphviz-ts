// SPDX-License-Identifier: EPL-2.0

/**
 * T6a — edge-port spline attachment in the active router. An edge that declares
 * a compass port (`A:s->B:n`) attaches the spline at `node.coord + port.p` and
 * skips the node-boundary clip (port.clip = false), instead of entering at the
 * node center. Expected coordinates are read from the installed dot 15.0.0
 * binary; tolerance 0.5pt (AD6) absorbs the active fitter's control-point
 * divergence from C's routesplines.
 *
 * @see lib/common/splines.c:beginpath (P.start.p = ND_coord(n) + port.p)
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

/** First edge path's start point `Mx,y` from a rendered SVG. */
function edgeStart(dot: string): { x: number; y: number } {
  const svg = renderSvg(dot, 'dot');
  const marker = ' d=' + String.fromCharCode(34) + 'M';
  const i = svg.indexOf(marker);
  if (i < 0) throw new Error('no edge path in SVG');
  const re = new RegExp('^(-?[0-9.]+),(-?[0-9.]+)');
  const m = svg.slice(i + marker.length).match(re);
  if (m === null) throw new Error('no edge coords in SVG');
  return { x: Number(m[1]), y: Number(m[2]) };
}

const TOL = 0.5;

describe('edge ports — compass attachment (vs dot 15.0.0)', () => {
  it('plain A->B is unchanged: enters at the node-center boundary clip', () => {
    const s = edgeStart('digraph{A->B}');
    expect(Math.abs(s.x - 27)).toBeLessThan(TOL);
    expect(Math.abs(s.y - -71.7)).toBeLessThan(TOL);
  });

  it('A:s->B:n attaches at the tail bottom face (port point, no center clip)', () => {
    const s = edgeStart('digraph{A:s->B:n}');
    // C oracle: M27,-72 — exact bottom-center, not the -71.7 boundary clip.
    expect(Math.abs(s.x - 27)).toBeLessThan(TOL);
    expect(Math.abs(s.y - -72)).toBeLessThan(TOL);
  });

  it('rankdir=LR A:e->B:w attaches at the tail east face', () => {
    const s = edgeStart('digraph{rankdir=LR; A:e->B:w}');
    // C oracle: M54,-18 — right edge of the tail node.
    expect(Math.abs(s.x - 54)).toBeLessThan(TOL);
    expect(Math.abs(s.y - -18)).toBeLessThan(TOL);
  });
});

describe('edge ports — the port moves the attachment off-center', () => {
  it('A:s start sits below the plain A->B start (bottom face vs boundary)', () => {
    const plain = edgeStart('digraph{A->B}');
    const ported = edgeStart('digraph{A:s->B:n}');
    // Port point is the exact node bottom (-72), lower than the clipped -71.7.
    expect(ported.y).toBeLessThan(plain.y);
  });
});
