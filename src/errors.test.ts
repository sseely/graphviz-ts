// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from 'vitest';
import {
  FRIENDLY_MESSAGES,
  friendlyMessageFor,
  RenderError,
  type GvErrorCode,
} from './errors.js';

const ALL_CODES: GvErrorCode[] = [
  'SYNTAX_ERROR',
  'SYNTAX_UNEXPECTED_EOF',
  'EDGE_OP_DIRECTED_IN_UNDIRECTED',
  'EDGE_OP_UNDIRECTED_IN_DIRECTED',
  'HTML_PARSE_ERROR',
  'RENDER_ERROR',
  'GENERIC_ERROR',
];

describe('FRIENDLY_MESSAGES', () => {
  it('maps every code to a non-empty string', () => {
    for (const code of ALL_CODES) {
      expect(typeof FRIENDLY_MESSAGES[code]).toBe('string');
      expect(FRIENDLY_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });

  it('has exactly the seven known codes', () => {
    expect(Object.keys(FRIENDLY_MESSAGES).sort()).toEqual([...ALL_CODES].sort());
  });
});

describe('friendlyMessageFor', () => {
  it('returns a non-empty string for GENERIC_ERROR', () => {
    expect(friendlyMessageFor('GENERIC_ERROR')).toBe(
      FRIENDLY_MESSAGES.GENERIC_ERROR,
    );
    expect(friendlyMessageFor('GENERIC_ERROR').length).toBeGreaterThan(0);
  });

  it('returns the mapped message for each code', () => {
    for (const code of ALL_CODES) {
      expect(friendlyMessageFor(code)).toBe(FRIENDLY_MESSAGES[code]);
    }
  });
});

describe('RenderError', () => {
  it('defaults to RENDER_ERROR with render type and the given message', () => {
    const e = new RenderError('boom');
    expect(e.type).toBe('render');
    expect(e.code).toBe('RENDER_ERROR');
    expect(e.message).toBe('boom');
    expect(e.friendlyMessage).toBe(FRIENDLY_MESSAGES.RENDER_ERROR);
    expect(e.name).toBe('RenderError');
  });

  it('honors an explicit GENERIC_ERROR code', () => {
    const e = new RenderError('x', 'GENERIC_ERROR');
    expect(e.code).toBe('GENERIC_ERROR');
    expect(e.friendlyMessage).toBe(FRIENDLY_MESSAGES.GENERIC_ERROR);
  });

  it('is an Error instance', () => {
    expect(new RenderError('x') instanceof Error).toBe(true);
  });
});
