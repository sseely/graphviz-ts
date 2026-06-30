// SPDX-License-Identifier: EPL-2.0
//
// Golden test for the ortho rounded-corner edge emit, pinned to native dot's
// SVG for graphs/radius.gv (the GVBINDIR=/tmp/ghl headless oracle).

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../index.js';

const DOT = `digraph {
  splines=ortho;
  nodesep=1.0;
  x -> y[radius=8];
  z -> y;
}
`;

function edgeGroup(svg: string, id: string): string {
  const m = new RegExp(`<g id="${id}"[\\s\\S]*?</g>`).exec(svg);
  return m ? m[0] : '';
}

describe('ortho radius — golden vs native graphs/radius.gv', () => {
  const svg = renderSvg(DOT, 'dot');

  it('edge1 (x->y[radius=8]) emits 3 polylines + arrowhead, conformant with native', () => {
    const g = edgeGroup(svg, 'edge1');
    expect(g).toContain(
      '<polyline fill="none" stroke="black" points="27,-71.83 27,-50.5 27,-26"/>',
    );
    expect(g).toContain(
      '<polyline fill="none" stroke="black" points="35,-18 51.04,-18"/>',
    );
    expect(g).toContain(
      '<polyline fill="none" stroke="black" points="27,-26 27,-25.48 27.05,-24.95 ' +
      '27.15,-24.44 27.26,-23.93 27.41,-23.42 27.61,-22.94 27.81,-22.45 28.06,-21.99 ' +
      '28.35,-21.56 28.64,-21.12 28.97,-20.71 29.34,-20.34 29.71,-19.97 30.12,-19.64 ' +
      '30.56,-19.35 30.99,-19.06 31.45,-18.81 31.94,-18.61 32.42,-18.41 32.93,-18.26 ' +
      '33.44,-18.15 33.95,-18.05 34.48,-18 35,-18"/>',
    );
    // arrowhead unchanged; and the edge is NOT emitted as a single bezier <path>
    expect(g).toContain('<polygon fill="black" stroke="black"');
    expect(g).not.toContain('<path');
  });

  it('edge2 (z->y, ortho but NO radius) stays a single bezier <path> (byte-stable)', () => {
    const g = edgeGroup(svg, 'edge2');
    expect(g).toContain('<path fill="none" stroke="black"');
    expect(g).not.toContain('<polyline');
  });
});
