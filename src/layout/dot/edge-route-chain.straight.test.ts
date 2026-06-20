// SPDX-License-Identifier: EPL-2.0

/**
 * Integration tests for straight-mode (smode) chain segmentation in
 * make_regular_edge. A long multi-rank edge whose virtual-node chain contains a
 * collinear run of length ≥ the straight_len threshold is split into
 * spline-top + straight-middle + spline-bottom; the straight middle appears as
 * duplicate control points pinned to the corridor x (straight_path's two
 * appended copies). Below the threshold the edge routes as a single spline.
 *
 * Repro: digraph { a->b->c->d->e->f; a->f; } — a->f (L5) crosses 5 ranks and
 * triggers smode; a->e (L4, 4 ranks) and a->d (L3, 3 ranks) stay below it.
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge (smode loop)
 */

import { it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

interface Pt { x: number; y: number; }

/** Extract the `d` path of the edge titled `tail-&gt;head` from a rendered SVG. */
function edgePath(svg: string, tail: string, head: string): string {
  const title = `<title>${tail}&#45;&gt;${head}</title>`;
  const at = svg.indexOf(title);
  expect(at, `edge ${tail}->${head} present`).toBeGreaterThanOrEqual(0);
  const d = /d="([^"]*)"/.exec(svg.slice(at))![1];
  return d;
}

/** Parse every "x,y" coordinate pair out of an SVG path `d` string. */
function pathPoints(d: string): Pt[] {
  const out: Pt[] = [];
  const re = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) out.push({ x: Number(m[1]), y: Number(m[2]) });
  return out;
}

/** Count consecutive identical control points — straight_path's duplicate marker. */
function duplicatePairs(pts: Pt[]): number {
  let n = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].x === pts[i - 1].x && pts[i].y === pts[i - 1].y) n++;
  }
  return n;
}

const L5 = 'digraph { a->b->c->d->e->f; a->f; }';
const L4 = 'digraph { a->b->c->d->e; a->e; }';
const L3 = 'digraph { a->b->c->d; a->d; }';
const POLY_L5 = 'digraph { graph [splines=polyline]; a->b->c->d->e->f; a->f; }';
const POLY_L4 = 'digraph { graph [splines=polyline]; a->b->c->d->e; a->e; }';

it('smode splits the L5 long edge: duplicate straight-middle points at corridor x', () => {
  const pts = pathPoints(edgePath(renderSvg(L5, 'dot'), 'a', 'f'));
  // straight_path appends two copies of the last point → ≥1 consecutive dup pair
  expect(duplicatePairs(pts)).toBeGreaterThanOrEqual(1);
  // the duplicated middle pins to the corridor x (the spline reaches it, not a bow)
  const dup = pts.find((p, i) => i > 0 && p.x === pts[i - 1].x && p.y === pts[i - 1].y)!;
  const maxX = Math.max(...pts.map((p) => p.x));
  expect(dup.x).toBe(maxX);
});

it('L4 stays below threshold: single spline, no straight-middle duplicates', () => {
  const pts = pathPoints(edgePath(renderSvg(L4, 'dot'), 'a', 'e'));
  expect(duplicatePairs(pts)).toBe(0);
});

it('L3 stays below threshold: single spline, no straight-middle duplicates', () => {
  const pts = pathPoints(edgePath(renderSvg(L3, 'dot'), 'a', 'd'));
  expect(duplicatePairs(pts)).toBe(0);
});

it('L5 long-edge spline byte-matches the canonical oracle geometry', () => {
  // Pinned from GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot (15.1.0).
  const oracle =
    'M59.53,-360.16C67.69,-333.79 82,-280.98 82,-235 82,-235 82,-235 82,-161 '
    + '82,-120.59 70.95,-74.9 62.73,-46.52';
  expect(edgePath(renderSvg(L5, 'dot'), 'a', 'f')).toBe(oracle);
});

// ---------------------------------------------------------------------------
// splines=polyline (EDGETYPE_PLINE): smode dispatches per-segment via
// routepolylines (make_regular_edge !is_spline branch). The shared chain
// router gives polyline the same corridor-hugging segmentation as spline.
// ---------------------------------------------------------------------------

it('smode segments a polyline long edge with a corridor-pinned straight middle', () => {
  const pts = pathPoints(edgePath(renderSvg(POLY_L5, 'dot'), 'a', 'f'));
  expect(duplicatePairs(pts)).toBeGreaterThanOrEqual(1);
  const dup = pts.find((p, i) => i > 0 && p.x === pts[i - 1].x && p.y === pts[i - 1].y)!;
  expect(dup.x).toBe(Math.max(...pts.map((p) => p.x)));
});

it('polyline L4 stays below threshold: single polyline byte-matches the oracle', () => {
  // Below threshold → one routepolylines call; the run hugs the bow x=63, not a
  // segmented corridor. (Polylines always encode straight runs as duplicate
  // control points, so the dup-pair heuristic cannot distinguish smode here —
  // the oracle byte-match is the authoritative below-threshold check.)
  const oracle =
    'M56.95,-287.65C59.57,-272.19 63,-252 63,-252 63,-252 63,-72 63,-72 63,-72 '
    + '60.99,-60.17 58.87,-47.68';
  expect(edgePath(renderSvg(POLY_L4, 'dot'), 'a', 'e')).toBe(oracle);
});

it('polyline L5 long edge byte-matches the canonical oracle geometry', () => {
  // Pinned from GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot (15.1.0).
  const oracle =
    'M57.38,-359.87C64.82,-322.1 82,-235 82,-235 82,-235 82,-235 82,-161 82,-161 '
    + '67.77,-88.84 59.6,-47.4';
  expect(edgePath(renderSvg(POLY_L5, 'dot'), 'a', 'f')).toBe(oracle);
});
