// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import {
  printNum,
  makeXbufs,
  xdotPoint,
  xdotFont,
  xdotPenColor,
  xdotFillColor,
  formatNodeAttrs,
  formatEdgePos,
  edgeConnector,
  isDirected,
  DotRenderer,
  XdotRenderer,
  createDotRenderer,
  createXdotRenderer,
} from './dot.js';
import { RenderJob } from '../gvc/job.js';
import { Graph } from '../model/graph.js';
import { Node } from '../model/node.js';
import { Edge } from '../model/edge.js';
import type { TextMeasurer } from '../common/textmeasure.js';

// ---------------------------------------------------------------------------
// Shared stubs
// ---------------------------------------------------------------------------

const measurer: TextMeasurer = { measure: () => ({ w: 0, h: 0 }) };

export function makeJob(): RenderJob {
  return new RenderJob('dot', measurer);
}

export function makeGraph(kind: 'directed' | 'undirected' = 'directed'): Graph {
  const g = new Graph('G', kind);
  g.info.bb = { ll: { x: 0, y: 0 }, ur: { x: 200, y: 100 } };
  return g;
}

export function makeNode(g: Graph): Node {
  const n = new Node(0, 'A', g);
  n.info.coord = { x: 50, y: 40 };
  n.info.width = 1.0;
  n.info.height = 0.5;
  return n;
}

// ---------------------------------------------------------------------------
// printNum test bodies
// ---------------------------------------------------------------------------

export function testPrintNumZero(): void {
  expect(printNum(0)).toBe('0');
  expect(printNum(-0)).toBe('0');
  expect(printNum(0.003)).toBe('0');
  expect(printNum(-0.003)).toBe('0');
}

export function testPrintNumLeadingDot(): void {
  expect(printNum(0.5)).toBe('.5');
  expect(printNum(-0.5)).toBe('-.5');
  expect(printNum(0.125)).toBe('.125');
}

export function testPrintNumInteger(): void {
  expect(printNum(1.0)).toBe('1');
  expect(printNum(100)).toBe('100');
  expect(printNum(-42)).toBe('-42');
}

export function testPrintNumTrailingZeros(): void {
  expect(printNum(1.5)).toBe('1.5');
  expect(printNum(1.50)).toBe('1.5');
  expect(printNum(1.500)).toBe('1.5');
}

export function testPrintNumClamp(): void {
  // MAX_NEGNUM = 999999999999999.99 rounds to 1e15 in IEEE 754
  expect(printNum(1e20)).toBe('1000000000000000');
  expect(printNum(-1e20)).toBe('-1000000000000000');
}

// ---------------------------------------------------------------------------
// makeXbufs aliasing test body
// ---------------------------------------------------------------------------

export function testXbufsAliasing(): void {
  const bufs = makeXbufs();
  // NDraw (8) aliases CDraw (1)
  bufs[1]!.push('x');
  expect(bufs[8]).toBe(bufs[1]);
  expect(bufs[8]![0]).toBe('x');
  // NLabel (10) aliases CLabel (5)
  bufs[5]!.push('y');
  expect(bufs[10]).toBe(bufs[5]);
}

// ---------------------------------------------------------------------------
// xdot helper test bodies
// ---------------------------------------------------------------------------

export function testXdotPoint(): void {
  // xdot is y-up: the layout coordinate passes through with no inversion.
  const p = { x: 10, y: 20 };
  expect(xdotPoint(p)).toBe('10 20 ');
}

export function testXdotFont(): void {
  // xdotFont(size, name) — the length prefix is the byte length of the name.
  expect(xdotFont(12, 'Helvetica')).toBe('F 12 9 -Helvetica ');
}

export function testXdotColors(): void {
  // Colors come from the resolved graphics state and emit canonical hex with a
  // constant length prefix (7 for #rrggbb), mirroring xdot_str_color_xbuf.
  expect(xdotPenColor({ type: 'string', s: 'red' })).toBe('c 7 -#ff0000 ');
  expect(xdotFillColor({ type: 'string', s: 'blue' })).toBe('C 7 -#0000ff ');
}

// ---------------------------------------------------------------------------
// formatNodeAttrs test body
// ---------------------------------------------------------------------------

export function testFormatNodeAttrs(): void {
  const g = makeGraph();
  const n = makeNode(g);
  const s = formatNodeAttrs(n);
  expect(s).toContain('pos="50,40"');
  expect(s).toContain('width=1');
  expect(s).toContain('height=.5');
}

// ---------------------------------------------------------------------------
// formatEdgePos test body
// ---------------------------------------------------------------------------

export function testFormatEdgePosEmpty(): void {
  const g = makeGraph();
  const e = new Edge(makeNode(g), makeNode(g), '');
  expect(formatEdgePos(e)).toBe('');
}

// ---------------------------------------------------------------------------
// edgeConnector / isDirected test bodies
// ---------------------------------------------------------------------------

export function testEdgeConnector(): void {
  expect(edgeConnector(true)).toBe('->');
  expect(edgeConnector(false)).toBe('--');
}

export function testIsDirected(): void {
  expect(isDirected(new Graph('G', 'directed'))).toBe(true);
  expect(isDirected(new Graph('G', 'strict-directed'))).toBe(true);
  expect(isDirected(new Graph('G', 'undirected'))).toBe(false);
  expect(isDirected(new Graph('G', 'strict-undirected'))).toBe(false);
}

// ---------------------------------------------------------------------------
// DotRenderer test bodies
// ---------------------------------------------------------------------------

export function testDotRendererFactory(): void {
  const r = createDotRenderer();
  expect(r.type).toBe('dot');
  expect(r.quality).toBe(0);
}

export function testDotBeginEndGraph(): void {
  const r = new DotRenderer();
  const job = makeJob();
  const g = makeGraph();
  r.beginGraph(g, job);
  r.endGraph(g, job);
  const out = job.output.join('');
  expect(out).toContain('digraph G {');
  expect(out).toContain('bb="0,0,200,100"');
  expect(out).toContain('}');
}

export function testDotEndNode(): void {
  const r = new DotRenderer();
  const job = makeJob();
  const g = makeGraph();
  r.endNode(makeNode(g), job);
  const out = job.output.join('');
  expect(out).toContain('A [');
  expect(out).toContain('pos="50,40"');
}

export function testDotEndEdge(): void {
  const r = new DotRenderer();
  const job = makeJob();
  const g = makeGraph();
  const e = new Edge(makeNode(g), makeNode(g), '');
  r.endEdge(e, job);
  expect(job.output.join('')).toContain('A -> A');
}

// ---------------------------------------------------------------------------
// XdotRenderer test bodies
// ---------------------------------------------------------------------------

export function testXdotRendererFactory(): void {
  const r = createXdotRenderer();
  expect(r.type).toBe('xdot');
  expect(r.quality).toBe(0);
}

export function testXdotBeginGraph(): void {
  // The xdot renderer serializes the whole graph at endGraph (agwrite-at-end),
  // so the header/xdotversion appear after begin+end, not during beginGraph.
  const r = new XdotRenderer();
  const job = makeJob();
  const g = makeGraph();
  r.beginGraph(g, job);
  r.endGraph(g, job);
  const out = job.output.join('');
  expect(out).toContain('digraph G {');
  expect(out).toContain('xdotversion="1.7"');
  expect(out).toContain('bb="0,0,200,100"');
}

// ---------------------------------------------------------------------------
// describe / it registrations
// ---------------------------------------------------------------------------

describe('printNum', () => {
  it('near-zero values become "0"', testPrintNumZero);
  it('leading zero collapses to "."', testPrintNumLeadingDot);
  it('integers strip decimal point', testPrintNumInteger);
  it('trailing zeros stripped', testPrintNumTrailingZeros);
  it('clamps to MAX_NEGNUM', testPrintNumClamp);
});

describe('makeXbufs', () => {
  it('indices 8/9 alias 1; 10/11 alias 5', testXbufsAliasing);
});

describe('xdot helpers', () => {
  it('xdotPoint is y-up (no inversion)', testXdotPoint);
  it('xdotFont formats font preamble', testXdotFont);
  it('color ops format correctly', testXdotColors);
});

describe('formatNodeAttrs', () => {
  it('includes pos/width/height', testFormatNodeAttrs);
});

describe('formatEdgePos', () => {
  it('returns empty string when no spline', testFormatEdgePosEmpty);
});

describe('edgeConnector / isDirected', () => {
  it('edgeConnector returns -> or --', testEdgeConnector);
  it('isDirected checks graph kind', testIsDirected);
});

describe('DotRenderer', () => {
  it('factory returns type=dot quality=0', testDotRendererFactory);
  it('beginGraph/endGraph emit DOT wrapper', testDotBeginEndGraph);
  it('endNode emits node with pos attribute', testDotEndNode);
  it('endEdge emits directed arrow', testDotEndEdge);
});

describe('XdotRenderer', () => {
  it('factory returns type=xdot quality=0', testXdotRendererFactory);
  it('beginGraph emits xdotversion', testXdotBeginGraph);
});
