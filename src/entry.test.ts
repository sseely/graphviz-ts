// SPDX-License-Identifier: EPL-2.0

/**
 * Entry-point smoke test (T9 / ADR-2).
 *
 * Guards the three package entries — root `graphviz-ts`, `graphviz-ts/api`,
 * and `graphviz-ts/render` — by importing each barrel and asserting a
 * representative symbol resolves. This is the guard for the sole rollback
 * risk: the `package.json` "exports" map and the root re-exports must not
 * break the existing root import.
 */

import { describe, it, expect } from 'vitest';

// Root entry (existing public surface must remain intact).
import {
  renderSvg,
  tryRenderSvg,
  parse,
  RenderError,
  // New discoverable root re-exports (ADR-2).
  createGraph,
  getLayout,
  addEdge,
  render,
  getDrawOps,
} from './index.js';

// Subpath entries.
import * as apiEntry from './api/index.js';
import * as renderEntry from './render/index.js';

describe('root entry (graphviz-ts)', () => {
  it('keeps the existing public render surface', () => {
    expect(typeof renderSvg).toBe('function');
    expect(typeof tryRenderSvg).toBe('function');
    expect(typeof parse).toBe('function');
    expect(typeof RenderError).toBe('function');
  });

  it('renderSvg still produces SVG (non-breaking)', () => {
    const svg = renderSvg('digraph { a -> b }', 'dot');
    expect(svg.startsWith('<?xml')).toBe(true);
    expect(svg).toContain('<svg');
  });

  it('re-exports the api + render surfaces for discoverability', () => {
    expect(typeof createGraph).toBe('function');
    expect(typeof getLayout).toBe('function');
    expect(typeof addEdge).toBe('function');
    expect(typeof render).toBe('function');
    expect(typeof getDrawOps).toBe('function');
  });

  it('root `render` is the public render(g, format, opts), not the device render', () => {
    // The public render takes (graph, format) — render a parsed graph to dot.
    const g = parse('digraph { a -> b }');
    const out = render(g, 'dot');
    expect(out).toContain('a');
    expect(out).toContain('->');
  });
});

describe('graphviz-ts/api entry', () => {
  it('resolves the builder + geometry + edge-ops symbols', () => {
    expect(typeof apiEntry.createGraph).toBe('function');
    expect(typeof apiEntry.getLayout).toBe('function');
    expect(typeof apiEntry.addEdge).toBe('function');
  });
});

describe('graphviz-ts/render entry', () => {
  it('resolves the render + draw-ops symbols', () => {
    expect(typeof renderEntry.render).toBe('function');
    expect(typeof renderEntry.getDrawOps).toBe('function');
  });
});
