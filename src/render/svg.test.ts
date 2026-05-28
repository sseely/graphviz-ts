// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import { escapeXml } from './svg-helpers.js';
import { SvgRenderer, createSvgRenderer } from './svg.js';
import type { ObjState } from '../gvc/job.js';
import { RenderJob, ObjType, EmitState, MapShape } from '../gvc/job.js';
import { PenType, FillType } from '../gvc/context.js';
import { Graph } from '../model/graph.js';
import { Node } from '../model/node.js';
import { Edge } from '../model/edge.js';
import type { Point } from '../model/geom.js';
import type { TextSpan } from '../common/emit-types.js';
import type { TextMeasurer } from '../common/textmeasure.js';

// ---------------------------------------------------------------------------
// Shared stubs
// ---------------------------------------------------------------------------

const measurer: TextMeasurer = { measure: () => ({ w: 0, h: 0 }) };

export function makeJob(): RenderJob {
  const j = new RenderJob('svg', measurer);
  j.bb = { ll: { x: 0, y: 0 }, ur: { x: 100, y: 80 } };
  return j;
}

export function makeObjState(): ObjState {
  return {
    parent: null, type: ObjType.Node, graphObj: null,
    emitState: EmitState.NDraw,
    penColor: { type: 'string', s: 'black' },
    fillColor: { type: 'string', s: 'white' },
    stopColor: { type: 'none' },
    gradientAngle: 0, gradientFrac: 0,
    pen: PenType.Solid, fill: FillType.None, penWidth: 1.0,
    rawStyle: [],
    label: null, xlabel: null, tailLabel: null, headLabel: null,
    url: null, id: null, labelUrl: null, tailUrl: null, headUrl: null,
    tooltip: null, labelTooltip: null, tailTooltip: null, headTooltip: null,
    target: null, labelTarget: null, tailTarget: null, headTarget: null,
    explicitTooltip: false, explicitTailTooltip: false,
    explicitHeadTooltip: false, explicitLabelTooltip: false,
    explicitTailTarget: false, explicitHeadTarget: false,
    explicitEdgeTarget: false, explicitTailUrl: false,
    explicitHeadUrl: false, labelEdgeAligned: false,
    urlMapShape: MapShape.Rectangle,
    urlMapPts: [], urlBsplineMapPts: [],
    tailEndMapPts: [], headEndMapPts: [],
  };
}

export function makeGraph(): Graph {
  const g = new Graph('G', 'directed');
  g.info.bb = { ll: { x: 0, y: 0 }, ur: { x: 100, y: 80 } };
  return g;
}

export function makeNode(g: Graph): Node {
  return new Node(0, 'myNode', g);
}

export function makeSpan(): TextSpan {
  return {
    str: 'Hello', fontName: 'Times,serif', fontSize: 14,
    fontColor: '#000000', fontFlags: 0,
    just: 'n', size: { x: 30, y: 14 },
    yoffset_centerline: 5, yoffset_layout: 0,
  };
}

export function makePts(): Point[] {
  return [
    { x: 0, y: 0 }, { x: 10, y: 20 },
    { x: 30, y: 20 }, { x: 40, y: 0 },
  ];
}

// ---------------------------------------------------------------------------
// escapeXml test bodies
// ---------------------------------------------------------------------------

export function testEscapeSpecial(): void {
  expect(escapeXml('a & b')).toBe('a &amp; b');
  expect(escapeXml('<tag>')).toBe('&lt;tag&gt;');
  expect(escapeXml('"hi"')).toBe('&quot;hi&quot;');
}

export function testEscapePlain(): void {
  expect(escapeXml('hello world')).toBe('hello world');
}

// ---------------------------------------------------------------------------
// Factory test bodies
// ---------------------------------------------------------------------------

export function testFactory(): void {
  const r = createSvgRenderer();
  expect(r.type).toBe('svg');
  expect(r.quality).toBe(0);
}

// ---------------------------------------------------------------------------
// Graph wrapper test bodies
// ---------------------------------------------------------------------------

export function testBeginGraph(): void {
  const r = new SvgRenderer();
  const job = makeJob();
  r.beginGraph(makeGraph(), job);
  const out = job.output.join('');
  expect(out).toContain('<?xml version="1.0"');
  expect(out).toContain('<svg');
  expect(out).toContain('<title>G</title>');
}

export function testEndGraph(): void {
  const r = new SvgRenderer();
  const job = makeJob();
  r.endGraph(makeGraph(), job);
  expect(job.output.join('')).toContain('</svg>');
}

// ---------------------------------------------------------------------------
// Node / edge wrapper test bodies
// ---------------------------------------------------------------------------

export function testBeginNode(): void {
  const r = new SvgRenderer();
  const job = makeJob();
  r.beginNode(makeNode(makeGraph()), job);
  const out = job.output.join('');
  expect(out).toContain('<g id="myNode" class="node">');
  expect(out).toContain('<title>myNode</title>');
}

export function testEndNode(): void {
  const r = new SvgRenderer();
  const job = makeJob();
  r.endNode(makeNode(makeGraph()), job);
  expect(job.output.join('')).toBe('</g>\n');
}

export function testBeginEdge(): void {
  const r = new SvgRenderer();
  const job = makeJob();
  const g = makeGraph();
  const e = new Edge(new Node(0, 'A', g), new Node(1, 'B', g), '');
  r.beginEdge(e, job);
  expect(job.output.join('')).toContain('class="edge"');
}

// ---------------------------------------------------------------------------
// Shape / text emitter test bodies
// ---------------------------------------------------------------------------

export function testTextspan(): void {
  const r = new SvgRenderer();
  const job = makeJob();
  job.pushObj(makeObjState());
  r.textspan({ x: 50, y: 40 }, makeSpan(), job);
  const out = job.output.join('');
  expect(out).toContain('<text');
  expect(out).toContain('text-anchor="middle"');
  expect(out).toContain('Hello');
}

export function testEllipse(): void {
  const r = new SvgRenderer();
  const job = makeJob();
  job.pushObj(makeObjState());
  r.ellipse({ x: 50, y: 40 }, 30, 20, false, job);
  const out = job.output.join('');
  expect(out).toContain('<ellipse');
  expect(out).toContain('cx=');
}

export function testBezier(): void {
  const r = new SvgRenderer();
  const job = makeJob();
  job.pushObj(makeObjState());
  r.bezier(makePts(), false, job);
  const out = job.output.join('');
  expect(out).toContain('<path');
  expect(out).toContain(' d="M');
  expect(out).toContain('C');
}

export function testPolygon(): void {
  const r = new SvgRenderer();
  const job = makeJob();
  job.pushObj(makeObjState());
  const pts: Point[] = [
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 },
  ];
  r.polygon(pts, false, job);
  expect(job.output.join('')).toContain('<polygon');
}

export function testComment(): void {
  const r = new SvgRenderer();
  const job = makeJob();
  r.comment?.('hello', job);
  expect(job.output.join('')).toContain('<!-- hello -->');
}

// ---------------------------------------------------------------------------
// describe / it registrations
// ---------------------------------------------------------------------------

describe('escapeXml', () => {
  it('escapes special XML characters', testEscapeSpecial);
  it('leaves plain text unchanged', testEscapePlain);
});

describe('createSvgRenderer', () => {
  it('returns type=svg quality=0', testFactory);
});

describe('SvgRenderer graph wrapper', () => {
  it('beginGraph emits XML declaration and svg open tag', testBeginGraph);
  it('endGraph emits closing svg tag', testEndGraph);
});

describe('SvgRenderer node/edge wrappers', () => {
  it('beginNode emits g with id and title', testBeginNode);
  it('endNode closes g element', testEndNode);
  it('beginEdge emits g with class=edge', testBeginEdge);
});

describe('SvgRenderer shapes', () => {
  it('textspan emits text element with middle anchor', testTextspan);
  it('ellipse emits ellipse element', testEllipse);
  it('bezier emits path starting with M then C', testBezier);
  it('polygon emits polygon element', testPolygon);
  it('comment emits HTML comment', testComment);
});
