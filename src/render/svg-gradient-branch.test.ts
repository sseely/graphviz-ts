// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for the gradient branch added to svgEllipse/svgPolygon/svgBezier
 * in svg-helpers.ts (AD2, AD3). Oracle-verified against C graphviz 15.0.0.
 *
 * Acceptance criteria (from G2 task spec):
 *  - Linear: svgEllipse emits <defs><linearGradient id="l_0"> + stops +
 *            <ellipse fill="url(#l_0)"> — matching C oracle byte-for-byte.
 *  - Radial: id="r_0", fill="url(#r_0)".
 *  - Second gradient in same job → l_1 / r_1.
 *  - Solid fill unchanged; None fill → fill="none".
 *  - 97 goldens byte-identical (solid/none paths frozen).
 */

import { describe, it, expect } from 'vitest';
import { svgEllipse, svgPolygon, svgBezier } from './svg-helpers.js';
import { RenderJob, createObjState } from '../gvc/job.js';
import { FillType } from '../gvc/context.js';
import type { TextMeasurer } from '../common/textmeasure.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const measurer: TextMeasurer = { measure: () => ({ w: 0, h: 0 }) };
function makeJob(): RenderJob { return new RenderJob('svg', measurer); }
function out(job: RenderJob): string { return job.output.join(''); }

function makeLinearObj(): ReturnType<typeof createObjState> {
  const obj = createObjState();
  obj.id = 'node1';
  obj.fill = FillType.Linear;
  obj.fillColor = { type: 'string', s: 'red' };
  obj.stopColor = { type: 'string', s: 'blue' };
  obj.gradientAngle = 0;
  obj.gradientFrac = 0;
  return obj;
}

// ---------------------------------------------------------------------------
// svgEllipse gradient branch test bodies
// Oracle: printf 'digraph{a[style=filled,fillcolor="red:blue"]}' | dot -Tsvg
// Expected (node1, cx=27 cy=-18 rx=27 ry=18):
//   <defs>\n<linearGradient id="node1_l_0" … x1="0" y1="-18" x2="54" y2="-18" >
//   …stops… </linearGradient>\n</defs>\n
//   <ellipse fill="url(#node1_l_0)" stroke="black" cx="27" cy="-18" rx="27" ry="18"/>
// ---------------------------------------------------------------------------

export function testEllipseLinearOracleMatch(): void {
  const job = makeJob();
  const obj = makeLinearObj();
  job.pushObj(obj);
  // center=(27,-18) is SVG y-down; rx=27, ry=18
  svgEllipse({ x: 27, y: -18 }, 27, 18, true, job);
  const result = out(job);
  expect(result).toContain('<defs>\n<linearGradient id="node1_l_0"');
  expect(result).toContain('x1="0" y1="-18" x2="54" y2="-18" >\n');
  expect(result).toContain('<stop offset="0" style="stop-color:red;stop-opacity:1.;"/>');
  expect(result).toContain('<stop offset="1" style="stop-color:blue;stop-opacity:1.;"/>');
  expect(result).toContain('</linearGradient>\n</defs>\n');
  expect(result).toContain('<ellipse fill="url(#node1_l_0)" stroke="black"');
  expect(result).toContain('cx="27" cy="-18" rx="27" ry="18"/>');
}

export function testEllipseRadialOracleMatch(): void {
  const job = makeJob();
  const obj = createObjState();
  obj.id = 'node1';
  obj.fill = FillType.Radial;
  obj.fillColor = { type: 'string', s: 'red' };
  obj.stopColor = { type: 'string', s: 'blue' };
  obj.gradientAngle = 0;
  obj.gradientFrac = 0;
  job.pushObj(obj);
  svgEllipse({ x: 27, y: -18 }, 27, 18, true, job);
  const result = out(job);
  expect(result).toContain('<defs>\n<radialGradient id="node1_r_0"');
  expect(result).toContain('cx="50%" cy="50%" r="75%" fx="50%" fy="50%"');
  expect(result).toContain('<ellipse fill="url(#node1_r_0)" stroke="black"');
}

export function testSecondGradientIncrementsCounter(): void {
  const job = makeJob();
  // First linear ellipse → l_0
  const obj1 = makeLinearObj();
  job.pushObj(obj1);
  svgEllipse({ x: 27, y: -18 }, 27, 18, true, job);
  job.popObj();
  // Second linear ellipse → l_1
  const obj2 = makeLinearObj();
  obj2.id = 'node2';
  job.pushObj(obj2);
  svgEllipse({ x: 27, y: -18 }, 27, 18, true, job);
  job.popObj();
  const result = out(job);
  expect(result).toContain('id="node1_l_0"');
  expect(result).toContain('id="node2_l_1"');
  expect(result).toContain('fill="url(#node1_l_0)"');
  expect(result).toContain('fill="url(#node2_l_1)"');
}

export function testSolidFillUnchanged(): void {
  // Solid fill must be byte-identical to pre-G2 behavior
  const job = makeJob();
  const obj = createObjState();
  obj.fill = FillType.Solid;
  obj.fillColor = { type: 'string', s: 'lightblue' };
  job.pushObj(obj);
  svgEllipse({ x: 27, y: -18 }, 27, 18, true, job);
  const result = out(job);
  expect(result).not.toContain('<defs>');
  expect(result).not.toContain('url(#');
  expect(result).toContain('fill="lightblue"');
  expect(result).toContain('<ellipse');
}

export function testNoneFillUnchanged(): void {
  const job = makeJob();
  const obj = createObjState();
  obj.fill = FillType.None;
  job.pushObj(obj);
  svgEllipse({ x: 27, y: -18 }, 27, 18, false, job);
  const result = out(job);
  expect(result).not.toContain('<defs>');
  expect(result).toContain('fill="none"');
}

// ---------------------------------------------------------------------------
// svgPolygon gradient branch
// ---------------------------------------------------------------------------

export function testPolygonLinearGradient(): void {
  const job = makeJob();
  const obj = makeLinearObj();
  obj.id = null;
  job.pushObj(obj);
  const pts = [{ x: 0, y: 0 }, { x: 54, y: 0 }, { x: 54, y: -36 }, { x: 0, y: -36 }];
  svgPolygon(pts, true, job);
  const result = out(job);
  expect(result).toContain('<defs>\n<linearGradient id="l_0"');
  expect(result).toContain('<polygon fill="url(#l_0)"');
}

// ---------------------------------------------------------------------------
// svgBezier gradient branch
// ---------------------------------------------------------------------------

export function testBezierLinearGradient(): void {
  const job = makeJob();
  const obj = makeLinearObj();
  obj.id = null;
  job.pushObj(obj);
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 10 }, { x: 30, y: 0 }];
  svgBezier(pts, true, job);
  const result = out(job);
  expect(result).toContain('<defs>\n<linearGradient id="l_0"');
  expect(result).toContain('<path fill="url(#l_0)"');
}

// ---------------------------------------------------------------------------
// describe blocks
// ---------------------------------------------------------------------------

describe('svgEllipse gradient branch (AD2/AD3)', () => {
  it('linear: defs+gradient+ellipse matches C oracle', () => testEllipseLinearOracleMatch());
  it('radial: r_0 id and url(#r_0) fill', () => testEllipseRadialOracleMatch());
  it('second gradient in same job → l_1', () => testSecondGradientIncrementsCounter());
  it('solid fill is unchanged (no defs, no url)', () => testSolidFillUnchanged());
  it('none fill is unchanged (fill=none)', () => testNoneFillUnchanged());
});

describe('svgPolygon gradient branch (AD2/AD3)', () => {
  it('linear gradient emits defs before polygon', () => testPolygonLinearGradient());
});

describe('svgBezier gradient branch (AD2/AD3)', () => {
  it('linear gradient emits defs before path', () => testBezierLinearGradient());
});
