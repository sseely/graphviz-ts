// SPDX-License-Identifier: EPL-2.0

/**
 * Acceptance tests for the emit rendering dispatch layer (T24).
 *
 * AC1: parseStyle tokenises style strings correctly
 * AC2: findStopColor extracts gradient stop colors and fractions
 * AC3: bezierBb computes the correct midpoint-heuristic bounding box
 * AC4: emitGraph invokes Renderer callbacks in the correct order
 */

import { describe, it, expect, vi } from 'vitest';
import { parseStyle, findStopColor } from './emit-style.js';
import { bezierBb } from './emit-bb.js';
import { emitGraph, makeRenderJob } from './emit.js';
import type { Renderer, RenderJob, TextSpan } from './emit-types.js';
import type { Point, Bezier } from '../model/geom.js';
import { Graph as GraphClass } from '../model/graph.js';
import { Node } from '../model/node.js';
import { Edge } from '../model/edge.js';
import { makeNodeInfo } from '../model/nodeInfo.js';
import { makePort, makeEdgeInfo } from '../model/edgeInfo.js';

// ---------------------------------------------------------------------------
// Helpers shared across test groups
// ---------------------------------------------------------------------------

function makeBezier(list: Point[]): Bezier {
  return { list, size: list.length, sflag: 0, eflag: 0,
    sp: { x: 0, y: 0 }, ep: { x: 0, y: 0 } };
}

function makeRecordingRenderer(): { renderer: Renderer; calls: string[] } {
  const calls: string[] = [];
  const push = (name: string) => () => { calls.push(name); };
  const renderer: Renderer = {
    beginGraph: vi.fn(push('beginGraph')),
    endGraph: vi.fn(push('endGraph')),
    beginCluster: vi.fn(push('beginCluster')),
    endCluster: vi.fn(push('endCluster')),
    beginNode: vi.fn(push('beginNode')),
    endNode: vi.fn(push('endNode')),
    beginEdge: vi.fn(push('beginEdge')),
    endEdge: vi.fn(push('endEdge')),
    textspan: vi.fn((_p: Point, _s: TextSpan, _j: RenderJob) => { calls.push('textspan'); }),
    ellipse: vi.fn(push('ellipse')),
    polygon: vi.fn(push('polygon')),
    bezier: vi.fn(push('bezier')),
    polyline: vi.fn(push('polyline')),
    fillColor: vi.fn(push('fillColor')),
    penColor: vi.fn(push('penColor')),
    font: vi.fn(push('font')),
    style: vi.fn(push('style')),
  };
  return { renderer, calls };
}

// ---------------------------------------------------------------------------
// AC1-a — parseStyle basic tokens
// ---------------------------------------------------------------------------

describe('AC1-a: parseStyle basic tokens', () => {
  it('returns empty array for empty string', () => {
    expect(parseStyle('')).toEqual([]);
  });
  it('splits space-separated tokens', () => {
    expect(parseStyle('filled dashed')).toEqual(['filled', 'dashed']);
  });
  it('keeps parenthesised arg attached to preceding token', () => {
    expect(parseStyle('setlinewidth(2)')).toEqual(['setlinewidth(2)']);
  });
  it('handles mixed tokens and function calls', () => {
    expect(parseStyle('dashed setlinewidth(3)')).toEqual(['dashed', 'setlinewidth(3)']);
  });
});

// ---------------------------------------------------------------------------
// AC1-b — parseStyle error cases
// ---------------------------------------------------------------------------

describe('AC1-b: parseStyle error cases', () => {
  it('returns null on unmatched open paren', () => {
    expect(parseStyle('setlinewidth(2')).toBeNull();
  });
  it('returns null on unmatched close paren', () => {
    expect(parseStyle('foo)')).toBeNull();
  });
  it('returns null on nested parens', () => {
    expect(parseStyle('foo(bar(baz))')).toBeNull();
  });
  it('strips surrounding whitespace from tokens', () => {
    expect(parseStyle('  filled ,  dashed  ')).toEqual(['filled', 'dashed']);
  });
});

// ---------------------------------------------------------------------------
// AC2-a — findStopColor basic cases
// ---------------------------------------------------------------------------

describe('AC2-a: findStopColor basic cases', () => {
  it('returns false for single-color string', () => {
    const clrs: [string | null, string | null] = [null, null];
    expect(findStopColor('blue', clrs, { value: 0 })).toBe(false);
  });
  it('returns true and fills clrs for two-color string', () => {
    const clrs: [string | null, string | null] = [null, null];
    const result = findStopColor('red:blue', clrs, { value: 0 });
    expect(result).toBe(true);
    expect(clrs[0]).toBe('red');
    expect(clrs[1]).toBe('blue');
  });
  it('returns false when colorlist is empty', () => {
    const clrs: [string | null, string | null] = [null, null];
    expect(findStopColor('', clrs, { value: 0 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC2-b — findStopColor gradient fractions
// ---------------------------------------------------------------------------

describe('AC2-b: findStopColor gradient fractions', () => {
  it('extracts explicit stop fraction from first color', () => {
    const clrs: [string | null, string | null] = [null, null];
    const frac = { value: 0 };
    findStopColor('red;0.3:blue', clrs, frac);
    expect(frac.value).toBeCloseTo(0.3, 10);
  });
  it('derives fraction from second-color complement', () => {
    const clrs: [string | null, string | null] = [null, null];
    const frac = { value: 0 };
    findStopColor('red:blue;0.4', clrs, frac);
    expect(frac.value).toBeCloseTo(0.6, 5);
  });
});

// ---------------------------------------------------------------------------
// AC3-a — bezierBb degenerate cases
// ---------------------------------------------------------------------------

describe('AC3-a: bezierBb degenerate cases', () => {
  it('returns zero box for empty list', () => {
    const bz = makeBezier([]);
    expect(bezierBb(bz)).toEqual({ ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } });
  });
  it('seeds box from single point', () => {
    const bz = makeBezier([{ x: 3, y: 7 }]);
    expect(bezierBb(bz)).toEqual({ ll: { x: 3, y: 7 }, ur: { x: 3, y: 7 } });
  });
});

// ---------------------------------------------------------------------------
// AC3-b — bezierBb midpoint heuristic
// ---------------------------------------------------------------------------

describe('AC3-b: bezierBb midpoint heuristic', () => {
  it('expands box to include midpoints and anchor points', () => {
    const bz = makeBezier([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
    ]);
    const bb = bezierBb(bz);
    expect(bb.ll.x).toBeLessThanOrEqual(0);
    expect(bb.ll.y).toBeLessThanOrEqual(0);
    expect(bb.ur.x).toBeGreaterThanOrEqual(10);
    expect(bb.ur.y).toBeGreaterThanOrEqual(10);
  });
  it('mid of p1=(10,0) and p2=(10,10) contributes (10,5) to box', () => {
    const bz = makeBezier([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 5, y: 5 },
    ]);
    const bb = bezierBb(bz);
    expect(bb.ur.x).toBe(10);
    expect(bb.ur.y).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// AC4-a — emitGraph outer lifecycle
// ---------------------------------------------------------------------------

describe('AC4-a: emitGraph outer lifecycle', () => {
  it('calls beginGraph before endGraph on empty graph', () => {
    const g = new GraphClass('G', 'directed');
    const { renderer, calls } = makeRecordingRenderer();
    emitGraph(g, makeRenderJob(g, renderer));
    expect(calls[0]).toBe('beginGraph');
    expect(calls[calls.length - 1]).toBe('endGraph');
  });
  it('sets default pen and fill colors during page setup', () => {
    const g = new GraphClass('G', 'directed');
    const { renderer } = makeRecordingRenderer();
    const job = makeRenderJob(g, renderer);
    emitGraph(g, job);
    expect(renderer.penColor).toHaveBeenCalledWith('black', job);
    expect(renderer.fillColor).toHaveBeenCalledWith('lightgrey', job);
  });
});

// ---------------------------------------------------------------------------
// AC4-b — emitGraph node rendering
// ---------------------------------------------------------------------------

describe('AC4-b: emitGraph node rendering', () => {
  it('calls beginNode/endNode and codefn for a shaped node', () => {
    const g = new GraphClass('G', 'directed');
    const codefnCalls: string[] = [];
    const n = new Node(1, 'n1', g);
    n.info = makeNodeInfo();
    g.nodes.set('n1', n);
    (n.info as unknown as Record<string, unknown>).shape = {
      name: 'ellipse', polygon: null, usershape: false,
      fns: {
        codefn: () => { codefnCalls.push('codefn'); },
        initFn: null, freeFn: null, pboxFn: null, insidefn: null, shapefn: null,
      },
    };
    const { renderer, calls } = makeRecordingRenderer();
    emitGraph(g, makeRenderJob(g, renderer));
    const s = calls.indexOf('beginNode');
    const e = calls.indexOf('endNode');
    expect(s).toBeGreaterThanOrEqual(0);
    expect(e).toBeGreaterThan(s);
    expect(codefnCalls).toEqual(['codefn']);
  });
});

// ---------------------------------------------------------------------------
// AC4-c — emitGraph edge rendering
// ---------------------------------------------------------------------------

describe('AC4-c: emitGraph edge rendering', () => {
  it('calls beginEdge/endEdge and bezier for a splined edge', () => {
    const g = new GraphClass('G', 'directed');
    const n1 = new Node(1, 'n1', g);
    n1.info = makeNodeInfo();
    const n2 = new Node(2, 'n2', g);
    n2.info = makeNodeInfo();
    g.nodes.set('n1', n1);
    g.nodes.set('n2', n2);
    const e = new Edge(n1, n2, 'e1');
    e.info = makeEdgeInfo(makePort(), makePort());
    g.edges.push(e);
    const bz = makeBezier([
      { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 5 },
    ]);
    (e.info as unknown as Record<string, unknown>).spl = {
      list: [bz], size: 1,
      bb: { ll: { x: 0, y: 0 }, ur: { x: 10, y: 5 } },
    };
    const { renderer, calls } = makeRecordingRenderer();
    emitGraph(g, makeRenderJob(g, renderer));
    const s = calls.indexOf('beginEdge');
    const end = calls.indexOf('endEdge');
    expect(s).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(s);
    expect(renderer.bezier).toHaveBeenCalled();
  });
});
