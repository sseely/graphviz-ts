// SPDX-License-Identifier: EPL-2.0
//
// Unit tests for the taper() geometry port (lib/common/taper.c).

import { describe, it, expect } from 'vitest';
import { taper, taperfun, forfunc, revfunc, nonefunc, bothfunc } from './taper.js';
import type { Bezier } from '../model/geom.js';

/** A straight horizontal cubic from (0,0) to (90,0). */
const straight: Bezier = {
  list: [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 60, y: 0 },
    { x: 90, y: 0 },
  ],
  size: 4,
  sflag: 0,
  eflag: 0,
  sp: { x: 0, y: 0 },
  ep: { x: 90, y: 0 },
};

describe('taperfun — dir → radius function', () => {
  it('directed default is forward (tapers to zero at the head)', () => {
    expect(taperfun(undefined, true)).toBe(forfunc);
  });
  it('undirected default is none (constant width)', () => {
    expect(taperfun(undefined, false)).toBe(nonefunc);
  });
  it('explicit dir overrides the graph default', () => {
    expect(taperfun('back', true)).toBe(revfunc);
    expect(taperfun('both', false)).toBe(bothfunc);
    expect(taperfun('none', true)).toBe(nonefunc);
  });
});

describe('radius functions (taper.c forfunc/revfunc/nonefunc/bothfunc)', () => {
  it('forfunc: initwid/2 at start, 0 at end', () => {
    expect(forfunc(0, 100, 10)).toBeCloseTo(5, 6);
    expect(forfunc(100, 100, 10)).toBeCloseTo(0, 6);
  });
  it('revfunc: 0 at start, initwid/2 at end', () => {
    expect(revfunc(0, 100, 10)).toBeCloseTo(0, 6);
    expect(revfunc(100, 100, 10)).toBeCloseTo(5, 6);
  });
  it('nonefunc: constant initwid/2', () => {
    expect(nonefunc(0, 100, 10)).toBeCloseTo(5, 6);
    expect(nonefunc(100, 100, 10)).toBeCloseTo(5, 6);
  });
  it('bothfunc: peaks at the midpoint', () => {
    expect(bothfunc(50, 100, 10)).toBeCloseTo(5, 6);
    expect(bothfunc(0, 100, 10)).toBeCloseTo(0, 6);
    expect(bothfunc(100, 100, 10)).toBeCloseTo(0, 6);
  });
});

describe('taper — forward taper on a straight line', () => {
  const verts = taper(straight, forfunc, 10);

  it('produces a closed polygon (first != last, side1 + cap + side2)', () => {
    expect(verts.length).toBeGreaterThan(40); // ~20 subdivisions * 2 sides
  });

  it('is full width at the tail and pinches to a point at the head', () => {
    // Tail: side-1 point offset above the axis by initwid/2 = 5.
    expect(verts[0]!.y).toBeCloseTo(5, 4);
    expect(verts[0]!.x).toBeCloseTo(0, 4);
    // Head: the taper radius reaches 0, so the two sides meet on the axis.
    const tip = verts.reduce((a, p) => (p.x > a.x ? p : a), verts[0]!);
    expect(tip.x).toBeCloseTo(90, 3);
    expect(tip.y).toBeCloseTo(0, 3);
  });

  it('is symmetric about the axis (side 2 mirrors side 1)', () => {
    // First side-1 vertex (+5) and last side-2 vertex (-5) straddle the axis.
    expect(verts[verts.length - 1]!.y).toBeCloseTo(-5, 4);
  });
});

describe('taper — none (constant width) keeps both ends full', () => {
  it('tail and head are both offset by initwid/2', () => {
    const verts = taper(straight, nonefunc, 8);
    expect(verts[0]!.y).toBeCloseTo(4, 4);
    // A constant-width stroke does not pinch: the far side-1 vertex is still
    // offset above the axis rather than meeting it.
    const far = verts.reduce((a, p) => (p.x > a.x ? p : a), verts[0]!);
    expect(Math.abs(far.y)).toBeGreaterThan(1);
  });
});
