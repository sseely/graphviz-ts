// SPDX-License-Identifier: EPL-2.0

/**
 * Unit tests for withHtmlPaint gradient and solid branches.
 * @see lib/common/htmltable.c:setFill
 */

import { describe, it, expect, vi } from 'vitest';
import type { RenderJob } from '../gvc/job.js';
import type { ObjState } from '../gvc/job.js';
import type { Box } from '../model/geom.js';
import { FillType } from '../gvc/context.js';
import {
  withHtmlPaint, doBorder, htmlFillPenWidth, resetHtmlFillPenWidth,
  type HtmlPaint,
} from './htmltable-emit-fill.js';

function makeStubJob(): { job: RenderJob; captured: ObjState[] } {
  const captured: ObjState[] = [];
  const job = {
    write: vi.fn(), printDouble: vi.fn(), output: [] as string[],
    pushObj: vi.fn((obj: ObjState) => { captured.push({ ...obj }); }),
    popObj: vi.fn(), obj: null,
    bb: { ll: { x: 0, y: 0 }, ur: { x: 100, y: 80 } },
    devscale: { x: 1, y: -1 }, translation: { x: 0, y: 0 },
    renderer: {
      textspan: vi.fn(), polygon: vi.fn(), ellipse: vi.fn(), bezier: vi.fn(),
      polyline: vi.fn(), beginNode: vi.fn(), endNode: vi.fn(),
      beginEdge: vi.fn(), endEdge: vi.fn(), beginGraph: vi.fn(), endGraph: vi.fn(),
      beginCluster: vi.fn(), endCluster: vi.fn(), type: 'svg' as const, quality: 0,
    },
  } as unknown as RenderJob;
  return { job, captured };
}

function capturedObj(paint: HtmlPaint): ObjState {
  const { job, captured } = makeStubJob();
  withHtmlPaint(paint, job, () => {});
  return captured[0]!;
}

function colorStr(obj: ObjState, key: 'fillColor' | 'stopColor'): string | null {
  const c = obj[key];
  return c.type === 'string' ? c.s : null;
}

describe('withHtmlPaint — solid fill (regression)', () => {
  it('no stop → fill is Solid', () => {
    expect(capturedObj({ fill: 'yellow' }).fill).toBe(FillType.Solid);
  });
  it('no stop → fillColor resolves to the color string', () => {
    expect(colorStr(capturedObj({ fill: 'red' }), 'fillColor')).toBe('red');
  });
  it('no fill → fill is None', () => {
    expect(capturedObj({}).fill).toBe(FillType.None);
  });
});

describe('withHtmlPaint — linear gradient', () => {
  const linearPaint: HtmlPaint = { fill: 'yellow', stop: 'violet', gradientAngle: 315 };
  it('fill=Linear when stop present and radial absent', () => {
    expect(capturedObj(linearPaint).fill).toBe(FillType.Linear);
  });
  it('gradientAngle is threaded through', () => {
    expect(capturedObj(linearPaint).gradientAngle).toBe(315);
  });
  it('fillColor resolves to first stop color', () => {
    expect(colorStr(capturedObj(linearPaint), 'fillColor')).toBe('yellow');
  });
  it('stopColor resolves to second stop color', () => {
    expect(colorStr(capturedObj(linearPaint), 'stopColor')).toBe('violet');
  });
  it('gradientFrac is 0 for plain two-stop spec', () => {
    expect(capturedObj({ fill: 'red', stop: 'blue', gradientAngle: 90 }).gradientFrac).toBe(0);
  });
});

describe('withHtmlPaint — radial gradient', () => {
  it('fill=Radial when radial:true', () => {
    const obj = capturedObj({ fill: 'yellow', stop: 'violet', gradientAngle: 0, radial: true });
    expect(obj.fill).toBe(FillType.Radial);
  });
  it('radial:false keeps Linear', () => {
    const obj = capturedObj({ fill: 'yellow', stop: 'violet', gradientAngle: 0, radial: false });
    expect(obj.fill).toBe(FillType.Linear);
  });
});

describe('withHtmlPaint — pen width', () => {
  it('threads penWidth onto the pushed obj', () => {
    expect(capturedObj({ fill: 'yellow', penWidth: 3 }).penWidth).toBe(3);
  });
  it('defaults penWidth to 1 when omitted', () => {
    expect(capturedObj({ fill: 'yellow' }).penWidth).toBe(1.0);
  });
});

// The gvrender penwidth leak: a cell/table fill draws at the pen width left by
// the *prior* doBorder, reset to 1.0 per top-level table. @see htmltable.c:doBorder
describe('html fill pen-width leak state', () => {
  const box: Box = { ll: { x: 0, y: 0 }, ur: { x: 20, y: 20 } };
  it('reset returns the leaked pen width to 1.0', () => {
    resetHtmlFillPenWidth();
    expect(htmlFillPenWidth()).toBe(1.0);
  });
  it('doBorder leaks its border width into the next fill', () => {
    const { job } = makeStubJob();
    resetHtmlFillPenWidth();
    doBorder({ box, pos: { x: 0, y: 0 }, border: 3, color: 'black' }, job.renderer!, job);
    expect(htmlFillPenWidth()).toBe(3);
    resetHtmlFillPenWidth();
    expect(htmlFillPenWidth()).toBe(1.0);
  });
});
