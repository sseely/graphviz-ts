// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from 'vitest';
import { parseLayers, selectedLayer, type LayerInfo } from './layers.js';
import { renderSvg } from '../index.js';

function infoFor(layers: string): LayerInfo {
  return parseLayers({ attrs: new Map([['layers', layers]]) } as never);
}

describe('layers — parse + selectedLayer', () => {
  it('parses the layer list (index 1..N) with the default separator', () => {
    const L = infoFor('a:b:c');
    expect(L.numLayers).toBe(3);
    expect(L.layerIDs).toEqual([null, 'a', 'b', 'c']);
  });

  it('numLayers is 1 when there is no layers attribute', () => {
    expect(parseLayers({ attrs: new Map() } as never).numLayers).toBe(1);
  });

  it('a named spec selects only its layer', () => {
    const L = infoFor('a:b:c');
    expect(selectedLayer(L, 2, 'b')).toBe(true);
    expect(selectedLayer(L, 1, 'b')).toBe(false);
  });

  it('a range spec selects the inclusive interval', () => {
    const L = infoFor('a:b:c:d');
    expect(selectedLayer(L, 3, 'b:d')).toBe(true);
    expect(selectedLayer(L, 1, 'b:d')).toBe(false);
  });

  it('"all" and numeric and comma-list specs work', () => {
    const L = infoFor('a:b:c');
    expect(selectedLayer(L, 3, 'all')).toBe(true);
    expect(selectedLayer(L, 2, '2')).toBe(true);
    expect(selectedLayer(L, 3, 'a,c')).toBe(true);
  });
});

describe('layers — SVG output', () => {
  const SRC = 'digraph G { layers="one:two"; a [layer="two"]; b; a -> b; }';

  it('wraps the drawing in one <g class="layer"> per layer', () => {
    const svg = renderSvg(SRC, 'dot');
    expect((svg.match(/class="layer"/g) ?? []).length).toBe(2);
    expect(svg).toContain('<g id="one" class="layer">');
    expect(svg).toContain('<g id="two" class="layer">');
  });

  it('prefixes ids on layers after the first; nodes also get the suffix', () => {
    const svg = renderSvg(SRC, 'dot');
    expect(svg).toContain('two_graph0'); // graph group: prefix only
    expect(svg).toMatch(/two_node\d+_two/); // node: prefix + suffix
  });

  it('renders a single pass (no layer groups) when there is no layers attr', () => {
    const svg = renderSvg('digraph G { a -> b; }', 'dot');
    expect(svg).not.toContain('class="layer"');
  });
});
