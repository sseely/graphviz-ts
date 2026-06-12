// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for htmltable-emit.ts: verifies that fontFlags and fontColor
 * from PlacedLine survive unchanged into the TextSpan passed to textspan().
 */

import { describe, it, expect, vi } from 'vitest';
import type { PlacedLine } from './htmltable-pos.js';
import type { RenderJob } from '../gvc/job.js';
import type { TextSpan } from './emit-types.js';
import { HTML_BF, HTML_IF, HTML_UL } from './emit-types.js';
import { emitHtmlLine } from './htmltable-emit.js';

// ---------------------------------------------------------------------------
// Minimal RenderJob stub that captures textspan calls
// ---------------------------------------------------------------------------

function makeStubJob(): { job: RenderJob; spans: Array<{ span: TextSpan }> } {
  const spans: Array<{ span: TextSpan }> = [];
  const job = {
    write: vi.fn(),
    printDouble: vi.fn(),
    output: [] as string[],
    pushObj: vi.fn(),
    popObj: vi.fn(),
    obj: null,
    bb: { ll: { x: 0, y: 0 }, ur: { x: 100, y: 80 } },
    devscale: { x: 1, y: -1 },
    translation: { x: 0, y: 0 },
    renderer: {
      textspan: vi.fn((_pos: unknown, span: TextSpan) => { spans.push({ span }); }),
      polygon: vi.fn(), ellipse: vi.fn(), bezier: vi.fn(),
      polyline: vi.fn(), beginNode: vi.fn(), endNode: vi.fn(),
      beginEdge: vi.fn(), endEdge: vi.fn(), beginGraph: vi.fn(), endGraph: vi.fn(),
      beginCluster: vi.fn(), endCluster: vi.fn(),
      type: 'svg', quality: 0,
    },
  } as unknown as RenderJob;
  return { job, spans };
}

function makeLine(overrides: Partial<PlacedLine> = {}): PlacedLine {
  return {
    text: 'hi', x: 0, baseline: 0, width: 10,
    fontSize: 12, fontName: 'Times,serif', fontColor: 'black', fontFlags: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test bodies
// ---------------------------------------------------------------------------

export function testEmitLinePlainFontFlagsZero(): void {
  const { job, spans } = makeStubJob();
  emitHtmlLine(makeLine(), { x: 0, y: 0 }, job.renderer as never, job);
  expect(spans[0]!.span.fontFlags).toBe(0);
}

export function testEmitLineBoldFlagSurvives(): void {
  const { job, spans } = makeStubJob();
  emitHtmlLine(makeLine({ fontFlags: HTML_BF }), { x: 0, y: 0 }, job.renderer as never, job);
  expect(spans[0]!.span.fontFlags).toBe(HTML_BF);
}

export function testEmitLineItalicFlagSurvives(): void {
  const { job, spans } = makeStubJob();
  emitHtmlLine(makeLine({ fontFlags: HTML_IF }), { x: 0, y: 0 }, job.renderer as never, job);
  expect(spans[0]!.span.fontFlags).toBe(HTML_IF);
}

export function testEmitLineUnderlineFlagSurvives(): void {
  const { job, spans } = makeStubJob();
  emitHtmlLine(makeLine({ fontFlags: HTML_UL }), { x: 0, y: 0 }, job.renderer as never, job);
  expect(spans[0]!.span.fontFlags).toBe(HTML_UL);
}

export function testEmitLineCombinedFlagsSurvive(): void {
  const { job, spans } = makeStubJob();
  emitHtmlLine(makeLine({ fontFlags: HTML_BF | HTML_IF }), { x: 0, y: 0 }, job.renderer as never, job);
  expect(spans[0]!.span.fontFlags).toBe(HTML_BF | HTML_IF);
}

export function testEmitLineFontColorSurvives(): void {
  const { job, spans } = makeStubJob();
  emitHtmlLine(makeLine({ fontColor: 'red' }), { x: 0, y: 0 }, job.renderer as never, job);
  expect(spans[0]!.span.fontColor).toBe('red');
}

// ---------------------------------------------------------------------------
// describe / it registrations
// ---------------------------------------------------------------------------

describe('emitHtmlLine fontFlags passthrough', () => {
  it('plain line has fontFlags=0', testEmitLinePlainFontFlagsZero);
  it('HTML_BF survives to TextSpan', testEmitLineBoldFlagSurvives);
  it('HTML_IF survives to TextSpan', testEmitLineItalicFlagSurvives);
  it('HTML_UL survives to TextSpan', testEmitLineUnderlineFlagSurvives);
  it('combined flags survive to TextSpan', testEmitLineCombinedFlagsSurvive);
  it('fontColor survives to TextSpan', testEmitLineFontColorSurvives);
});
