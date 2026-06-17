// SPDX-License-Identifier: EPL-2.0

/**
 * DOT-7 — oracle-pinned geometry for regular-edge `splines=line` / `polyline`.
 *
 * Each case pins the named edge's `<path d="M...">` control points to the
 * geometry emitted by the installed `dot` 15.0.0 binary (`dot -Tsvg`), captured
 * 2026-06-17. All five cases are byte-identical to C at capture time; tolerances
 * follow the SR4 precedent (AD-3): polyline points 0.5pt, pure straight-line
 * endpoints 0.06pt.
 *
 * Coordinates are in the SVG frame (y negated from graphviz-internal y-up).
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge (1799-1861)
 * @see lib/dotgen/dotsplines.c:makeLineEdge (1636)
 * @see lib/common/routespl.c:routepolylines
 */

import { it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

const Q = String.fromCharCode(34);
const RE_NUM = new RegExp('-?[0-9.]+', 'g');

interface Pt { x: number; y: number; }

/** Control points of the edge whose `<title>` is `title`, in the SVG frame. */
function edgePoints(svg: string, title: string): Pt[] {
  const re = new RegExp('<title>' + title + '</title>[\\s\\S]*?d=' + Q + '(M[^' + Q + ']+)' + Q);
  const m = svg.match(re);
  if (m === null) throw new Error('no path for edge ' + title);
  const nums = m[1].match(RE_NUM) ?? [];
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: Number(nums[i]), y: Number(nums[i + 1]) });
  }
  return pts;
}

function expectPoints(actual: Pt[], expected: Pt[], tol: number): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(Math.abs(actual[i].x - expected[i].x)).toBeLessThanOrEqual(tol);
    expect(Math.abs(actual[i].y - expected[i].y)).toBeLessThanOrEqual(tol);
  }
}

const P = (x: number, y: number): Pt => ({ x, y });
const LINE_TOL = 0.06;
const PLINE_TOL = 0.5;

interface Case { name: string; dot: string; title: string; pts: Pt[]; tol: number; }

const CASES: Case[] = [
  {
    name: 'polyline multi-rank (a->c bows around b)',
    dot: 'digraph{splines=polyline; rankdir=TB; a->b->c; a->c}',
    title: 'a&#45;&gt;c', tol: PLINE_TOL,
    pts: [
      P(56.95, -143.65), P(59.57, -128.19), P(63, -108), P(63, -108), P(63, -108),
      P(63, -72), P(63, -72), P(63, -72), P(60.99, -60.17), P(58.87, -47.68),
    ],
  },
  {
    name: 'line multi-rank straightens to a 4-point segment',
    dot: 'digraph{splines=line; rankdir=TB; a->b->c; a->c}',
    title: 'a&#45;&gt;c', tol: LINE_TOL,
    pts: [P(54, -143.76), P(54, -119.53), P(54, -76.41), P(54, -47.51)],
  },
  {
    name: 'line adjacent-rank (box-straighten)',
    dot: 'digraph{splines=line; a->b}',
    title: 'a&#45;&gt;b', tol: LINE_TOL,
    pts: [P(27, -71.7), P(27, -64.41), P(27, -55.73), P(27, -47.54)],
  },
  {
    name: 'polyline adjacent-rank',
    dot: 'digraph{splines=polyline; a->b}',
    title: 'a&#45;&gt;b', tol: PLINE_TOL,
    pts: [P(27, -71.7), P(27, -64.41), P(27, -55.73), P(27, -47.54)],
  },
  {
    name: 'line multi-rank with edge label (makeLineEdge 7-point)',
    dot: 'digraph{splines=line; rankdir=TB; a->b->c->d; a->d[label=x]}',
    title: 'a&#45;&gt;d', tol: LINE_TOL,
    pts: [
      P(70.31, -234.5), P(74.29, -203.54), P(82, -143.5), P(82, -143.5),
      P(82, -143.5), P(68.84, -84.51), P(60.56, -47.42),
    ],
  },
];

for (const c of CASES) {
  it('DOT-7: ' + c.name, () => {
    const svg = renderSvg(c.dot, 'dot');
    expectPoints(edgePoints(svg, c.title), c.pts, c.tol);
  });
}
