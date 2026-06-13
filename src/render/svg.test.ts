// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import { escapeXml } from './svg-helpers.js';
import { SvgRenderer, createSvgRenderer } from './svg.js';
import type { ObjState } from '../gvc/job.js';
import { RenderJob, createObjState } from '../gvc/job.js';

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

/** @see createObjState in src/gvc/job.ts */
export function makeObjState(): ObjState {
  return createObjState();
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
  expect(out).toContain('class="node">');  // id is sequential (node1, node2...)
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

export function testTextspanPlainNoFontAttrs(): void {
  // Plain-text span (fontFlags=0, fontColor=null) must NOT emit
  // font-weight, font-style, text-decoration, or fill — byte-stability.
  const r = new SvgRenderer();
  const job = makeJob();
  job.pushObj(makeObjState());
  const span: TextSpan = { ...makeSpan(), fontFlags: 0, fontColor: null };
  r.textspan({ x: 50, y: 40 }, span, job);
  const out = job.output.join('');
  expect(out).not.toContain('font-weight');
  expect(out).not.toContain('font-style');
  expect(out).not.toContain('text-decoration');
  expect(out).not.toContain('fill=');
}

export function testTextspanBoldFlag(): void {
  const r = new SvgRenderer();
  const job = makeJob();
  job.pushObj(makeObjState());
  const span: TextSpan = { ...makeSpan(), fontFlags: 1 }; // HTML_BF=1
  r.textspan({ x: 50, y: 40 }, span, job);
  expect(job.output.join('')).toContain('font-weight="bold"');
}

export function testTextspanItalicFlag(): void {
  const r = new SvgRenderer();
  const job = makeJob();
  job.pushObj(makeObjState());
  const span: TextSpan = { ...makeSpan(), fontFlags: 2 }; // HTML_IF=2
  r.textspan({ x: 50, y: 40 }, span, job);
  expect(job.output.join('')).toContain('font-style="italic"');
}

export function testTextspanUnderlineFlag(): void {
  const r = new SvgRenderer();
  const job = makeJob();
  job.pushObj(makeObjState());
  const span: TextSpan = { ...makeSpan(), fontFlags: 4 }; // HTML_UL=4
  r.textspan({ x: 50, y: 40 }, span, job);
  expect(job.output.join('')).toContain('text-decoration="underline"');
}

export function testTextspanStrikeFlag(): void {
  const r = new SvgRenderer();
  const job = makeJob();
  job.pushObj(makeObjState());
  const span: TextSpan = { ...makeSpan(), fontFlags: 32 }; // HTML_S=32
  r.textspan({ x: 50, y: 40 }, span, job);
  expect(job.output.join('')).toContain('text-decoration="line-through"');
}

export function testTextspanUnderlineAndStrike(): void {
  const r = new SvgRenderer();
  const job = makeJob();
  job.pushObj(makeObjState());
  const span: TextSpan = { ...makeSpan(), fontFlags: 4 | 32 }; // HTML_UL|HTML_S
  r.textspan({ x: 50, y: 40 }, span, job);
  const out = job.output.join('');
  expect(out).toContain('text-decoration="underline,line-through"');
}

export function testTextspanFontColorRed(): void {
  // Non-black fontColor should emit fill="red"
  const r = new SvgRenderer();
  const job = makeJob();
  job.pushObj(makeObjState());
  const span: TextSpan = { ...makeSpan(), fontFlags: 0, fontColor: 'red' };
  r.textspan({ x: 50, y: 40 }, span, job);
  expect(job.output.join('')).toContain('fill="red"');
}

export function testTextspanFontColorBlackOmitted(): void {
  // "black" fontColor must NOT emit fill= (C omits fill for black)
  const r = new SvgRenderer();
  const job = makeJob();
  job.pushObj(makeObjState());
  const span: TextSpan = { ...makeSpan(), fontFlags: 0, fontColor: 'black' };
  r.textspan({ x: 50, y: 40 }, span, job);
  expect(job.output.join('')).not.toContain('fill=');
}

export function testTextspanSupFlag(): void {
  const r = new SvgRenderer();
  const job = makeJob();
  job.pushObj(makeObjState());
  const span: TextSpan = { ...makeSpan(), fontFlags: 8 }; // HTML_SUP=8
  r.textspan({ x: 50, y: 40 }, span, job);
  expect(job.output.join('')).toContain('baseline-shift="super"');
}

export function testTextspanSubFlag(): void {
  const r = new SvgRenderer();
  const job = makeJob();
  job.pushObj(makeObjState());
  const span: TextSpan = { ...makeSpan(), fontFlags: 16 }; // HTML_SUB=16
  r.textspan({ x: 50, y: 40 }, span, job);
  expect(job.output.join('')).toContain('baseline-shift="sub"');
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

describe('svgTextspan font flags', () => {
  it('plain span emits no font-weight/style/decoration/fill', testTextspanPlainNoFontAttrs);
  it('HTML_BF emits font-weight=bold', testTextspanBoldFlag);
  it('HTML_IF emits font-style=italic', testTextspanItalicFlag);
  it('HTML_UL emits text-decoration=underline', testTextspanUnderlineFlag);
  it('HTML_S emits text-decoration=line-through', testTextspanStrikeFlag);
  it('HTML_UL|HTML_S emits underline,line-through', testTextspanUnderlineAndStrike);
  it('fontColor=red emits fill=red', testTextspanFontColorRed);
  it('fontColor=black omits fill', testTextspanFontColorBlackOmitted);
  it('HTML_SUP emits baseline-shift=super', testTextspanSupFlag);
  it('HTML_SUB emits baseline-shift=sub', testTextspanSubFlag);
});
