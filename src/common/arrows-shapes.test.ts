// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from 'vitest';
import { parseArrow, resolveArrowType } from './arrows.js';
import { arrowLength, arrowLengthOne, dispatchSimple } from './arrows-shapes.js';
import type { ArrowDrawOp } from './arrows-types.js';
import { arrowheadPolygon } from '../layout/dot/edge-route-arrow.js';
import type { Point } from '../model/geom.js';

const resolve = (s: string) => resolveArrowType(parseArrow(s)[0]);
const onlyOp = (ops: ArrowDrawOp[]): ArrowDrawOp => {
  expect(ops.length).toBeGreaterThan(0);
  return ops[0];
};

describe('dispatchSimple — dot/odot ellipse (G1 target)', () => {
  // Native dot for digraph{a->b[arrowhead=dot]} emits <ellipse ... rx="4" ry="4">
  // (filled) and odot emits fill="none". radius = |u|/2 = lenfact*size*ARROW_LENGTH/2.
  const tip: Point = { x: 0, y: 0 };
  const dir: Point = { x: 0, y: 1 }; // shaft points +y (tip → base)

  it('AC1: dot → single filled ellipse, radius 4 at size=1 (matches oracle rx/ry)', () => {
    const { ops } = dispatchSimple(resolve('dot'), tip, dir, 1, 1);
    const op = onlyOp(ops);
    expect(op.kind).toBe('ellipse');
    if (op.kind !== 'ellipse') return;
    expect(op.rx).toBeCloseTo(4, 9);
    expect(op.ry).toBeCloseTo(4, 9);
    expect(op.filled).toBe(true);
    // center = p - delta + u/2; delta = pw/2 along -dir = (0,-0.5) → p=(0,0.5),
    // center = (0, 0.5 + 4) = (0, 4.5)
    expect(op.center.x).toBeCloseTo(0, 9);
    expect(op.center.y).toBeCloseTo(4.5, 9);
  });

  it('AC2: odot → unfilled ellipse (matches oracle fill="none")', () => {
    const { ops } = dispatchSimple(resolve('odot'), tip, dir, 1, 1);
    const op = onlyOp(ops);
    expect(op.kind).toBe('ellipse');
    if (op.kind !== 'ellipse') return;
    expect(op.filled).toBe(false);
  });

  it('arrowsize scales the dot radius linearly (size=2 → radius 8)', () => {
    const { ops } = dispatchSimple(resolve('dot'), tip, dir, 2, 1);
    const op = onlyOp(ops);
    if (op.kind !== 'ellipse') throw new Error('expected ellipse');
    expect(op.rx).toBeCloseTo(8, 9);
  });
});

describe('dispatchSimple — normal (no regression vs existing stub)', () => {
  const tip: Point = { x: 17, y: 23 };
  const dir: Point = { x: 0, y: 1 };

  it('AC3: normal → 3-pt filled polygon matching arrowheadPolygon within rounding', () => {
    const { ops } = dispatchSimple(resolve('normal'), tip, dir, 1, 1);
    const op = onlyOp(ops);
    expect(op.kind).toBe('polygon');
    if (op.kind !== 'polygon') return;
    expect(op.points.length).toBe(3);
    expect(op.filled).toBe(true);
    // The faithful miter port differs from the closed-form stub by < 0.01
    // (~0.004 along the shaft); both translate the triangle toward the node.
    const stub = arrowheadPolygon(tip, dir, 1);
    for (let i = 0; i < 3; i++) {
      expect(op.points[i].x).toBeCloseTo(stub[i].x, 1);
      expect(op.points[i].y).toBeCloseTo(stub[i].y, 1);
    }
  });

  it('open normal (empty) → unfilled polygon', () => {
    const { ops } = dispatchSimple(resolve('empty'), tip, dir, 1, 1);
    const op = onlyOp(ops);
    if (op.kind !== 'polygon') throw new Error('expected polygon');
    expect(op.filled).toBe(false);
  });
});

describe('dispatchSimple — box / diamond', () => {
  const tip: Point = { x: 0, y: 0 };
  const dir: Point = { x: 0, y: 1 };

  it('box → polygon(4) + polyline(2)', () => {
    const { ops } = dispatchSimple(resolve('box'), tip, dir, 1, 1);
    expect(ops.map((o) => o.kind)).toEqual(['polygon', 'polyline']);
    const poly = ops[0];
    if (poly.kind !== 'polygon') throw new Error('expected polygon');
    expect(poly.points.length).toBe(4);
    expect(poly.filled).toBe(true);
  });

  it('obox → unfilled polygon', () => {
    const { ops } = dispatchSimple(resolve('obox'), tip, dir, 1, 1);
    const poly = ops[0];
    if (poly.kind !== 'polygon') throw new Error('expected polygon');
    expect(poly.filled).toBe(false);
  });

  it('diamond → single polygon(4)', () => {
    const { ops } = dispatchSimple(resolve('diamond'), tip, dir, 1, 1);
    expect(ops.length).toBe(1);
    const poly = ops[0];
    if (poly.kind !== 'polygon') throw new Error('expected polygon');
    expect(poly.points.length).toBe(4);
  });
});

describe('arrow length functions', () => {
  it('dot length = 0.8*size*ARROW_LENGTH + penwidth = 9 at size=1 pw=1', () => {
    expect(arrowLengthOne(resolve('dot'), 1, 1)).toBeCloseTo(9, 9);
  });

  it('box length = size*ARROW_LENGTH + penwidth/2 = 10.5 at size=1 pw=1', () => {
    expect(arrowLengthOne(resolve('box'), 1, 1)).toBeCloseTo(10.5, 9);
  });

  it('AC4: dot nominal length is 0.8x normal nominal (lenfact ratio)', () => {
    // Per arrow_length_generic the nominal lengths are lenfact*size*ARROW_LENGTH;
    // dot lenfact 0.8, normal lenfact 1.0 → ratio 0.8.
    expect(resolve('dot').lenfact / resolve('normal').lenfact).toBeCloseTo(0.8, 9);
  });

  it('arrowsize=0 → total length 0 (matches arrow_length early return)', () => {
    expect(arrowLength([resolve('normal')], 0, 1)).toBe(0);
  });

  it('compound sums component lengths (crowdot ~ crow + dot)', () => {
    const comps = parseArrow('crowdot').map(resolveArrowType);
    const total = arrowLength(comps, 1, 1);
    const sum = comps.reduce((acc, c) => acc + arrowLengthOne(c, 1, 1), 0);
    expect(total).toBeCloseTo(sum, 9);
  });
});
