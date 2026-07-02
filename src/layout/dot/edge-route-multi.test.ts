// SPDX-License-Identifier: EPL-2.0

/**
 * T2/T3 — oracle-pinned geometry for multi-edge / opposing / labeled-parallel
 * regular-edge routing (mission dot-edge-multi, G1).
 *
 * The new cases route through the faithful pipeline per AD-2; plain single edges
 * keep the simplified fitter (the 115 goldens stay conformant). Values are
 * captured from the built dot (`~/git/graphviz/build/cmd/dot/dot`,
 * `GVBINDIR=/tmp/gvplugins`, 15.x) via `.probes/probe-t2-gap.ts`, 2026-06-16.
 *
 * Coordinates are in the SVG frame (y negated from graphviz-internal y-up).
 * Tolerance 0.5pt (AD-3): the faithful fitter is numerically close to but not
 * conformant with C's routesplines (Proutespline renormalization + libm).
 *
 * Quarantined (AD-4, see comparisons/labeled-parallel.html):
 *  - labeled-parallel edge "2" path: dot collapses it to a straight 4-point line
 *    via the straight-run optimisation (smode, dotsplines.c:1773-1834), not
 *    ported; TS routes a ~0.8pt-right 10-point near-straight spline.
 *  - labeled-parallel label x-positions diverge (position-phase label-vnode
 *    x-assignment, outside this mission's write-set).
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

const TOL = 0.5;

/** dot 15.x control points for `digraph{a->b;a->b;a->b}` (SVG frame). */
const DOT_PARALLEL_X3: Pt[][] = [
  [{ x: 15.56, y: -73.46 }, { x: 13.63, y: -65.31 }, { x: 13.05, y: -55.08 }, { x: 13.84, y: -45.7 }],
  [{ x: 27, y: -71.7 }, { x: 27, y: -64.41 }, { x: 27, y: -55.73 }, { x: 27, y: -47.54 }],
  [{ x: 38.44, y: -73.46 }, { x: 40.37, y: -65.31 }, { x: 40.95, y: -55.08 }, { x: 40.16, y: -45.7 }],
];

/** dot 15.x control points for `digraph{a->b; b->a}` — opposing pair, offset
 * to opposite sides of centre (a->b left, b->a right). */
const DOT_OPPOSING: Pt[][] = [
  [{ x: 21.12, y: -72.05 }, { x: 20.33, y: -64.57 }, { x: 20.08, y: -55.58 }, { x: 20.37, y: -47.14 }],
  [{ x: 32.86, y: -35.79 }, { x: 33.66, y: -43.25 }, { x: 33.92, y: -52.24 }, { x: 33.64, y: -60.69 }],
];

/** dot 15.x control points for `digraph{x->b; a->b; b->a}` — a 2-cycle whose
 * REVERSED member (`a->b`, smaller seq: x->b's path into b makes the DFS
 * traverse b->a first) must still take the RIGHT lane: C assigns Multisep
 * lanes in edgecmp collected order (MAINGRAPH forward rep first, AUXGRAPH
 * reversed member second), never by original creation seq.
 * @see lib/dotgen/dotsplines.c:419, make_regular_edge (cnt>1) — NaN residual */
const DOT_OPPOSING_REVERSED_FIRST: Record<string, Pt[]> = {
  'b->a': [{ x: 21.12, y: -72.05 }, { x: 20.33, y: -64.57 }, { x: 20.08, y: -55.58 }, { x: 20.37, y: -47.14 }],
  'a->b': [{ x: 32.86, y: -35.79 }, { x: 33.66, y: -43.25 }, { x: 33.92, y: -52.24 }, { x: 33.64, y: -60.69 }],
};

/** dot 15.x control points for the labeled edge "1" (bends around its label). */
const DOT_LABELED_EDGE1: Pt[] = [
  { x: 20.13, y: -88.69 }, { x: 18.14, y: -83.01 }, { x: 16.24, y: -76.57 },
  { x: 15.25, y: -70.5 }, { x: 14.07, y: -63.26 }, { x: 14.07, y: -61.24 },
  { x: 15.25, y: -54 }, { x: 15.64, y: -51.63 }, { x: 16.16, y: -49.2 },
  { x: 16.78, y: -46.78 },
];

describe('regular multi-edge routing (G1, dot oracle)', () => {
  it('parallel-x3 stays conformant to dot (no regression)', () => {
    const paths = edgePaths(renderSvg('digraph{a->b;a->b;a->b}', 'dot'));
    expect(paths.length).toBe(3);
    for (let i = 0; i < 3; i++) expect(maxDelta(paths[i], DOT_PARALLEL_X3[i])).toBeLessThanOrEqual(TOL);
  });

  it('opposing a->b / b->a offset to opposite sides (matches dot)', () => {
    const paths = edgePaths(renderSvg('digraph{a->b; b->a}', 'dot'));
    expect(paths.length).toBe(2);
    for (let i = 0; i < 2; i++) expect(maxDelta(paths[i], DOT_OPPOSING[i])).toBeLessThanOrEqual(TOL);
  });

  it('2-cycle lanes follow collected order, not creation seq (matches dot)', () => {
    // `a->b` is declared before `b->a` but is the REVERSED member (x->b pulls
    // the DFS through b first); it must take the right lane while forward
    // `b->a` takes lane 0. Guards the NaN edge-endpoint mechanism.
    const svg = renderSvg('digraph{x->b; a->b; b->a}', 'dot');
    for (const [title, want] of Object.entries(DOT_OPPOSING_REVERSED_FIRST)) {
      const [t, h] = title.split('->');
      const re = new RegExp(
        '<title>' + t + '&#45;&gt;' + h + '</title>\\s*<path[^>]*\\sd=' + Q + '([^' + Q + ']+)' + Q);
      const m = re.exec(svg);
      expect(m, `edge ${title} missing`).not.toBeNull();
      const nums = (m![1].match(RE_NUM) ?? []).map(Number);
      const pts: Pt[] = [];
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
      expect(maxDelta(pts, want)).toBeLessThanOrEqual(TOL);
    }
  });

  it('labeled-parallel edge "1" routes around its label vnode (matches dot)', () => {
    const paths = edgePaths(renderSvg('digraph{a->b[label="1"]; a->b[label="2"]}', 'dot'));
    expect(paths.length).toBe(2);
    expect(maxDelta(paths[0], DOT_LABELED_EDGE1)).toBeLessThanOrEqual(TOL);
  });

  it('labeled-parallel emits both label texts', () => {
    const svg = renderSvg('digraph{a->b[label="1"]; a->b[label="2"]}', 'dot');
    const texts = svg.match(new RegExp('<text', 'g')) ?? [];
    expect(texts.length).toBe(4); // a, b, "1", "2"
    expect(svg).toContain('>1</text>');
    expect(svg).toContain('>2</text>');
  });
});

describe('lost-edge failure semantics (1332 T3)', () => {
  it('healthy graphs emit every edge and no lost-edge warnings', () => {
    // The routesplines-failure path (C: warning + no spline + edge skipped)
    // must never trigger on routable graphs. Guards against the lost-edge
    // marking leaking into the decline/fallback path.
    const warnings: string[] = [];
    const orig = console.warn;
    console.warn = (msg?: unknown) => { warnings.push(String(msg)); };
    try {
      const svg = renderSvg(
        'digraph{a->b; b->a; a->c; c->d[label="x"]; b->d; {rank=same; b c} b->c;}',
        'dot');
      const edgeGroups = svg.match(new RegExp('class=' + Q + 'edge' + Q, 'g')) ?? [];
      expect(edgeGroups.length).toBe(6);
    } finally {
      console.warn = orig;
    }
    expect(warnings.filter(w => w.includes('lost') || w.includes('Pshortestpath'))).toEqual([]);
  });
});
