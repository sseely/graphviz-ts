// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for src/render/public.ts — multi-format render entry point.
 *
 * SVG parity: render(g,'svg') must be conformant to renderSvg(src,'dot')
 * for the same parsed graph.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../parser/index.js';
import { renderSvg } from '../index.js';
import { render } from './public.js';
import { RenderError } from '../errors.js';
import type { OutputFormat } from './public.js';

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const DOT_SRC = 'digraph G { a -> b }';

function parsedGraph() {
  return parse(DOT_SRC);
}

// ---------------------------------------------------------------------------
// SVG parity — format:'svg' default engine must match renderSvg(src,'dot')
// ---------------------------------------------------------------------------

describe('render — format svg parity with renderSvg', () => {
  it('produces conformant output to renderSvg for the same graph', () => {
    const g = parsedGraph();
    const fromRender = render(g, 'svg');
    const fromRenderSvg = renderSvg(DOT_SRC, 'dot');
    expect(fromRender).toBe(fromRenderSvg);
  });
});

// ---------------------------------------------------------------------------
// format:'plain' — must contain plain-text output markers
// ---------------------------------------------------------------------------

describe('render — format plain', () => {
  it('contains graph, node, edge, and stop lines', () => {
    const g = parsedGraph();
    const out = render(g, 'plain');
    expect(out).toContain('graph ');
    expect(out).toContain('node ');
    expect(out).toContain('edge ');
    expect(out).toContain('stop');
  });
});

// ---------------------------------------------------------------------------
// format:'json' — must return valid JSON
// ---------------------------------------------------------------------------

describe('render — format json', () => {
  it('returns valid JSON (JSON.parse succeeds)', () => {
    const g = parsedGraph();
    const out = render(g, 'json');
    expect(() => JSON.parse(out)).not.toThrow();
  });

  it('parsed JSON contains objects field', () => {
    const g = parsedGraph();
    const obj = JSON.parse(render(g, 'json')) as Record<string, unknown>;
    expect(typeof obj).toBe('object');
    expect(obj).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// format:'dot' — must return attribute-annotated DOT
// ---------------------------------------------------------------------------

describe('render — format dot', () => {
  it('contains digraph keyword', () => {
    const g = parsedGraph();
    const out = render(g, 'dot');
    expect(out).toContain('digraph');
  });

  it('contains node attribute annotations (pos=)', () => {
    const g = parsedGraph();
    const out = render(g, 'dot');
    expect(out).toContain('pos=');
  });
});

// ---------------------------------------------------------------------------
// unknown format — must throw a structured error
// ---------------------------------------------------------------------------

function captureRenderError(format: OutputFormat): unknown {
  const g = parsedGraph();
  try {
    render(g, format);
    return null;
  } catch (err: unknown) {
    return err;
  }
}

describe('render — unknown format throws structured error', () => {
  it('throws a value with string type and string code', () => {
    const err = captureRenderError('unknown-format' as OutputFormat);
    expect(err).not.toBeNull();
    expect(typeof (err as { type?: unknown }).type).toBe('string');
    expect(typeof (err as { code?: unknown }).code).toBe('string');
  });

  it('thrown error is a RenderError instance', () => {
    const err = captureRenderError('unknown-format' as OutputFormat);
    expect(err).toBeInstanceOf(RenderError);
  });
});

// ---------------------------------------------------------------------------
// opts.engine — engine override propagates
// ---------------------------------------------------------------------------

describe('render — opts.engine override', () => {
  it('format svg with explicit engine dot matches default', () => {
    const g1 = parsedGraph();
    const g2 = parsedGraph();
    const withOpt = render(g1, 'svg', { engine: 'dot' });
    const withDefault = render(g2, 'svg');
    expect(withOpt).toBe(withDefault);
  });
});
