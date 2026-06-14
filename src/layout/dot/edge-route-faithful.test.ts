// SPDX-License-Identifier: EPL-2.0

/**
 * SR2 — first assembly and exercise of the faithful box-channel pipeline for
 * dot regular adjacent-rank edges (`beginPath → completeRegularPath →
 * routeSplines`). The simplified active fitter truncates the non-monotonic
 * loop corridor a steering port needs (e.g. `A:n->B`: the tail exits the TOP
 * face while the head is below); routeSplines routes it completely.
 *
 * These assertions check completeness and topology in graphviz-internal y-up
 * coordinates (the frame the router runs in; SVG y-negation is a later render
 * pass). Exact per-control-point oracle validation against dot 15.0.0 is SR4.
 *
 * The layout is stopped at maxphase=3 (after dotPosition, before dotSplines)
 * so coordinates and ranks are assigned but the edge is unrouted. A
 * GvcContext with a text measurer is required so common_init_edge resolves the
 * compass ports onto e.info.tail_port / head_port.
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge
 * @see plans/parity-steering-port-routing/batch-1/SR1-findings.md
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/index.js';
import { GvcContext } from '../../gvc/context.js';
import { createMeasurer } from '../../common/textmeasure-factory.js';
import type { Graph } from '../../model/graph.js';
import type { Edge } from '../../model/edge.js';
import type { Point } from '../../model/geom.js';
import { DOT_LAYOUT_ENGINE } from './index.js';
import { routeRegularEdgeFaithful } from './edge-route-faithful.js';

/** Lay out `src` through position only (maxphase=3) and return the graph. */
function layoutToPosition(src: string): Graph {
  const g = parse(src);
  g.attrs.set('maxphase', '3'); // stop after dotPosition, before dotSplines
  const ctx = new GvcContext(createMeasurer());
  ctx.register(DOT_LAYOUT_ENGINE);
  ctx.layout(g, 'dot');
  return g;
}

/** Route the first edge of `src` through the faithful pipeline. */
function routeFirstEdge(src: string): Point[] | null {
  const g = layoutToPosition(src);
  const e: Edge = g.edges[0]!;
  return routeRegularEdgeFaithful(g, e);
}

const MAX_Y = (pts: Point[]): number => Math.max(...pts.map(p => p.y));
const MIN_Y = (pts: Point[]): number => Math.min(...pts.map(p => p.y));
const MAX_X = (pts: Point[]): number => Math.max(...pts.map(p => p.x));

describe('faithful router — A:n->B loop corridor (the T6b truncation case)', () => {
  // A is the top rank node at coord (27,90); its TOP face is y=108, the 'n'
  // port attaches at (27,108)+1. B sits below at (27,18). The spline must loop
  // UP and over (the simplified fitter truncates this to a 4-pt straight line).
  it('produces a complete (non-truncated) spline, not the 4-pt straight line', () => {
    const pts = routeFirstEdge('digraph{A:n->B}');
    expect(pts).not.toBeNull();
    // The truncated simplified fitter yields 4 control points; a routed loop
    // needs multiple cubic segments. SR1 PoC + C oracle both give 10.
    expect(pts!.length).toBeGreaterThanOrEqual(7);
  });

  it('attaches at the tail TOP port and loops above the tail node', () => {
    const pts = routeFirstEdge('digraph{A:n->B}')!;
    // Start at the 'n' port (27, 108) nudged +1 by beginpath → (27, 109).
    expect(Math.abs(pts[0].x - 27)).toBeLessThan(0.5);
    expect(Math.abs(pts[0].y - 109)).toBeLessThan(0.5);
    // Apex loops up, above both the port start (109) and the node top (108).
    expect(MAX_Y(pts)).toBeGreaterThan(115);
  });

  it('bulges right of the node face and descends to reach B', () => {
    const pts = routeFirstEdge('digraph{A:n->B}')!;
    // Tail node right face is x=54; the loop bulges out past it.
    expect(MAX_X(pts)).toBeGreaterThan(56);
    // Descends all the way down to B (head center is y=18; reaches ~19).
    expect(MIN_Y(pts)).toBeLessThan(40);
  });
});

describe('faithful router — opposing compass ports route sanely', () => {
  it('A:s->B:n is a complete spline from the tail bottom to the head top', () => {
    const pts = routeFirstEdge('digraph{A:s->B:n}');
    expect(pts).not.toBeNull();
    // 's' port at A bottom (27,72) → 'n' port at B top (27,36): vertical run.
    expect(Math.abs(pts![0].x - 27)).toBeLessThan(0.5);
    expect(Math.abs(pts![0].y - 72)).toBeLessThan(0.5);
    const end = pts![pts!.length - 1];
    expect(Math.abs(end.x - 27)).toBeLessThan(0.5);
    expect(Math.abs(end.y - 36)).toBeLessThan(0.5);
  });

  it('A:s->B:n descends monotonically (start above end, no truncation)', () => {
    const pts = routeFirstEdge('digraph{A:s->B:n}')!;
    expect(MAX_Y(pts)).toBeLessThanOrEqual(72 + 0.5);
    expect(MIN_Y(pts)).toBeGreaterThanOrEqual(36 - 0.5);
    expect(pts[0].y).toBeGreaterThan(pts[pts.length - 1].y);
  });
});

describe('faithful router — gate', () => {
  it('returns null for a non-adjacent-rank edge (out of SR2 scope)', () => {
    // A->C spans two ranks (A rank 0, C rank 2); the adjacent-rank guard
    // rejects it so the simplified router keeps handling multi-rank edges.
    const g = layoutToPosition('digraph{A->B->C; A->C}');
    const ac = g.edges.find(e => e.tail.name === 'A' && e.head.name === 'C')!;
    expect(routeRegularEdgeFaithful(g, ac)).toBeNull();
  });
});
