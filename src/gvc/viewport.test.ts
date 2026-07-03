// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for viewport.ts — drawing-size parse, viewport zoom, and landscape
 * detection (parseLandscape, orientation=land mission T1).
 *
 * @see lib/common/input.c:476 getdoubles2ptf
 * @see lib/common/input.c:699-704 (rotate/orientation/landscape)
 */

import { describe, it, expect } from 'vitest';
import { parseLandscape, parseGraphPad, parseGraphMargin, initJobViewportZoom } from './viewport.js';
import { SVG_PAD, SVG_MARGIN } from '../render/svg-helpers.js';
import { Graph as GraphClass } from '../model/graph.js';
import type { Graph } from '../model/graph.js';

function graphWith(attr: string, value: string): Graph {
  const g = new GraphClass('G', 'directed');
  g.attrs.set(attr, value);
  return g as unknown as Graph;
}

// ---------------------------------------------------------------------------
// parseLandscape — rotate/orientation/landscape precedence (input.c:699-704)
// ---------------------------------------------------------------------------

describe('parseLandscape — rotate/orientation/landscape precedence', () => {
  it('rotate=90 → landscape', () => {
    expect(parseLandscape(graphWith('rotate', '90'))).toBe(true);
  });
  it('rotate=45 → not landscape', () => {
    expect(parseLandscape(graphWith('rotate', '45'))).toBe(false);
  });
  it('orientation=landscape → landscape', () => {
    expect(parseLandscape(graphWith('orientation', 'landscape'))).toBe(true);
  });
  it('orientation=land → landscape (first char l)', () => {
    expect(parseLandscape(graphWith('orientation', 'land'))).toBe(true);
  });
  it('orientation=Landscape → landscape (uppercase L)', () => {
    expect(parseLandscape(graphWith('orientation', 'Landscape'))).toBe(true);
  });
  it('orientation=portrait → not landscape', () => {
    expect(parseLandscape(graphWith('orientation', 'portrait'))).toBe(false);
  });
  it('landscape=true → landscape', () => {
    expect(parseLandscape(graphWith('landscape', 'true'))).toBe(true);
  });
  it('landscape=false → not landscape', () => {
    expect(parseLandscape(graphWith('landscape', 'false'))).toBe(false);
  });
  it('landscape=yes → landscape (mapbool truthy spelling)', () => {
    expect(parseLandscape(graphWith('landscape', 'yes'))).toBe(true);
  });
  it('no rotation attr → not landscape', () => {
    expect(parseLandscape(new GraphClass('G', 'directed') as unknown as Graph)).toBe(false);
  });
  it('rotate precedence: rotate=0 wins over landscape=true', () => {
    const g = new GraphClass('G', 'directed');
    g.attrs.set('rotate', '0');
    g.attrs.set('landscape', 'true');
    expect(parseLandscape(g as unknown as Graph)).toBe(false);
  });
  it('orientation precedence: orientation=portrait wins over landscape=true', () => {
    const g = new GraphClass('G', 'directed');
    g.attrs.set('orientation', 'portrait');
    g.attrs.set('landscape', 'true');
    expect(parseLandscape(g as unknown as Graph)).toBe(false);
  });
});
// ---------------------------------------------------------------------------
// parseGraphPad — F2: `pad=` graph-attribute parse (init_gvc + init_job_pad)
// @see lib/common/emit.c:3241-3251 (attr read); :3290-3304 (fallback)
// ---------------------------------------------------------------------------

describe('parseGraphPad — sscanf("%lf,%lf") + init_job_pad fallback', () => {
  it('absent attr → default (SVG_PAD, 4pt both axes)', () => {
    expect(parseGraphPad(undefined)).toEqual({ x: SVG_PAD, y: SVG_PAD });
  });

  it('single value "2" → both axes 2in = 144pt', () => {
    expect(parseGraphPad('2')).toEqual({ x: 144, y: 144 });
  });

  it('two values "1,0.5" → independent x/y (72pt, 36pt)', () => {
    expect(parseGraphPad('1,0.5')).toEqual({ x: 72, y: 36 });
  });

  it('fractional single value "0.209" (2592.dot) → 15.048pt both axes', () => {
    const p = parseGraphPad('0.209');
    expect(p.x).toBeCloseTo(15.048, 6);
    expect(p.y).toBeCloseTo(15.048, 6);
  });

  it('unparsable garbage → default fallback (sscanf 0 matches)', () => {
    expect(parseGraphPad('nonsense')).toEqual({ x: SVG_PAD, y: SVG_PAD });
  });

  it('empty string → default fallback', () => {
    expect(parseGraphPad('')).toEqual({ x: SVG_PAD, y: SVG_PAD });
  });

  it('negative value accepted (no positivity check, unlike size=)', () => {
    expect(parseGraphPad('-1')).toEqual({ x: -72, y: -72 });
  });

  it('not rounded (unlike size=, no POINTS() macro)', () => {
    // 2.0 -> exactly 144 already; use a value where round() would differ.
    const p = parseGraphPad('1.0069444444'); // ~72.5/72
    expect(p.x).toBeCloseTo(72.5, 4);
  });
});

// ---------------------------------------------------------------------------
// initJobViewportZoom — pad threaded into the size= fit (F2 regression)
// @see lib/common/emit.c:3363-3368 (job->bb = bb ± job->pad before sz)
// ---------------------------------------------------------------------------

describe('initJobViewportZoom — pad affects the size= fit', () => {
  const bb = { ll: { x: 0, y: 0 }, ur: { x: 100, y: 100 } };
  const size = { x: 100, y: 100, filled: false };

  it('default pad (4,4): sz = 108x108, Z = 100/108', () => {
    const z = initJobViewportZoom(bb, size, { x: 4, y: 4 });
    expect(z).toBeCloseTo(100 / 108, 10);
  });

  it('larger pad (144,144, i.e. pad=2) shrinks Z further', () => {
    const zDefault = initJobViewportZoom(bb, size, { x: 4, y: 4 });
    const zPadded = initJobViewportZoom(bb, size, { x: 144, y: 144 });
    expect(zPadded).toBeLessThan(zDefault);
    expect(zPadded).toBeCloseTo(100 / 388, 10);
  });

  it('no size= (null) → Z stays 1 regardless of pad', () => {
    expect(initJobViewportZoom(bb, null, { x: 144, y: 144 })).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// parseGraphMargin — F6: `margin=` graph-attribute parse (init_gvc +
// init_job_margin). Same sscanf shape as pad=, different default (0 vs 4pt).
// @see lib/common/emit.c:3229-3239 (attr read); :3309-3331 (init_job_margin)
// ---------------------------------------------------------------------------

describe('parseGraphMargin — sscanf("%lf,%lf") + init_job_margin fallback', () => {
  it('absent attr -> default (SVG_MARGIN, 0pt both axes)', () => {
    expect(parseGraphMargin(undefined)).toEqual({ x: SVG_MARGIN, y: SVG_MARGIN });
  });

  it('single value "0.8" (1879.dot) -> both axes 0.8in = 57.6pt', () => {
    const m = parseGraphMargin('0.8');
    expect(m.x).toBeCloseTo(57.6, 6);
    expect(m.y).toBeCloseTo(57.6, 6);
  });

  it('two values "1,0.5" -> independent x/y (72pt, 36pt)', () => {
    expect(parseGraphMargin('1,0.5')).toEqual({ x: 72, y: 36 });
  });

  it('unparsable garbage -> default fallback (sscanf 0 matches)', () => {
    expect(parseGraphMargin('nonsense')).toEqual({ x: SVG_MARGIN, y: SVG_MARGIN });
  });

  it('empty string -> default fallback', () => {
    expect(parseGraphMargin('')).toEqual({ x: SVG_MARGIN, y: SVG_MARGIN });
  });

  it('negative value accepted (no positivity check, matching pad=)', () => {
    expect(parseGraphMargin('-1')).toEqual({ x: -72, y: -72 });
  });

  it('not rounded (unlike size=, no POINTS() macro)', () => {
    const m = parseGraphMargin('1.0069444444'); // ~72.5/72
    expect(m.x).toBeCloseTo(72.5, 4);
  });

  it('distinct default from parseGraphPad (0 vs 4)', () => {
    expect(parseGraphMargin(undefined)).not.toEqual(parseGraphPad(undefined));
  });
});
