// SPDX-License-Identifier: EPL-2.0
//
// Cluster style=invis + multi-line cluster labels (mission
// fix-element-count-bucket, T8, distilled from tests/2239.dot).
// C: gvrender_set_style maps "invis" to PEN_NONE (gvrender.c:497-498);
// gvrender_polygon (:543) and gvrender_textspan (:421) are pen-gated, so an
// invis cluster emits its group + title but no box and no label text.
// Multi-line cluster labels advance the baseline per span
// (labels.c:emit_label "p.y -= span[i].size.y").
// Red/green: pre-fix the port drew the invis box (2239: +51 polygons) and
// stacked all cluster label lines at one y.

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../index.js';

const SRC = `digraph g {
  subgraph cluster_vis {
    label="Line One\\nLine Two\\nLine Three";
    a -> b;
    subgraph cluster_hidden {
      style="invis";
      label="Hidden Label";
      c;
    }
  }
}`;

function clusterGroup(svg: string, title: string): string {
  const t = svg.indexOf(`<title>${title}</title>`);
  expect(t).toBeGreaterThan(-1);
  return svg.slice(t, svg.indexOf('</g>', t));
}

describe('cluster style=invis suppresses box and label, keeps group', () => {
  it('emits no polygon/path and no label text inside the invis cluster group', () => {
    const svg = renderSvg(SRC, 'dot');
    const g = clusterGroup(svg, 'cluster_hidden');
    expect(g).not.toContain('<polygon');
    expect(g).not.toContain('<path');
    expect(g).not.toContain('Hidden Label');
  });

  it('still draws the visible parent cluster box', () => {
    const svg = renderSvg(SRC, 'dot');
    expect(clusterGroup(svg, 'cluster_vis')).toContain('<polygon');
  });
});

describe('multi-line cluster label baselines advance per span', () => {
  it('emits three text lines at strictly descending y', () => {
    const svg = renderSvg(SRC, 'dot');
    const ys = ['Line One', 'Line Two', 'Line Three'].map((s) => {
      const i = svg.indexOf(`>${s}</text>`);
      expect(i).toBeGreaterThan(-1);
      const m = /y="([-0-9.]+)"[^>]*$/.exec(svg.slice(svg.lastIndexOf('<text', i), i));
      expect(m).not.toBeNull();
      return parseFloat(m![1]);
    });
    // SVG y grows downward; successive lines sit lower on the page.
    expect(ys[1]).toBeGreaterThan(ys[0]);
    expect(ys[2]).toBeGreaterThan(ys[1]);
  });
});
