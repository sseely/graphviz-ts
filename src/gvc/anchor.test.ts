// SPDX-License-Identifier: EPL-2.0
// Anchor ids are dash-escaped per C gvputs_xml (a_edge1&#45;label) since fix-element-count T7.
import { describe, it, expect } from 'vitest';
import { renderSvg } from '../index.js';

/** Anchor (<a xlink:href>) emission across graph / cluster / node / edge and
 *  edge-label hot spots — @see lib/common/emit.c anchor machinery. */

describe('graph anchor', () => {
  it('wraps background + graph label in a_graph0 with the graph URL', () => {
    const svg = renderSvg('digraph G { URL="g.html" label=root a }', 'dot');
    expect(svg).toContain('<g id="a_graph0"><a xlink:href="g.html" xlink:title="root">');
  });

  it('emits no graph anchor when the graph has no URL', () => {
    const svg = renderSvg('digraph G { a }', 'dot');
    expect(svg).not.toContain('a_graph0');
  });
});

describe('cluster anchor', () => {
  it('wraps the cluster box + label in a_clust1 with the cluster URL', () => {
    const svg = renderSvg(
      'digraph { subgraph cluster0 { URL="c.html" label=clab a } }', 'dot');
    expect(svg).toContain('<g id="a_clust1"><a xlink:href="c.html" xlink:title="clab">');
  });
});

describe('whole-edge anchor', () => {
  it('wraps the edge spline in a_edge1 with the edge URL', () => {
    const svg = renderSvg('digraph { a -> b [URL="e.html"] }', 'dot');
    expect(svg).toContain('<g id="a_edge1"><a xlink:href="e.html">');
  });

  it('omits xlink:title when the edge has a URL but no explicit tooltip', () => {
    const svg = renderSvg('digraph { a -> b [URL="e.html"] }', 'dot');
    expect(svg).toContain('<a xlink:href="e.html">'); // no title attribute
  });

  it('emits xlink:title from edgetooltip', () => {
    const svg = renderSvg('digraph { a -> b [URL="e.html" edgetooltip="hi"] }', 'dot');
    expect(svg).toContain('<a xlink:href="e.html" xlink:title="hi">');
  });

  it('substitutes \\E in the edge URL to tail->head', () => {
    const svg = renderSvg('digraph { a -> b [URL="\\E"] }', 'dot');
    expect(svg).toContain('xlink:href="a-&gt;b"');
  });

  it('edgeURL overrides URL for the whole-edge anchor', () => {
    const svg = renderSvg('digraph { a -> b [URL="u" edgeURL="eu"] }', 'dot');
    expect(svg).toContain('<g id="a_edge1"><a xlink:href="eu"');
  });
});

describe('edge label sub-anchors', () => {
  it('wraps the head label in a_edge1&#45;headlabel with headURL', () => {
    const svg = renderSvg(
      'digraph { a -> b [headlabel=H headURL="h.html"] }', 'dot');
    expect(svg).toContain('<g id="a_edge1&#45;headlabel"><a xlink:href="h.html"');
  });

  it('wraps the tail label in a_edge1&#45;taillabel with tailURL', () => {
    const svg = renderSvg(
      'digraph { a -> b [taillabel=T tailURL="t.html"] }', 'dot');
    expect(svg).toContain('<g id="a_edge1&#45;taillabel"><a xlink:href="t.html"');
  });

  it('wraps the center label in a_edge1&#45;label with labelURL', () => {
    const svg = renderSvg(
      'digraph { a -> b [label=L labelURL="l.html"] }', 'dot');
    expect(svg).toContain('<g id="a_edge1&#45;label"><a xlink:href="l.html"');
  });

  it('does not wrap a label that has no url or explicit tooltip', () => {
    const svg = renderSvg('digraph { a -> b [label=L] }', 'dot');
    expect(svg).not.toContain('a_edge1&#45;label');
  });
});
