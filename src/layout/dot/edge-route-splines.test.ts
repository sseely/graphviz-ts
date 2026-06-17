// SPDX-License-Identifier: EPL-2.0

/**
 * T2 (mission dot-splines) — oracle-pinned geometry for plain adjacent-rank
 * forward edges now routed through the faithful pathplan path
 * (`routeRegularEdgeFaithful` + `routeSplines`), retiring the simplified fitter
 * for this category (AD-1/AD-2).
 *
 * These cases are the core DOT-1 bug: the simplified fitter collapsed the
 * outermost steep diagonals of a wide fan-out / fan-in to ~0.4pt stubs near the
 * tail (effectively invisible edges). The faithful path routes the full spline.
 *
 * Values are captured from the built dot (`~/git/graphviz/build/cmd/dot/dot`,
 * `GVBINDIR=/tmp/gvplugins`, 15.x), 2026-06-16. Coordinates are in the SVG frame
 * (y negated from graphviz-internal y-up). Tolerance 0.5pt (AD-3): the faithful
 * router is numerically close to but not byte-identical with C's routesplines.
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

const Q = String.fromCharCode(34);
const RE_PATH = new RegExp('<path[^>]*\\sd=' + Q + '([^' + Q + ']+)' + Q, 'g');
const RE_NUM = new RegExp('-?[0-9.]+', 'g');

interface Pt { x: number; y: number; }

/** All edge `<path d="M...">` control-point lists, in the SVG frame. */
function edgePaths(svg: string): Pt[][] {
  RE_PATH.lastIndex = 0;
  const paths: Pt[][] = [];
  let m: RegExpExecArray | null;
  while ((m = RE_PATH.exec(svg)) !== null) {
    const nums = (m[1].match(RE_NUM) ?? []).map(Number);
    const pts: Pt[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
    paths.push(pts);
  }
  return paths;
}

/** Max Euclidean control-point delta between two equal-length point lists. */
function maxDelta(a: Pt[], b: Pt[]): number {
  expect(a.length).toBe(b.length);
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    d = Math.max(d, Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y));
  }
  return d;
}

/** Distance from a spline's first to last control point. */
function span(pts: Pt[]): number {
  const a = pts[0];
  const b = pts[pts.length - 1];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const TOL = 0.5;

/** dot 15.x control points for `digraph{a->b;a->c;a->d;a->e;a->f}` (SVG frame). */
const DOT_FANOUT: Pt[][] = [
  [{ x: 149.44, y: -78.52 }, { x: 125.34, y: -66.8 }, { x: 86.08, y: -47.72 }, { x: 58.53, y: -34.32 }],
  [{ x: 156.08, y: -74.5 }, { x: 146.23, y: -64.92 }, { x: 133.14, y: -52.19 }, { x: 121.97, y: -41.34 }],
  [{ x: 171, y: -71.7 }, { x: 171, y: -64.41 }, { x: 171, y: -55.73 }, { x: 171, y: -47.54 }],
  [{ x: 185.92, y: -74.5 }, { x: 195.77, y: -64.92 }, { x: 208.86, y: -52.19 }, { x: 220.03, y: -41.34 }],
  [{ x: 192.56, y: -78.52 }, { x: 216.66, y: -66.8 }, { x: 255.92, y: -47.72 }, { x: 283.47, y: -34.32 }],
];

/** dot 15.x control points for `digraph{b->z;c->z;d->z;e->z;f->z}` (SVG frame). */
const DOT_MERGE: Pt[][] = [
  [{ x: 48.56, y: -78.52 }, { x: 72.66, y: -66.8 }, { x: 111.92, y: -47.72 }, { x: 139.47, y: -34.32 }],
  [{ x: 113.92, y: -74.5 }, { x: 123.77, y: -64.92 }, { x: 136.86, y: -52.19 }, { x: 148.03, y: -41.34 }],
  [{ x: 171, y: -71.7 }, { x: 171, y: -64.41 }, { x: 171, y: -55.73 }, { x: 171, y: -47.54 }],
  [{ x: 228.08, y: -74.5 }, { x: 218.23, y: -64.92 }, { x: 205.14, y: -52.19 }, { x: 193.97, y: -41.34 }],
  [{ x: 293.44, y: -78.52 }, { x: 269.34, y: -66.8 }, { x: 230.08, y: -47.72 }, { x: 202.53, y: -34.32 }],
];

/** dot 15.x control points for `digraph{a->b;a->c;a->d}` (mid fan, SVG frame). */
const DOT_FAN3: Pt[][] = [
  [{ x: 84.08, y: -74.5 }, { x: 74.23, y: -64.92 }, { x: 61.14, y: -52.19 }, { x: 49.97, y: -41.34 }],
  [{ x: 99, y: -71.7 }, { x: 99, y: -64.41 }, { x: 99, y: -55.73 }, { x: 99, y: -47.54 }],
  [{ x: 113.92, y: -74.5 }, { x: 123.77, y: -64.92 }, { x: 136.86, y: -52.19 }, { x: 148.03, y: -41.34 }],
];

describe('plain adjacent-rank forward edges via faithful pathplan (dot oracle)', () => {
  it('wide fan-out a->{b..f}: every edge matches dot, no degenerate stub', () => {
    const paths = edgePaths(renderSvg('digraph{a->b;a->c;a->d;a->e;a->f}', 'dot'));
    expect(paths.length).toBe(5);
    for (let i = 0; i < 5; i++) expect(maxDelta(paths[i], DOT_FANOUT[i])).toBeLessThanOrEqual(TOL);
    // The outermost edges (a->b, a->f) are the ones the fitter collapsed; they
    // span ~100pt, not ~0.4pt. Every edge must travel a real distance.
    for (const p of paths) expect(span(p)).toBeGreaterThan(10);
  });

  it('wide fan-in {b..f}->z: every edge matches dot, no degenerate stub', () => {
    const paths = edgePaths(renderSvg('digraph{b->z;c->z;d->z;e->z;f->z}', 'dot'));
    expect(paths.length).toBe(5);
    for (let i = 0; i < 5; i++) expect(maxDelta(paths[i], DOT_MERGE[i])).toBeLessThanOrEqual(TOL);
    for (const p of paths) expect(span(p)).toBeGreaterThan(10);
  });

  it('mid fan a->{b,c,d}: matches dot (regression guard for narrower fans)', () => {
    const paths = edgePaths(renderSvg('digraph{a->b;a->c;a->d}', 'dot'));
    expect(paths.length).toBe(3);
    for (let i = 0; i < 3; i++) expect(maxDelta(paths[i], DOT_FAN3[i])).toBeLessThanOrEqual(TOL);
    for (const p of paths) expect(span(p)).toBeGreaterThan(10);
  });
});
