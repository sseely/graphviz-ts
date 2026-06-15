// SPDX-License-Identifier: EPL-2.0

/**
 * SR3 — wired-behavior test for the faithful side-port router.
 *
 * `routeOneEdge` now routes a forward adjacent-rank regular edge that has an
 * active side-mask port (`tail_port.side || head_port.side`) through the
 * faithful `beginPath → routeSplines → endPath → clipAndInstall` pipeline
 * (AD1/AD2), instead of the simplified fitter that truncated the non-monotonic
 * loop corridor. A north-port edge `A:n->B` exits the TOP face while the head
 * sits below, so a correct route loops up over A, bulges out, and comes back
 * down to B — the case the simplified fitter could not express.
 *
 * Plain (no-side-port) edges keep the simplified fitter so the 115 existing
 * goldens stay byte-identical (AD3); that is asserted here as a control.
 *
 * Coordinates are in the SVG frame (y negated from graphviz-internal y-up).
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge
 * @see lib/common/splines.c:clip_and_install
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

const BLACK_ARROW = '<polygon fill="black"';

/** A 2-D point in the SVG frame. */
interface Pt { x: number; y: number; }

/** Extract the first edge path's `d` attribute string (`M...`). */
function firstEdgePathD(svg: string): string {
  const marker = ' d=' + String.fromCharCode(34) + 'M';
  const i = svg.indexOf(marker);
  if (i < 0) throw new Error('no edge path in SVG');
  const from = i + marker.length - 1;
  const end = svg.indexOf(String.fromCharCode(34), from);
  return svg.slice(from, end);
}

/** Parse an SVG's first edge path into {x,y} control points (SVG frame). */
function parsePathPoints(svg: string): Pt[] {
  const nums = firstEdgePathD(svg).match(new RegExp('-?[0-9.]+', 'g')) ?? [];
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: Number(nums[i]), y: Number(nums[i + 1]) });
  }
  return pts;
}

/** Render `dot` and return its first edge path's control points. */
function edgePathPoints(dot: string): Pt[] {
  return parsePathPoints(renderSvg(dot, 'dot'));
}

const xs = (pts: Pt[]): number[] => pts.map(p => p.x);
const ys = (pts: Pt[]): number[] => pts.map(p => p.y);

describe('SR3 — side-port edges route through the faithful loop corridor', () => {
  it('A:n->B loops above A, reaches B, and emits an arrowhead', () => {
    const svg = renderSvg('digraph{A:n->B}', 'dot');
    const pts = parsePathPoints(svg);
    const start = pts[0];
    expect(Math.abs(start.x - 27)).toBeLessThan(0.5);   // north port attach
    expect(Math.abs(start.y + 109)).toBeLessThan(1);
    expect(Math.min(...ys(pts))).toBeLessThan(start.y - 5);  // apex above port
    expect(Math.max(...ys(pts))).toBeGreaterThan(-55);       // descends to B
    expect(Math.max(...xs(pts))).toBeGreaterThan(37);        // lateral bulge
    expect(svg).toContain(BLACK_ARROW);                      // arrowhead emitted
  });

  it('A:e->B / A:w->B bulge laterally past the tail east/west face', () => {
    const east = edgePathPoints('digraph{A:e->B}');
    expect(Math.max(...xs(east))).toBeGreaterThan(east[0].x);   // bulges right
    expect(renderSvg('digraph{A:e->B}', 'dot')).toContain(BLACK_ARROW);
    const west = edgePathPoints('digraph{A:w->B}');
    expect(Math.min(...xs(west))).toBeLessThan(west[0].x);      // bulges left
  });

  it('plain A->B keeps the simplified straight route (no side port)', () => {
    const pts = edgePathPoints('digraph{A->B}');
    expect(Math.min(...ys(pts))).toBeGreaterThanOrEqual(pts[0].y - 0.5);
    expect(Math.max(...xs(pts))).toBeLessThan(28);   // no lateral bulge
  });
});
