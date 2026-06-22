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
import { parse } from '../../parser/index.js';
import { GvcContext } from '../../gvc/context.js';
import { createMeasurer } from '../../common/textmeasure-factory.js';
import { DOT_LAYOUT_ENGINE } from './index.js';
import { routeOneEdge } from './edge-route.js';
import type { Edge as GraphEdge } from '../../model/edge.js';
import type { Graph } from '../../model/graph.js';

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

/** The edge `<path>` whose `<title>` matches `a->b` (the SVG entity form). */
function edgePathByTitle(svg: string, tail: string, head: string): Pt[] {
  const re = new RegExp(
    '<title>' + tail + '&#45;&gt;' + head + '</title>\\s*<path[^>]*\\sd=' + Q + '([^' + Q + ']+)' + Q,
  );
  const m = svg.match(re);
  const nums = (m?.[1].match(RE_NUM) ?? []).map(Number);
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  return pts;
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

/** dot 15.x control points for the 3-rank span a->d in `a->b->c->d; a->d`. */
const DOT_LONGSPAN_AD: Pt[] = [
  { x: 57.65, y: -215.91 }, { x: 59.68, y: -205.57 }, { x: 61.98, y: -192.09 },
  { x: 63, y: -180 }, { x: 67.03, y: -132.17 }, { x: 67.03, y: -119.83 },
  { x: 63, y: -72 }, { x: 62.32, y: -63.97 }, { x: 61.08, y: -55.33 }, { x: 59.73, y: -47.4 },
];

/** dot 15.x control points for the 4-rank span a->e in `a->b->c->d->e; a->e`. */
const DOT_SPAN4_AE: Pt[] = [
  { x: 57.65, y: -287.91 }, { x: 59.68, y: -277.57 }, { x: 61.98, y: -264.09 },
  { x: 63, y: -252 }, { x: 69.72, y: -172.28 }, { x: 69.72, y: -151.72 },
  { x: 63, y: -72 }, { x: 62.32, y: -63.97 }, { x: 61.08, y: -55.33 }, { x: 59.73, y: -47.4 },
];

describe('T3: multi-rank forward chains via faithful pathplan (dot oracle)', () => {
  it('3-rank long-span a->d bends around the b-c-d chain (matches dot)', () => {
    const ad = edgePathByTitle(renderSvg('digraph{a->b->c->d; a->d}', 'dot'), 'a', 'd');
    expect(ad.length).toBe(DOT_LONGSPAN_AD.length); // 10-pt bending spline, not a stub
    expect(maxDelta(ad, DOT_LONGSPAN_AD)).toBeLessThanOrEqual(TOL);
  });

  it('4-rank span a->e bends around the chain (matches dot)', () => {
    const ae = edgePathByTitle(renderSvg('digraph{a->b->c->d->e; a->e}', 'dot'), 'a', 'e');
    expect(ae.length).toBe(DOT_SPAN4_AE.length);
    expect(maxDelta(ae, DOT_SPAN4_AE)).toBeLessThanOrEqual(TOL);
  });
});

/** dot 15.x control points for the back edge c->a in `a->b->c; c->a` (SVG frame). */
const DOT_BACKEDGE_CA: Pt[] = [
  { x: 57.65, y: -36.09 }, { x: 59.68, y: -46.43 }, { x: 61.98, y: -59.91 },
  { x: 63, y: -72 }, { x: 64.34, y: -87.94 }, { x: 64.34, y: -92.06 },
  { x: 63, y: -108 }, { x: 62.32, y: -116.03 }, { x: 61.08, y: -124.67 }, { x: 59.73, y: -132.6 },
];

/** dot 15.x control points for the dir=both edge a->b. */
const DOT_DIRBOTH_AB: Pt[] = [
  { x: 27, y: -60.24 }, { x: 27, y: -56.01 }, { x: 27, y: -51.66 }, { x: 27, y: -47.44 },
];

describe('T4: back + non-forward edges via faithful pathplan (dot oracle)', () => {
  it('multi-rank back edge c->a bends back around the chain (matches dot)', () => {
    const ca = edgePathByTitle(renderSvg('digraph{a->b->c; c->a}', 'dot'), 'c', 'a');
    expect(ca.length).toBe(DOT_BACKEDGE_CA.length); // 10-pt bending spline
    expect(maxDelta(ca, DOT_BACKEDGE_CA)).toBeLessThanOrEqual(TOL);
  });

  it('dir=both edge a->b matches dot and renders both arrowheads', () => {
    const svg = renderSvg('digraph{a->b[dir=both]}', 'dot');
    const ab = edgePathByTitle(svg, 'a', 'b');
    expect(maxDelta(ab, DOT_DIRBOTH_AB)).toBeLessThanOrEqual(TOL);
    // both ends arrowed: two black arrowhead polygons (head + tail; the only
    // other polygon is the white background, and nodes are ellipses).
    expect((svg.match(new RegExp('<polygon fill="black"', 'g')) ?? []).length).toBe(2);
  });
});

/** dot 15.x control points under rankdir (SVG frame). The faithful path routes
 * in the rotated frame (poly_inside ccwrotatepf + GD_flip), matching dot
 * exactly — these were the corpus's worst divergences (LR long ~10pt, LR fan
 * outer-edge collapse) before the migration. */
const DOT_LR_LONG_AD: Pt[] = [
  { x: 54.23, y: -15.93 }, { x: 65.26, y: -15.16 }, { x: 78.25, y: -14.38 },
  { x: 90, y: -14 }, { x: 153.97, y: -11.94 }, { x: 170.03, y: -11.94 },
  { x: 234, y: -14 }, { x: 241.9, y: -14.25 }, { x: 250.35, y: -14.69 }, { x: 258.39, y: -15.18 },
];
const DOT_LR_FAN_AF: Pt[] = [
  { x: 39.6, y: -109.75 }, { x: 51.69, y: -93.09 }, { x: 71.42, y: -66.62 },
  { x: 90, y: -45 }, { x: 91.09, y: -43.74 }, { x: 92.22, y: -42.45 }, { x: 93.37, y: -41.17 },
];
const DOT_BT_CHAIN_AB: Pt[] = [
  { x: 27, y: -36.3 }, { x: 27, y: -43.59 }, { x: 27, y: -52.27 }, { x: 27, y: -60.46 },
];

describe('T5: rankdir=LR/RL/BT regular edges via faithful pathplan (dot oracle)', () => {
  it('rankdir=LR 3-rank long-span a->d matches dot (was ~10pt off)', () => {
    const ad = edgePathByTitle(renderSvg('digraph{rankdir=LR; a->b->c->d; a->d}', 'dot'), 'a', 'd');
    expect(ad.length).toBe(DOT_LR_LONG_AD.length);
    expect(maxDelta(ad, DOT_LR_LONG_AD)).toBeLessThanOrEqual(TOL);
  });

  it('rankdir=LR wide fan outer edge a->f matches dot (was a collapsed stub)', () => {
    const af = edgePathByTitle(renderSvg('digraph{rankdir=LR; a->b;a->c;a->d;a->e;a->f}', 'dot'), 'a', 'f');
    expect(maxDelta(af, DOT_LR_FAN_AF)).toBeLessThanOrEqual(TOL);
    expect(span(af)).toBeGreaterThan(10); // not a degenerate stub
  });

  it('rankdir=BT chain edge a->b matches dot', () => {
    const ab = edgePathByTitle(renderSvg('digraph{rankdir=BT; a->b->c}', 'dot'), 'a', 'b');
    expect(maxDelta(ab, DOT_BT_CHAIN_AB)).toBeLessThanOrEqual(TOL);
  });
});

// ---------------------------------------------------------------------------
// T1 (DOT-1b) — faithful adjacent back edge via makefwdedge.
//
// A lone adjacent back edge never reaches the single-edge router in a normal
// render: dot/the TS group router always claims an opposing pair (`a->b; b->a`)
// as a parallel group (routeParallelEdgeGroup, T3). To exercise the single-edge
// faithful path here we bypass the group path: lay out the opposing pair to
// maxphase=3 (ranks + coords, no splines), then route b->a directly via
// routeOneEdge — which now dispatches to the makefwdedge path (AD-1).
//
// The geometry of a centred bottom→top arrow-at-top adjacent edge is exactly
// dot's rankdir=BT a->b (DOT_BT_CHAIN_AB above): the same 72pt gap, x=27,
// arrow at the top node. SVG_y = -internal_y for this 2-node graph (node
// centres a@90→-90, b@18→-18 confirm pure negation, no translate).
// ---------------------------------------------------------------------------

/** Lay out `src` to maxphase=3 (ranks + coords, before spline routing). */
function layoutToPosition(src: string): Graph {
  const g = parse(src);
  const ctx = new GvcContext(createMeasurer());
  ctx.register(DOT_LAYOUT_ENGINE);
  ctx.layout(g, 'dot');
  return g;
}

/** Find the edge tail->head among g's out-edges, or undefined. */
function findEdge(g: Graph, tail: string, head: string): GraphEdge | undefined {
  for (const n of g.nodes.values()) {
    for (const e of n.outEdges(g)) {
      if (e.tail.name === tail && e.head.name === head) return e;
    }
  }
  return undefined;
}

/** Installed spline control points in the SVG frame (y negated). */
function splineSvgPts(e: GraphEdge): Pt[] {
  const spl = e.info.spl!;
  return spl.list.flatMap(bz => bz.list).map(p => ({ x: p.x, y: -p.y }));
}

/** The single arrowhead polygon stashed on e (head or tail slot), SVG frame. */
function arrowPts(e: GraphEdge): Pt[] | undefined {
  const ops = e.info.headArrowOps ?? e.info.tailArrowOps;
  const poly = ops?.find(o => o.kind === 'polygon');
  return poly?.kind === 'polygon' ? poly.points.map(p => ({ x: p.x, y: -p.y })) : undefined;
}

describe('T1 (DOT-1b): faithful adjacent back edge via makefwdedge (dot oracle)', () => {
  it('b->a routes through the faithful single-edge path with the arrow at a', () => {
    const g = layoutToPosition('digraph{maxphase=3; a->b; b->a}');
    const ba = findEdge(g, 'b', 'a');
    expect(ba).toBeDefined();
    routeOneEdge(ba!, g);
    const pts = splineSvgPts(ba!);
    // Same geometry as dot's rankdir=BT a->b: centred, arrow at the top node.
    expect(pts.length).toBe(DOT_BT_CHAIN_AB.length);
    expect(maxDelta(pts, DOT_BT_CHAIN_AB)).toBeLessThanOrEqual(TOL);
    // Arrowhead emitted at a (top node, SVG y ~ -70, near a's lower boundary).
    const arr = arrowPts(ba!);
    expect(arr).toBeDefined();
    const tipY = Math.min(...arr!.map(p => p.y)); // most-negative = nearest a
    expect(tipY).toBeLessThan(-66);
  });

  it('the forward partner a->b still matches the lone-edge dot oracle', () => {
    const g = layoutToPosition('digraph{maxphase=3; a->b; b->a}');
    const ab = findEdge(g, 'a', 'b');
    expect(ab).toBeDefined();
    routeOneEdge(ab!, g);
    // Lone `digraph{a->b}` dot 15.x: M27,-71.7 C27,-64.41 27,-55.73 27,-47.54.
    const oracle: Pt[] = [
      { x: 27, y: -71.7 }, { x: 27, y: -64.41 }, { x: 27, y: -55.73 }, { x: 27, y: -47.54 },
    ];
    expect(maxDelta(splineSvgPts(ab!), oracle)).toBeLessThanOrEqual(TOL);
  });
});

// ---------------------------------------------------------------------------
// T3 (DOT-1b) — parallel/opposing group routing via the faithful pipeline.
//
// routeParallelEdgeGroup now routes the shared base via routeRegularEdgeFaithful
// and installs each member with clip_and_install (no fitter). Back members
// install through makefwdedge and are reversed to tail→head (AD-2). These pins
// go through the full render pipeline (the group router owns these cases).
// ---------------------------------------------------------------------------

/** dot 15.x for `digraph{a->b; b->a}` — opposing pair, offset to opposite sides. */
const DOT_T3_OPPOSING: Pt[][] = [
  [{ x: 21.12, y: -72.05 }, { x: 20.33, y: -64.57 }, { x: 20.08, y: -55.58 }, { x: 20.37, y: -47.14 }],
  [{ x: 32.86, y: -35.79 }, { x: 33.66, y: -43.25 }, { x: 33.92, y: -52.24 }, { x: 33.64, y: -60.69 }],
];

/** dot 15.x for `digraph{a->b;a->b;a->b}` — 3 parallel forward edges, offset. */
const DOT_T3_PARALLEL_X3: Pt[][] = [
  [{ x: 15.56, y: -73.46 }, { x: 13.63, y: -65.31 }, { x: 13.05, y: -55.08 }, { x: 13.84, y: -45.7 }],
  [{ x: 27, y: -71.7 }, { x: 27, y: -64.41 }, { x: 27, y: -55.73 }, { x: 27, y: -47.54 }],
  [{ x: 38.44, y: -73.46 }, { x: 40.37, y: -65.31 }, { x: 40.95, y: -55.08 }, { x: 40.16, y: -45.7 }],
];

describe('T3 (DOT-1b): parallel/opposing groups via faithful pathplan (dot oracle)', () => {
  it('opposing a->b / b->a offset to opposite sides, back member reversed', () => {
    const paths = edgePaths(renderSvg('digraph{a->b; b->a}', 'dot'));
    expect(paths.length).toBe(2);
    for (let i = 0; i < 2; i++) expect(maxDelta(paths[i], DOT_T3_OPPOSING[i])).toBeLessThanOrEqual(TOL);
  });

  it('three parallel a->b edges fan out with Multisep offsets (matches dot)', () => {
    const paths = edgePaths(renderSvg('digraph{a->b;a->b;a->b}', 'dot'));
    expect(paths.length).toBe(3);
    for (let i = 0; i < 3; i++) expect(maxDelta(paths[i], DOT_T3_PARALLEL_X3[i])).toBeLessThanOrEqual(TOL);
  });
});
