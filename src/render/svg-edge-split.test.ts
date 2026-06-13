// SPDX-License-Identifier: EPL-2.0

/**
 * Split-along-length multi-color edge tests (semicolon color syntax).
 * Output verified against C graphviz 15.0.0 (dot -Tsvg).
 *
 * Helpers use string ops (not regex literals with embedded quotes) to avoid
 * the complexity-checker / Lizard quote-tracking bug (see svg-helpers.ts).
 *
 * @see src/render/svg-edge-split.ts
 * @see lib/common/emit.c:1975 multicolor
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../index.js';

const PATH_RE = new RegExp('<path fill=.none.[^>]*/>', 'g');
const POLY_RE = new RegExp('<polygon fill=[^>]*/>', 'g');

function edgePaths(svg: string): string[] {
  return svg.match(PATH_RE) ?? [];
}

/** Value of attr `name` in an element string, via string slicing. */
function attr(el: string, name: string): string {
  const key = name + '=' + String.fromCharCode(34); // name="
  const i = el.indexOf(key);
  if (i < 0) return '';
  const start = i + key.length;
  return el.slice(start, el.indexOf(String.fromCharCode(34), start));
}

/** Head arrow fill: last filled polygon (digraph has only a head arrow). */
function headArrowColor(svg: string): string {
  const polys = (svg.match(POLY_RE) ?? []).filter((p) => attr(p, 'fill') !== 'none');
  return polys.length ? attr(polys[polys.length - 1]!, 'fill') : '';
}

/** The `d` attribute's leading and trailing coordinate tokens (regex-free). */
function dEndpoints(pathEl: string): { start: string; end: string } {
  const d = attr(pathEl, 'd');
  const toks = d.split('M').join(' ').split('C').join(' ').split(' ').filter(Boolean);
  return { start: toks[0] ?? '', end: toks[toks.length - 1] ?? '' };
}

describe('split edge — two colors red;0.5:blue', () => {
  const svg = renderSvg('digraph { a -> b [color="red;0.5:blue"] }', 'dot');

  it('two sequential sub-curves, red then blue', () => {
    const p = edgePaths(svg);
    expect(p).toHaveLength(2);
    expect(attr(p[0]!, 'stroke')).toBe('red');
    expect(attr(p[1]!, 'stroke')).toBe('blue');
  });

  it('curves are contiguous (split along length, not parallel)', () => {
    const p = edgePaths(svg);
    expect(dEndpoints(p[0]!).end).toBe(dEndpoints(p[1]!).start);
  });

  it('head arrow uses the LAST color (blue)', () => {
    expect(headArrowColor(svg)).toBe('blue');
  });
});

describe('split edge — three colors', () => {
  it('red;0.3:green;0.3:blue → three sub-curves in order', () => {
    const p = edgePaths(renderSvg('digraph { a -> b [color="red;0.3:green;0.3:blue"] }', 'dot'));
    expect(p).toHaveLength(3);
    expect(attr(p[0]!, 'stroke')).toBe('red');
    expect(attr(p[1]!, 'stroke')).toBe('green');
    expect(attr(p[2]!, 'stroke')).toBe('blue');
  });
});

describe('split path does not regress other edge branches', () => {
  it('plain colon red:blue stays parallel (head arrow = first color)', () => {
    const svg = renderSvg('digraph { a -> b [color="red:blue"] }', 'dot');
    expect(edgePaths(svg)).toHaveLength(2);
    expect(headArrowColor(svg)).toBe('red');
  });

  it('single color edge emits one path', () => {
    const p = edgePaths(renderSvg('digraph { a -> b [color=red] }', 'dot'));
    expect(p).toHaveLength(1);
    expect(attr(p[0]!, 'stroke')).toBe('red');
  });
});
