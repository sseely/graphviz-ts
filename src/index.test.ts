// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from 'vitest';
import { renderSvg, tryRenderSvg, RenderError, ParseError } from './index.js';

const VALID = 'digraph { a -> b }';

describe('tryRenderSvg success', () => {
  it('returns svg and no errors for a valid graph (XOR)', () => {
    const r = tryRenderSvg(VALID, 'dot');
    expect(typeof r.svg).toBe('string');
    expect(r.svg!.length).toBeGreaterThan(0);
    expect(r.errors).toBeUndefined();
  });
});

describe('tryRenderSvg syntax failure', () => {
  it('returns one structured syntax error with a location', () => {
    const r = tryRenderSvg('digraph { a ->', 'dot');
    expect(r.svg).toBeUndefined();
    expect(r.errors).toHaveLength(1);
    const e = r.errors![0]!;
    expect(e.type).toBe('syntax');
    expect(e.code).toBe('SYNTAX_UNEXPECTED_EOF');
    expect(e.location).toBeDefined();
    expect(e.location!.line).toBeGreaterThanOrEqual(1);
  });

  it('returns a plain JSON-serializable object with no stack', () => {
    const r = tryRenderSvg('digraph { a ->', 'dot');
    const e = r.errors![0]!;
    expect('stack' in e).toBe(false);
    const round = JSON.parse(JSON.stringify(e));
    expect(round.type).toBe(e.type);
    expect(round.code).toBe(e.code);
    expect(round.message).toBe(e.message);
    expect(round.friendlyMessage).toBe(e.friendlyMessage);
  });
});

describe('render-stage failure', () => {
  it('tryRenderSvg classifies an unregistered engine as RENDER_ERROR', () => {
    const r = tryRenderSvg(VALID, 'bogus');
    expect(r.svg).toBeUndefined();
    expect(r.errors![0]!.type).toBe('render');
    expect(r.errors![0]!.code).toBe('RENDER_ERROR');
  });

  it('renderSvg throws a structured Error (not a bare Error)', () => {
    let err: unknown;
    try { renderSvg(VALID, 'bogus'); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RenderError);
    expect((err as RenderError).code).toBe('RENDER_ERROR');
  });
});

describe('exports', () => {
  it('re-exports ParseError and RenderError', () => {
    expect(new ParseError('x', 'SYNTAX_ERROR', { line: 1, column: 1 })).toBeInstanceOf(Error);
    expect(new RenderError('x')).toBeInstanceOf(Error);
  });
});
