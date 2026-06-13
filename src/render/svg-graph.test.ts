// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for svg-graph.ts bgcolor resolution and background polygon emission.
 *
 * Oracle-verified against dot 15.0.0 -Tsvg output.
 *
 * @see lib/common/emit.c:emit_background:1476
 * @see plugin/core/gvrender_core_svg.c:svg_begin_page
 */

import { describe, it, expect } from 'vitest';
import { RenderJob } from '../gvc/job.js';
import type { TextMeasurer } from '../common/textmeasure.js';
import type { Box } from '../model/geom.js';
import { resolveGraphBgcolor, emitGraphBackground } from './svg-graph.js';

const measurer: TextMeasurer = { measure: () => ({ w: 0, h: 0 }) };

function makeJob(): RenderJob {
  const j = new RenderJob('svg', measurer);
  j.bb = { ll: { x: 0, y: 0 }, ur: { x: 100, y: 80 } };
  return j;
}

const testBb: Box = { ll: { x: 0, y: 0 }, ur: { x: 100, y: 80 } };

// ---------------------------------------------------------------------------
// resolveGraphBgcolor — pure resolver
// ---------------------------------------------------------------------------

describe('resolveGraphBgcolor — default white', () => {
  it('returns "white" when bgcolor attr is absent', () => {
    // emit_background:1483-1485: if no bgcolor specified → "white"
    expect(resolveGraphBgcolor(undefined)).toBe('white');
  });

  it('returns "white" when bgcolor attr is empty string', () => {
    expect(resolveGraphBgcolor('')).toBe('white');
  });

  it('returns named color as-is', () => {
    expect(resolveGraphBgcolor('lightyellow')).toBe('lightyellow');
  });

  it('returns hex color as-is', () => {
    expect(resolveGraphBgcolor('#ffffcc')).toBe('#ffffcc');
  });
});

describe('resolveGraphBgcolor — transparent', () => {
  it('returns transparent sentinel for "transparent" on SVG (truecolor)', () => {
    // emit_background:1498-1499: SVG has GVDEVICE_DOES_TRUECOLOR → no polygon
    // We encode this as the BGCOLOR_TRANSPARENT sentinel (private constant).
    // The returned value is NOT 'white' and NOT 'transparent' — it is a sentinel
    // that causes emitGraphBackground to emit nothing.
    const result = resolveGraphBgcolor('transparent');
    expect(result).not.toBe('white');
    expect(result).not.toBe('transparent');
    // Round-trip: the sentinel suppresses the polygon
    const job = makeJob();
    emitGraphBackground(testBb, result, job);
    expect(job.output.join('')).toBe('');
  });
});

describe('resolveGraphBgcolor — gradient AD3', () => {
  it('returns first color from gradient spec', () => {
    // AD3: gradient "c1:c2" → first solid color
    expect(resolveGraphBgcolor('lightyellow:white')).toBe('lightyellow');
  });
});

// ---------------------------------------------------------------------------
// emitGraphBackground — polygon output
// ---------------------------------------------------------------------------

describe('emitGraphBackground — default white', () => {
  it('emits white polygon (byte-stable default)', () => {
    // Oracle: dot -Tsvg with no bgcolor → fill="white" stroke="none"
    const job = makeJob();
    emitGraphBackground(testBb, 'white', job);
    const out = job.output.join('');
    expect(out).toContain('fill="white"');
    expect(out).toContain('stroke="none"');
    expect(out).toContain('<polygon');
  });

  it('white polygon has same coords as original hardcoded white', () => {
    // Coordinate math unchanged: left=ll.x-4, right=ur.x+4, etc.
    const job = makeJob();
    emitGraphBackground(testBb, 'white', job);
    const out = job.output.join('');
    // With bb={ll:{0,0},ur:{100,80}}, SVG_PAD=4:
    // left=-4, right=104, top=-(84), bottom=4
    expect(out).toContain('-4,4');
    expect(out).toContain('-4,-84');
    expect(out).toContain('104,-84');
    expect(out).toContain('104,4');
  });
});

describe('emitGraphBackground — named bgcolor', () => {
  it('emits polygon with lightyellow fill', () => {
    // Oracle: digraph G {bgcolor=lightyellow;a} → fill="lightyellow" stroke="none"
    const job = makeJob();
    emitGraphBackground(testBb, 'lightyellow', job);
    const out = job.output.join('');
    expect(out).toContain('fill="lightyellow"');
    expect(out).toContain('stroke="none"');
    expect(out).toContain('<polygon');
  });

  it('lightyellow polygon has same coords as white (only color differs)', () => {
    const jobWhite = makeJob();
    const jobYellow = makeJob();
    emitGraphBackground(testBb, 'white', jobWhite);
    emitGraphBackground(testBb, 'lightyellow', jobYellow);
    const outW = jobWhite.output.join('').replace('fill="white"', 'fill="X"');
    const outY = jobYellow.output.join('').replace('fill="lightyellow"', 'fill="X"');
    // Same coords — only color differs
    expect(outW).toBe(outY);
  });
});

describe('emitGraphBackground — transparent omits polygon', () => {
  it('emits nothing when resolvedColor is the transparent sentinel', () => {
    // Oracle: digraph G {bgcolor=transparent} on SVG → no background polygon
    const job = makeJob();
    const sentinel = resolveGraphBgcolor('transparent');
    emitGraphBackground(testBb, sentinel, job);
    expect(job.output.join('')).toBe('');
  });
});
