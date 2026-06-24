// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for viewport.ts — drawing-size parse, viewport zoom, and landscape
 * detection (parseLandscape, orientation=land mission T1).
 *
 * @see lib/common/input.c:476 getdoubles2ptf
 * @see lib/common/input.c:699-704 (rotate/orientation/landscape)
 */

import { describe, it, expect } from 'vitest';
import { parseLandscape } from './viewport.js';
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
