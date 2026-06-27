// SPDX-License-Identifier: EPL-2.0
//
// Oracle-pinned against native dot's ellipticWedge (lib/common/ellipse.c) for
// the graphs/radius.gv edge1 corner: ellipticWedge((35,26), 8, 8, PI, 3PI/2).
// Native (GV_XDUMP) emits pn=31; the arc slice ps[3..27] is the 25-point arc
// polyline drawn for the rounded corner. Values are graphviz-internal y-up
// (SVG negates y).

import { describe, it, expect } from 'vitest';
import { ellipticWedge } from './ellipse-wedge.js';

// Full 31-point wedge from the C oracle (5-decimal dump).
const C_WEDGE: ReadonlyArray<[number, number]> = [
  [35.0, 26.0], [35.0, 26.0], [27.0, 26.0], [27.0, 26.0],
  [27.0, 25.47598], [27.05149, 24.95323], [27.15372, 24.43928], [27.25595, 23.92533],
  [27.40843, 23.42266], [27.60896, 22.93853], [27.8095, 22.4544], [28.05711, 21.99114],
  [28.34824, 21.55544], [28.63937, 21.11973], [28.97261, 20.71368], [29.34315, 20.34315],
  [29.71368, 19.97261], [30.11973, 19.63937], [30.55544, 19.34824], [30.99114, 19.05711],
  [31.4544, 18.8095], [31.93853, 18.60896], [32.42266, 18.40843], [32.92533, 18.25595],
  [33.43928, 18.15372], [33.95323, 18.05149], [34.47598, 18.0], [35.0, 18.0],
  [35.0, 18.0], [35.0, 26.0], [35.0, 26.0],
];

describe('ellipticWedge — oracle-pinned vs native ellipse.c', () => {
  it('reproduces the radius=8 quarter wedge (pn=31) point-for-point', () => {
    const pts = ellipticWedge({ x: 35, y: 26 }, 8, 8, Math.PI, (3 * Math.PI) / 2);
    expect(pts.length).toBe(31);
    pts.forEach((p, i) => {
      expect(p.x).toBeCloseTo(C_WEDGE[i][0], 4);
      expect(p.y).toBeCloseTo(C_WEDGE[i][1], 4);
    });
  });

  it('begins with the center then the arc-start point (C moveTo/lineTo order)', () => {
    const pts = ellipticWedge({ x: 35, y: 26 }, 8, 8, Math.PI, (3 * Math.PI) / 2);
    expect(pts[0]).toEqual({ x: 35, y: 26 });           // center
    expect(pts[2].x).toBeCloseTo(27, 4);                // arc start (on ellipse)
    expect(pts[2].y).toBeCloseTo(26, 4);
  });

  it('the arc slice [3..27] runs from (27,26) to (35,18) — the drawn corner', () => {
    const pts = ellipticWedge({ x: 35, y: 26 }, 8, 8, Math.PI, (3 * Math.PI) / 2);
    const arc = pts.slice(3, 28); // arc_start_idx=3 .. arc_end_idx=pn-4=27 inclusive
    expect(arc.length).toBe(25);
    expect(arc[0].x).toBeCloseTo(27, 4);
    expect(arc[0].y).toBeCloseTo(26, 4);
    expect(arc[arc.length - 1].x).toBeCloseTo(35, 4);
    expect(arc[arc.length - 1].y).toBeCloseTo(18, 4);
  });

  it('handles a general elliptic case (xsemi != ysemi) without throwing', () => {
    const pts = ellipticWedge({ x: 0, y: 0 }, 10, 4, 0, Math.PI / 2);
    expect(pts.length).toBeGreaterThan(6);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
  });
});
