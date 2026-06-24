// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

/**
 * cl_bound: an edge that routes past a cluster (neither endpoint inside it) has
 * its corridor box clamped to the cluster boundary, so the spline bends around
 * the cluster corner instead of cutting straight through.
 * @see lib/dotgen/dotsplines.c:cl_bound / maximal_bbox
 *
 * Fixture is the corpus graphs/url.gv: lang and colors sit outside cluster0
 * (command/name), and lang->colors routes around cluster0's left edge.
 */
const URL_GV = `digraph G {
  URL="http://www.graphviz.org/doc/info/output.html"
  label=output
  lang [ URL="http://www.graphviz.org/doc/info/lang.html" ]
  colors [
    style=filled fillcolor=lightblue
    URL="http://www.graphviz.org/doc/info/output.html"
    label=<<table href="http://www.graphviz.org/doc/info/colors.html"><tr><td BGCOLOR="green">colors</td></tr></table>>];
  subgraph cluster0 {
    style=filled fillcolor=yellow
    URL="http://www.graphviz.org/doc/info/arrows.html"
    label=arrows
    command [ style=filled fillcolor=grey URL="http://www.graphviz.org/doc/info/command.html" ]
    name [ URL="\\G \\N"]
  }
  lang -> command [ URL="http://www.graphviz.org/doc/info/shapes.html" ]
  lang -> colors [ URL="\\E" edgetooltip=self ]
  lang -> size [ URL="headurl" edgetooltip=headurl headlabel=size headURL=headsize]
  word -> size [ URL="tailurl" taillabel=size tailURL=tailsize]
  word -> garf [ URL="labelurl" label=garf labelURL=garf]
  line -> all [ label=garf labelURL=garf headlabel=headlabel taillabel=taillabel ]
}`;

function edgePath(svg: string, title: string): string {
  const re = new RegExp(`<title>${title}</title>[\\s\\S]*?<path fill="none"[^>]*d="([^"]*)"`);
  return svg.match(re)?.[1] ?? '';
}

/** Cubic-segment count: SVG groups consecutive cubics under one `C`, so count
 *  coordinate pairs — `M p0 C p1 p2 p3 [p4 p5 p6 …]` is (pairs-1)/3 cubics. */
function cubics(d: string): number {
  return Math.round(((d.match(/,/g) ?? []).length - 1) / 3);
}

describe('cluster-bypass edge routing (cl_bound)', () => {
  it('routes lang->colors as a multi-segment spline that bends at the cluster', () => {
    const svg = renderSvg(URL_GV, 'dot');
    const d = edgePath(svg, 'lang&#45;&gt;colors');
    expect(d.length).toBeGreaterThan(0);
    // The clamp forces a bend at cluster0's corner -> 2 cubics; the pre-cl_bound
    // straight shot was a single cubic.
    expect(cubics(d)).toBeGreaterThanOrEqual(2);
  });

  it('keeps a cluster-free edge (word->size) a single cubic', () => {
    const svg = renderSvg(URL_GV, 'dot');
    expect(cubics(edgePath(svg, 'word&#45;&gt;size'))).toBe(1);
  });
});
