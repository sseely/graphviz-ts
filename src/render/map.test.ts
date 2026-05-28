// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import {
  printG5,
  plainCoord,
  plainNodeFill,
  plainNodeAttrs,
  collectSplinePts,
  portSuffix,
  writePlainEdgeHead,
  writePlainEdge,
  writePlain,
  cmapxObjAnchor,
  writeCmapxGraphShape,
  cmapxShape,
  cmapxCoordsRect,
  cmapxCoordsCircle,
  cmapxCoordsPoly,
  cmapxCoords,
  mapCmapxAttrs,
  mapOutputCmapx,
  mapOutputImap,
} from './map.js';
import { MapShape } from '../gvc/job.js';
import { Edge } from '../model/edge.js';
import type { Point } from '../model/geom.js';
import { makeJob, makeObjState, makeGraph, makeNode } from './map-test-helpers.js';

export { makeJob, makeObjState, makeGraph, makeNode };

// ---------------------------------------------------------------------------
// Avoid Lizard quote-tracker bug: never put " inside string literals.
// ---------------------------------------------------------------------------

const DQ = '\x22';

// ---------------------------------------------------------------------------
// printG5 test bodies
// ---------------------------------------------------------------------------

export function testPrintG5Integer(): void {
  expect(printG5(1)).toBe('1');
  expect(printG5(100)).toBe('100');
}

export function testPrintG5TrailingZeros(): void {
  expect(printG5(1.50000)).toBe('1.5');
  expect(printG5(0.50000)).toBe('0.5');
}

export function testPrintG5SigFigs(): void {
  expect(printG5(1.23456789)).toBe('1.2346');
}

// ---------------------------------------------------------------------------
// plainCoord test bodies
// ---------------------------------------------------------------------------

export function testPlainCoord(): void {
  expect(plainCoord(72)).toBe('1');
  expect(plainCoord(36)).toBe('0.5');
}

// ---------------------------------------------------------------------------
// plainNodeFill test bodies
// ---------------------------------------------------------------------------

export function testPlainNodeFillDefault(): void {
  const g = makeGraph();
  const n = makeNode(g);
  expect(plainNodeFill(n)).toBe('black');
}

export function testPlainNodeFillColor(): void {
  const g = makeGraph();
  const n = makeNode(g);
  n.attrs.set('color', 'red');
  expect(plainNodeFill(n)).toBe('red');
}

export function testPlainNodeFillFillcolor(): void {
  const g = makeGraph();
  const n = makeNode(g);
  n.attrs.set('color', 'red');
  n.attrs.set('fillcolor', 'blue');
  expect(plainNodeFill(n)).toBe('blue');
}

// ---------------------------------------------------------------------------
// plainNodeAttrs test bodies
// ---------------------------------------------------------------------------

export function testPlainNodeAttrsDefaults(): void {
  const g = makeGraph();
  const n = makeNode(g);
  const a = plainNodeAttrs(n);
  expect(a.label).toBe('A');
  expect(a.style).toBe('solid');
  expect(a.shape).toBe('ellipse');
  expect(a.color).toBe('black');
}

export function testPlainNodeAttrsCustom(): void {
  const g = makeGraph();
  const n = makeNode(g);
  n.attrs.set('label', 'myLabel');
  n.attrs.set('style', 'dashed');
  n.attrs.set('shape', 'box');
  n.attrs.set('color', 'green');
  n.attrs.set('fillcolor', 'yellow');
  const a = plainNodeAttrs(n);
  expect(a.label).toBe('myLabel');
  expect(a.style).toBe('dashed');
  expect(a.shape).toBe('box');
  expect(a.fill).toBe('yellow');
}

// ---------------------------------------------------------------------------
// collectSplinePts test bodies
// ---------------------------------------------------------------------------

export function testCollectSplinePtsEmpty(): void {
  const g = makeGraph();
  const n = makeNode(g);
  const e = new Edge(n, n, '');
  expect(collectSplinePts(e)).toEqual([]);
}

export function testCollectSplinePtsFlattens(): void {
  const g = makeGraph();
  const n = makeNode(g);
  const e = new Edge(n, n, '');
  const pts1: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
  const pts2: Point[] = [{ x: 20, y: 20 }];
  e.info.spl = {
    list: [
      { list: pts1, size: 2, sflag: 0, eflag: 0, sp: { x: 0, y: 0 }, ep: { x: 0, y: 0 } },
      { list: pts2, size: 1, sflag: 0, eflag: 0, sp: { x: 0, y: 0 }, ep: { x: 0, y: 0 } },
    ],
    size: 2,
    bb: { ll: { x: 0, y: 0 }, ur: { x: 20, y: 20 } },
  };
  const result = collectSplinePts(e);
  expect(result).toHaveLength(3);
  expect(result[0]).toEqual({ x: 0, y: 0 });
  expect(result[2]).toEqual({ x: 20, y: 20 });
}

// ---------------------------------------------------------------------------
// portSuffix test bodies
// ---------------------------------------------------------------------------

export function testPortSuffixNull(): void {
  expect(portSuffix(null)).toBe('');
}

export function testPortSuffixPresent(): void {
  expect(portSuffix('w')).toBe(':w');
}

// ---------------------------------------------------------------------------
// writePlainEdgeHead test body
// ---------------------------------------------------------------------------

export function testWritePlainEdgeHead(): void {
  const g = makeGraph();
  const a = makeNode(g, 'A');
  const b = makeNode(g, 'B');
  const e = new Edge(a, b, '');
  const pts: Point[] = [{ x: 72, y: 36 }, { x: 144, y: 72 }];
  const buf: string[] = [];
  writePlainEdgeHead(e, '', '', pts, buf);
  const out = buf.join('');
  expect(out).toContain('edge A B 2');
  expect(out).toContain('1 0.5');
}

// ---------------------------------------------------------------------------
// writePlainEdge test body
// ---------------------------------------------------------------------------

export function testWritePlainEdgeNoSpline(): void {
  const g = makeGraph();
  const n = makeNode(g);
  const e = new Edge(n, n, '');
  const buf: string[] = [];
  writePlainEdge(e, false, buf);
  const out = buf.join('');
  expect(out).toContain('solid');
  expect(out).toContain('black');
}

// ---------------------------------------------------------------------------
// writePlain test body
// ---------------------------------------------------------------------------

export function testWritePlainHeader(): void {
  const g = makeGraph();
  makeNode(g, 'A');
  const job = makeJob();
  writePlain(g, job, false);
  const out = job.output.join('');
  expect(out).toContain('graph 1 2 1');
  expect(out).toContain('node A');
  expect(out).toContain('stop');
}

// ---------------------------------------------------------------------------
// cmapxObjAnchor test bodies
// ---------------------------------------------------------------------------

export function testCmapxObjAnchorNulls(): void {
  const a = cmapxObjAnchor(makeObjState());
  expect(a.url).toBe('');
  expect(a.tooltip).toBe('');
  expect(a.target).toBe('');
  expect(a.id).toBe('');
}

export function testCmapxObjAnchorValues(): void {
  const obj = makeObjState();
  obj.url = 'http://example.com';
  obj.tooltip = 'tip';
  obj.target = '_blank';
  obj.id = 'myid';
  const a = cmapxObjAnchor(obj);
  expect(a.url).toBe('http://example.com');
  expect(a.target).toBe('_blank');
}

// ---------------------------------------------------------------------------
// writeCmapxGraphShape test bodies
// ---------------------------------------------------------------------------

export function testWriteCmapxGraphShapeNoObj(): void {
  const buf: string[] = [];
  writeCmapxGraphShape(makeJob(), buf);
  expect(buf).toHaveLength(0);
}

export function testWriteCmapxGraphShapeNoPts(): void {
  const job = makeJob();
  job.pushObj(makeObjState());
  const buf: string[] = [];
  writeCmapxGraphShape(job, buf);
  expect(buf).toHaveLength(0);
}

// ---------------------------------------------------------------------------
// cmapxShape test body
// ---------------------------------------------------------------------------

export function testCmapxShape(): void {
  expect(cmapxShape(MapShape.Circle)).toBe('circle');
  expect(cmapxShape(MapShape.Rectangle)).toBe('rect');
  expect(cmapxShape(MapShape.Polygon)).toBe('poly');
}

// ---------------------------------------------------------------------------
// cmapxCoords* test bodies
// ---------------------------------------------------------------------------

export function testCmapxCoordsRect(): void {
  const pts: Point[] = [{ x: 10, y: 80 }, { x: 90, y: 20 }];
  expect(cmapxCoordsRect(pts)).toBe('10,20,90,80');
}

export function testCmapxCoordsCircle(): void {
  const pts: Point[] = [{ x: 50, y: 50 }, { x: 70, y: 50 }];
  expect(cmapxCoordsCircle(pts)).toBe('50,50,20');
}

export function testCmapxCoordsPoly(): void {
  const pts: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
  expect(cmapxCoordsPoly(pts)).toBe('0,0,10,0,5,10');
}

export function testCmapxCoordsDispatch(): void {
  const rPts: Point[] = [{ x: 10, y: 80 }, { x: 90, y: 20 }];
  expect(cmapxCoords(MapShape.Rectangle, rPts)).toBe('10,20,90,80');
  const cPts: Point[] = [{ x: 50, y: 50 }, { x: 70, y: 50 }];
  expect(cmapxCoords(MapShape.Circle, cPts)).toBe('50,50,20');
}

// ---------------------------------------------------------------------------
// mapCmapxAttrs test bodies
// ---------------------------------------------------------------------------

export function testMapCmapxAttrsEmpty(): void {
  const buf: string[] = [];
  mapCmapxAttrs({ url: '', tooltip: '', target: '', id: '' }, buf);
  expect(buf).toHaveLength(0);
}

export function testMapCmapxAttrsAll(): void {
  const buf: string[] = [];
  mapCmapxAttrs({ url: 'http://x.com', tooltip: 'tip', target: '_top', id: 'n1' }, buf);
  const out = buf.join('');
  expect(out).toContain('href=' + DQ + 'http://x.com' + DQ);
  expect(out).toContain('title=' + DQ + 'tip' + DQ);
  expect(out).toContain('target=' + DQ + '_top' + DQ);
  expect(out).toContain('id=' + DQ + 'n1' + DQ);
}

// ---------------------------------------------------------------------------
// mapOutputCmapx test bodies
// ---------------------------------------------------------------------------

export function testMapOutputCmapxRect(): void {
  const pts: Point[] = [{ x: 10, y: 80 }, { x: 90, y: 20 }];
  const buf: string[] = [];
  mapOutputCmapx(MapShape.Rectangle, pts, { url: 'http://x.com', tooltip: '', target: '', id: '' }, true, buf);
  const out = buf.join('');
  expect(out).toContain('<area shape=' + DQ + 'rect' + DQ);
  expect(out).toContain('href=' + DQ + 'http://x.com' + DQ);
  expect(out).toContain('coords=' + DQ + '10,20,90,80' + DQ);
  expect(out).toContain('/>');
}

export function testMapOutputCmapxNonXml(): void {
  const pts: Point[] = [{ x: 10, y: 80 }, { x: 90, y: 20 }];
  const buf: string[] = [];
  mapOutputCmapx(MapShape.Rectangle, pts, { url: '', tooltip: '', target: '', id: '' }, false, buf);
  const out = buf.join('');
  expect(out).toContain('>');
  expect(out).not.toContain('/>');
}

// ---------------------------------------------------------------------------
// mapOutputImap test bodies
// ---------------------------------------------------------------------------

export function testMapOutputImapSkipsEmpty(): void {
  const pts: Point[] = [{ x: 10, y: 80 }, { x: 90, y: 20 }];
  const buf: string[] = [];
  mapOutputImap(MapShape.Rectangle, pts, '', buf);
  expect(buf).toHaveLength(0);
}

export function testMapOutputImapRect(): void {
  const pts: Point[] = [{ x: 10, y: 80 }, { x: 90, y: 20 }];
  const buf: string[] = [];
  mapOutputImap(MapShape.Rectangle, pts, 'http://x.com', buf);
  expect(buf.join('')).toContain('rect http://x.com 10,20 90,80');
}

export function testMapOutputImapCircle(): void {
  const pts: Point[] = [{ x: 50, y: 50 }, { x: 70, y: 50 }];
  const buf: string[] = [];
  mapOutputImap(MapShape.Circle, pts, 'http://x.com', buf);
  expect(buf.join('')).toContain('circle http://x.com 50,50,20');
}

export function testMapOutputImapPoly(): void {
  const pts: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
  const buf: string[] = [];
  mapOutputImap(MapShape.Polygon, pts, 'http://x.com', buf);
  expect(buf.join('')).toContain('poly http://x.com');
}

// ---------------------------------------------------------------------------
// describe / it registrations
// ---------------------------------------------------------------------------

describe('printG5', () => {
  it('formats integers without decimal', testPrintG5Integer);
  it('strips trailing zeros', testPrintG5TrailingZeros);
  it('rounds to 5 significant figures', testPrintG5SigFigs);
});

describe('plainCoord', () => {
  it('divides by 72 and formats', testPlainCoord);
});

describe('plainNodeFill', () => {
  it('defaults to color attr (black)', testPlainNodeFillDefault);
  it('uses color attr when set', testPlainNodeFillColor);
  it('prefers fillcolor over color', testPlainNodeFillFillcolor);
});

describe('plainNodeAttrs', () => {
  it('returns defaults when no attrs set', testPlainNodeAttrsDefaults);
  it('uses attrs when set', testPlainNodeAttrsCustom);
});

describe('collectSplinePts', () => {
  it('returns empty when no spline', testCollectSplinePtsEmpty);
  it('flattens bezier point lists', testCollectSplinePtsFlattens);
});

describe('portSuffix', () => {
  it('returns empty for null', testPortSuffixNull);
  it('returns colon-prefixed name', testPortSuffixPresent);
});

describe('writePlainEdgeHead', () => {
  it('writes edge prefix with coord-converted points', testWritePlainEdgeHead);
});

describe('writePlainEdge', () => {
  it('writes style and color when no spline', testWritePlainEdgeNoSpline);
});

describe('writePlain', () => {
  it('writes header, nodes, and stop', testWritePlainHeader);
});

describe('cmapxObjAnchor', () => {
  it('defaults null fields to empty string', testCmapxObjAnchorNulls);
  it('copies non-null values', testCmapxObjAnchorValues);
});

describe('writeCmapxGraphShape', () => {
  it('no-op when no obj', testWriteCmapxGraphShapeNoObj);
  it('no-op when obj has no map pts', testWriteCmapxGraphShapeNoPts);
});

describe('cmapxShape', () => {
  it('maps enum to string', testCmapxShape);
});

describe('cmapxCoords', () => {
  it('rect: UL x,y LR x,y', testCmapxCoordsRect);
  it('circle: cx,cy,r', testCmapxCoordsCircle);
  it('poly: comma-separated pairs', testCmapxCoordsPoly);
  it('dispatches by shape enum', testCmapxCoordsDispatch);
});

describe('mapCmapxAttrs', () => {
  it('no output when all empty', testMapCmapxAttrsEmpty);
  it('emits all four attrs', testMapCmapxAttrsAll);
});

describe('mapOutputCmapx', () => {
  it('emits area element with coords', testMapOutputCmapxRect);
  it('uses > not /> in non-xml mode', testMapOutputCmapxNonXml);
});

describe('mapOutputImap', () => {
  it('skips when url is empty', testMapOutputImapSkipsEmpty);
  it('rect line format', testMapOutputImapRect);
  it('circle line format', testMapOutputImapCircle);
  it('poly line format', testMapOutputImapPoly);
});
