// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for svg-gradient.ts — ports of svg_print_stop, svg_gradstyle,
 * svg_rgradstyle, and get_gradient_points.
 *
 * Oracle: `printf 'digraph{a[style=filled,fillcolor="red:blue"]}' | dot -Tsvg`
 * All expected strings verified against C graphviz 15.0.0 output.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getGradientPoints, emitStop, emitLinearGradient,
  emitRadialGradient, gradientId,
} from './svg-gradient.js';
import { RenderJob, createObjState } from '../gvc/job.js';
import { FillType } from '../gvc/context.js';
import type { TextMeasurer } from '../common/textmeasure.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const measurer: TextMeasurer = { measure: () => ({ w: 0, h: 0 }) };
function makeJob(): RenderJob { return new RenderJob('svg', measurer); }
function out(job: RenderJob): string { return job.output.join(''); }

// ---------------------------------------------------------------------------
// getGradientPoints test bodies
// ---------------------------------------------------------------------------

export function testLinearAngle0(): void {
  // A in y-up space: center=(27,18), corner=(54,36)
  // bbox min=(0,0) max=(54,36), cx=27, cy=18
  // g0.x=27-27=0, g0.y=-18+18*0=-18; g1.x=54, g1.y=-18
  const pts = [{ x: 27, y: 18 }, { x: 54, y: 36 }];
  const { g0, g1 } = getGradientPoints(pts, 0, false);
  expect(g0.x).toBeCloseTo(0, 5);
  expect(g0.y).toBeCloseTo(-18, 5);
  expect(g1.x).toBeCloseTo(54, 5);
  expect(g1.y).toBeCloseTo(-18, 5);
}

export function testLinearAngle90(): void {
  const pts = [{ x: 27, y: 18 }, { x: 54, y: 36 }];
  const { g0, g1 } = getGradientPoints(pts, Math.PI / 2, false);
  // cos=0 sin=1: g0.x=27, g0.y=-18+18=0; g1.x=27, g1.y=-18-18=-36
  expect(g0.x).toBeCloseTo(27, 4);
  expect(g0.y).toBeCloseTo(0, 4);
  expect(g1.x).toBeCloseTo(27, 4);
  expect(g1.y).toBeCloseTo(-36, 4);
}

export function testLinearNPoint(): void {
  // Square: (0,0),(10,0),(10,10),(0,10) → center=(5,5)
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const { g0, g1 } = getGradientPoints(pts, 0, false);
  expect(g0.x).toBeCloseTo(0, 5);
  expect(g0.y).toBeCloseTo(-5, 5);
  expect(g1.x).toBeCloseTo(10, 5);
  expect(g1.y).toBeCloseTo(-5, 5);
}

export function testRadialReturnsRadii(): void {
  const pts = [{ x: 27, y: 18 }, { x: 54, y: 36 }];
  const { g0, g1 } = getGradientPoints(pts, 0, true);
  const outerR = Math.hypot(27, 18);
  expect(g0.x).toBeCloseTo(27, 5);
  expect(g0.y).toBeCloseTo(-18, 5);
  expect(g1.x).toBeCloseTo(outerR / 4, 5);
  expect(g1.y).toBeCloseTo(outerR, 5);
}

// ---------------------------------------------------------------------------
// emitStop test bodies
// ---------------------------------------------------------------------------

export function testStopOffset0(): void {
  const job = makeJob();
  emitStop(job, 0, { type: 'string', s: 'red' });
  expect(out(job)).toBe('<stop offset="0" style="stop-color:red;stop-opacity:1.;"/>\n');
}

export function testStopOffset1(): void {
  const job = makeJob();
  emitStop(job, 1, { type: 'string', s: 'blue' });
  expect(out(job)).toBe('<stop offset="1" style="stop-color:blue;stop-opacity:1.;"/>\n');
}

export function testStopOffset0299(): void {
  const job = makeJob();
  emitStop(job, 0.299, { type: 'string', s: 'red' });
  expect(out(job)).toBe('<stop offset="0.299" style="stop-color:red;stop-opacity:1.;"/>\n');
}

export function testStopOffset0300(): void {
  const job = makeJob();
  emitStop(job, 0.3, { type: 'string', s: 'blue' });
  expect(out(job)).toBe('<stop offset="0.300" style="stop-color:blue;stop-opacity:1.;"/>\n');
}

export function testStopTransparent(): void {
  const job = makeJob();
  emitStop(job, 0, { type: 'string', s: 'transparent' });
  expect(out(job)).toBe('<stop offset="0" style="stop-color:black;stop-opacity:0;"/>\n');
}

// ---------------------------------------------------------------------------
// gradientId test bodies
// ---------------------------------------------------------------------------

export function testGradIdNoObjId(): void {
  expect(gradientId(null, 'l', 0)).toBe('l_0');
  expect(gradientId(null, 'r', 3)).toBe('r_3');
}

export function testGradIdWithObjId(): void {
  expect(gradientId('node1', 'l', 0)).toBe('node1_l_0');
  expect(gradientId('foo&bar', 'r', 2)).toBe('foo&amp;bar_r_2');
}

// ---------------------------------------------------------------------------
// emitLinearGradient test bodies
// Oracle: x1="0" y1="-18" x2="54" y2="-18" for red:blue, angle=0
// ---------------------------------------------------------------------------

function makeLinearJob(): RenderJob {
  const job = makeJob();
  const obj = createObjState();
  obj.id = 'node1';
  obj.fill = FillType.Linear;
  obj.fillColor = { type: 'string', s: 'red' };
  obj.stopColor = { type: 'string', s: 'blue' };
  obj.gradientAngle = 0;
  obj.gradientFrac = 0;
  job.pushObj(obj);
  return job;
}

export function testLinearGradOracle(): void {
  const job = makeLinearJob();
  const ptsUp = [{ x: 27, y: 18 }, { x: 54, y: 36 }];
  emitLinearGradient(job, ptsUp, 'node1_l_0');
  expect(out(job)).toBe(
    '<defs>\n' +
    '<linearGradient id="node1_l_0" gradientUnits="userSpaceOnUse" ' +
    'x1="0" y1="-18" x2="54" y2="-18" >\n' +
    '<stop offset="0" style="stop-color:red;stop-opacity:1.;"/>\n' +
    '<stop offset="1" style="stop-color:blue;stop-opacity:1.;"/>\n' +
    '</linearGradient>\n</defs>\n',
  );
}

export function testLinearGradFrac03(): void {
  const job = makeLinearJob();
  job.obj!.gradientFrac = 0.3;
  const ptsUp = [{ x: 27, y: 18 }, { x: 54, y: 36 }];
  emitLinearGradient(job, ptsUp, 'node1_l_0');
  expect(out(job)).toContain('offset="0.299"');
  expect(out(job)).toContain('offset="0.300"');
}

// ---------------------------------------------------------------------------
// emitRadialGradient test bodies
// Oracle: cx="50%" cy="50%" r="75%" fx="50%" fy="50%" (angle=0)
// ---------------------------------------------------------------------------

export function testRadialGradOracle(): void {
  const job = makeJob();
  const obj = createObjState();
  obj.id = 'node1';
  obj.fill = FillType.Radial;
  obj.fillColor = { type: 'string', s: 'red' };
  obj.stopColor = { type: 'string', s: 'blue' };
  obj.gradientAngle = 0;
  obj.gradientFrac = 0;
  job.pushObj(obj);
  emitRadialGradient(job, 'node1_r_0');
  expect(out(job)).toBe(
    '<defs>\n' +
    '<radialGradient id="node1_r_0" cx="50%" cy="50%" r="75%" fx="50%" fy="50%">\n' +
    '<stop offset="0" style="stop-color:red;stop-opacity:1.;"/>\n' +
    '<stop offset="1" style="stop-color:blue;stop-opacity:1.;"/>\n' +
    '</radialGradient>\n</defs>\n',
  );
}

// ---------------------------------------------------------------------------
// describe blocks — thin wrappers calling the named bodies above
// ---------------------------------------------------------------------------

describe('getGradientPoints', () => {
  it('linear angle=0 two-point ellipse matches oracle', () => testLinearAngle0());
  it('linear angle=90deg rotates gradient line to vertical', () => testLinearAngle90());
  it('linear n-point polygon uses bbox scan', () => testLinearNPoint());
  it('radial returns center and radii', () => testRadialReturnsRadii());
});

describe('emitStop', () => {
  it('offset 0 emits literal "0"', () => testStopOffset0());
  it('offset 1 emits literal "1"', () => testStopOffset1());
  it('offset 0.299 emits 3-decimal "0.299"', () => testStopOffset0299());
  it('offset 0.300 emits 3-decimal "0.300"', () => testStopOffset0300());
  it('transparent → stop-color:black stop-opacity:0', () => testStopTransparent());
});

describe('gradientId', () => {
  it('no obj id → kind_n', () => testGradIdNoObjId());
  it('with obj id → escapedId_kind_n', () => testGradIdWithObjId());
});

describe('emitLinearGradient', () => {
  beforeEach(() => { /* setup done per-test via makeLinearJob */ });
  it('angle=0 red:blue matches C oracle conformant', () => testLinearGradOracle());
  it('frac=0.3 → stops 0.299 and 0.300', () => testLinearGradFrac03());
});

describe('emitRadialGradient', () => {
  it('angle=0 matches C oracle cx/cy/r/fx/fy', () => testRadialGradOracle());
});
