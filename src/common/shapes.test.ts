// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import { Shapes, bindShape } from '../common/shapes.js';
import { ShapeKind } from '../common/types.js';
import type { NodeInfo } from '../common/types.js';

// ---------------------------------------------------------------------------
// AC1 — All 62 shape names are present in the Shapes table
// ---------------------------------------------------------------------------

describe('Shapes table', () => {
  it('contains all 62 expected names in order', () => {
    const names = Shapes.map((s) => s.name);
    const expected = [
      'box', 'polygon', 'ellipse', 'oval', 'circle', 'point',
      'egg', 'triangle', 'none', 'plaintext', 'plain', 'diamond',
      'trapezium', 'parallelogram', 'house', 'pentagon', 'hexagon',
      'septagon', 'octagon', 'note', 'tab', 'folder', 'box3d',
      'component', 'cylinder', 'rect', 'rectangle', 'square',
      'doublecircle', 'doubleoctagon', 'tripleoctagon', 'invtriangle',
      'invtrapezium', 'invhouse', 'underline', 'Mdiamond', 'Msquare',
      'Mcircle', 'promoter', 'cds', 'terminator', 'utr', 'insulator',
      'ribosite', 'rnastab', 'proteasesite', 'proteinstab', 'primersite',
      'restrictionsite', 'fivepoverhang', 'threepoverhang', 'noverhang',
      'assembly', 'signature', 'rpromoter', 'larrow', 'rarrow', 'lpromoter',
      'record', 'Mrecord', 'epsf', 'star',
    ];
    expect(names).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// AC2 — bindShape('polygon') returns Shapes[1] with polygon.sides === 0
// ---------------------------------------------------------------------------

describe('bindShape', () => {
  it("returns Shapes[1] for 'polygon' with sides === 0", () => {
    const desc = bindShape('polygon');
    expect(desc).toBe(Shapes[1]);
    expect(desc.name).toBe('polygon');
    expect(desc.kind).toBe(ShapeKind.SH_POLY);
    expect(desc.polygon).not.toBeNull();
    expect(desc.polygon!.sides).toBe(0);
  });

  it("falls back to Shapes[0] (box) for an unknown name", () => {
    const desc = bindShape('does_not_exist');
    expect(desc.name).toBe('box');
    expect(desc).toBe(Shapes[0]);
  });
});

// ---------------------------------------------------------------------------
// AC4 — NodeInfo.rank dual-use field is accessible via src/common/types.ts
// ---------------------------------------------------------------------------

describe('NodeInfo type re-export', () => {
  it('exposes the rank field on NodeInfo imported from common/types', () => {
    const info: NodeInfo = {
      coord: { x: 0, y: 0 },
      width: 0,
      height: 0,
      bb: { ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } },
      ht: 0,
      lw: 0,
      rw: 0,
      outline_width: 0,
      outline_height: 0,
      state: 0,
      gui_state: 0,
      clustnode: false,
      rank: 3,
    };
    expect(info.rank).toBe(3);
  });
});
