// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from 'vitest';
import { parseArrow, resolveArrowType } from './arrows.js';
import { arrowDrawOps, arrowLength, arrowLengthOne, dispatchSimple } from './arrows-shapes.js';
import type { ArrowDrawOp } from './arrows-types.js';
import { arrowheadPolygon } from '../layout/dot/edge-route-arrow.js';
import type { Point } from '../model/geom.js';

const resolve = (s: string) => resolveArrowType(parseArrow(s)[0]);
const comps = (s: string) => parseArrow(s).map(resolveArrowType);
const TIP: Point = { x: 0, y: 0 };
const DIR: Point = { x: 0, y: 1 }; // shaft points +y (tip → base)
const op0 = (ops: ArrowDrawOp[]): ArrowDrawOp => ops[0];

describe('dot/odot ellipse (G1 target)', () => {
  // Native dot rx=ry=4 (filled); odot fill="none". radius=lenfact*size*5.
  it('AC1: dot → filled ellipse radius 4, center per C delta', () => {
    const op = op0(dispatchSimple(resolve('dot'), TIP, DIR, 1, 1).ops);
    if (op.kind !== 'ellipse') throw new Error('ellipse');
    expect(op.rx).toBeCloseTo(4, 9);
    expect(op.ry).toBeCloseTo(4, 9);
    expect(op.filled).toBe(true);
    expect(op.center.x).toBeCloseTo(0, 9);
    expect(op.center.y).toBeCloseTo(4.5, 9);
  });
  it('AC2: odot unfilled; arrowsize=2 → radius 8', () => {
    expect((op0(dispatchSimple(resolve('odot'), TIP, DIR, 1, 1).ops) as { filled: boolean }).filled).toBe(false);
    const big = op0(dispatchSimple(resolve('dot'), TIP, DIR, 2, 1).ops);
    if (big.kind !== 'ellipse') throw new Error('ellipse');
    expect(big.rx).toBeCloseTo(8, 9);
  });
});

describe('normal (no regression vs existing stub)', () => {
  const tip: Point = { x: 17, y: 23 };
  it('AC3: normal → 3-pt filled polygon ≈ arrowheadPolygon', () => {
    const op = op0(dispatchSimple(resolve('normal'), tip, DIR, 1, 1).ops);
    if (op.kind !== 'polygon') throw new Error('polygon');
    expect(op.points.length).toBe(3);
    expect(op.filled).toBe(true);
    const stub = arrowheadPolygon(tip, DIR, 1);
    for (let i = 0; i < 3; i++) {
      expect(op.points[i].x).toBeCloseTo(stub[i].x, 1);
      expect(op.points[i].y).toBeCloseTo(stub[i].y, 1);
    }
  });
  it('empty (open normal) → unfilled polygon', () => {
    expect((op0(dispatchSimple(resolve('empty'), tip, DIR, 1, 1).ops) as { filled: boolean }).filled).toBe(false);
  });
});

describe('box / diamond', () => {
  it('box → polygon(4)+polyline(2); obox unfilled', () => {
    const { ops } = dispatchSimple(resolve('box'), TIP, DIR, 1, 1);
    expect(ops.map((o) => o.kind)).toEqual(['polygon', 'polyline']);
    expect((ops[0] as { points: Point[] }).points.length).toBe(4);
    expect((ops[0] as { filled: boolean }).filled).toBe(true);
    expect((op0(dispatchSimple(resolve('obox'), TIP, DIR, 1, 1).ops) as { filled: boolean }).filled).toBe(false);
  });
  it('diamond → single polygon(4)', () => {
    const { ops } = dispatchSimple(resolve('diamond'), TIP, DIR, 1, 1);
    expect(ops.length).toBe(1);
    expect((ops[0] as { points: Point[] }).points.length).toBe(4);
  });
});

describe('crow / vee (G2 target: 9-pt polygon)', () => {
  it('AC: crow → filled polygon, 8 points, toe span = 2*0.45*|u| = 9', () => {
    const op = op0(dispatchSimple(resolve('crow'), TIP, DIR, 1, 1).ops);
    if (op.kind !== 'polygon') throw new Error('polygon');
    expect(op.points.length).toBe(8);
    expect(op.filled).toBe(true);
    expect(Math.abs(op.points[1].x - op.points[7].x)).toBeCloseTo(9, 6);
  });
  it('vee = crow|INV → 8-pt polygon, distinct geometry from crow', () => {
    const crow = op0(dispatchSimple(resolve('crow'), TIP, DIR, 1, 1).ops);
    const vee = op0(dispatchSimple(resolve('vee'), TIP, DIR, 1, 1).ops);
    if (crow.kind !== 'polygon' || vee.kind !== 'polygon') throw new Error('polygon');
    expect(vee.points.length).toBe(8);
    expect(vee.points[0].y).not.toBeCloseTo(crow.points[0].y, 3);
  });
});

describe('tee / gap / curve', () => {
  it('tee → polygon(4)+polyline(2)', () => {
    const { ops } = dispatchSimple(resolve('tee'), TIP, DIR, 1, 1);
    expect(ops.map((o) => o.kind)).toEqual(['polygon', 'polyline']);
    expect((ops[0] as { points: Point[] }).points.length).toBe(4);
  });
  it('none(gap) → single polyline; curve → polyline+bezier', () => {
    expect(dispatchSimple(resolve('none'), TIP, DIR, 1, 1).ops.map((o) => o.kind)).toEqual(['polyline']);
    expect(dispatchSimple(resolve('curve'), TIP, DIR, 1, 1).ops.map((o) => o.kind)).toEqual(['polyline', 'bezier']);
  });
});

describe('side modifiers + arrowsize scaling', () => {
  it('lnormal collapses one side → 3-pt polygon differing from normal', () => {
    const n = op0(dispatchSimple(resolve('normal'), TIP, DIR, 1, 1).ops);
    const l = op0(dispatchSimple(resolve('lnormal'), TIP, DIR, 1, 1).ops);
    if (n.kind !== 'polygon' || l.kind !== 'polygon') throw new Error('polygon');
    expect(l.points.length).toBe(3);
    expect(l.points).not.toEqual(n.points);
  });
  it('arrowsize=2 scales the normal polygon 2x about the tip', () => {
    const s1 = op0(dispatchSimple(resolve('normal'), TIP, DIR, 1, 1).ops);
    const s2 = op0(dispatchSimple(resolve('normal'), TIP, DIR, 2, 1).ops);
    if (s1.kind !== 'polygon' || s2.kind !== 'polygon') throw new Error('polygon');
    // base width doubles with size
    const w1 = Math.abs(s1.points[0].x - s1.points[2].x);
    const w2 = Math.abs(s2.points[0].x - s2.points[2].x);
    expect(w2 / w1).toBeCloseTo(2, 6);
  });
});

describe('compound stacking (arrowDrawOps)', () => {
  it('crowdot → crow polygon then dot ellipse offset along the shaft', () => {
    const ops = arrowDrawOps(comps('crowdot'), TIP, DIR, 1, 1);
    expect(ops.map((o) => o.kind)).toEqual(['polygon', 'ellipse']);
    const solo = op0(dispatchSimple(resolve('dot'), TIP, DIR, 1, 1).ops);
    const stacked = ops[1];
    if (solo.kind !== 'ellipse' || stacked.kind !== 'ellipse') throw new Error('ellipse');
    // the dot in crowdot is pushed past the crow length along +y
    expect(stacked.center.y).toBeGreaterThan(solo.center.y + 5);
  });
  it('single-component arrowDrawOps == dispatchSimple ops', () => {
    const a = arrowDrawOps(comps('diamond'), TIP, DIR, 1, 1);
    const b = dispatchSimple(resolve('diamond'), TIP, DIR, 1, 1).ops;
    expect(a).toEqual(b);
  });
});

describe('arrow length functions', () => {
  it('dot=9, box=10.5 at size=1 pw=1; lenfact ratio 0.8', () => {
    expect(arrowLengthOne(resolve('dot'), 1, 1)).toBeCloseTo(9, 9);
    expect(arrowLengthOne(resolve('box'), 1, 1)).toBeCloseTo(10.5, 9);
    expect(resolve('dot').lenfact / resolve('normal').lenfact).toBeCloseTo(0.8, 9);
  });
  it('arrowsize=0 → 0; compound sums components', () => {
    expect(arrowLength([resolve('normal')], 0, 1)).toBe(0);
    const c = comps('crowdot');
    const sum = c.reduce((acc, x) => acc + arrowLengthOne(x, 1, 1), 0);
    expect(arrowLength(c, 1, 1)).toBeCloseTo(sum, 9);
  });
});
