// SPDX-License-Identifier: EPL-2.0

/**
 * Record-shape edge ports. Geometry verified against C graphviz 15.0.0
 * (lib/common/shapes.c:map_rec_port:3716, record_port:3732). A field's box is
 * in node-local coordinates; the resolved port point is relative to the node.
 *
 * @see lib/common/shapes.c:record_port
 */

import { describe, it, expect } from 'vitest';
import { recordPort, mapRecPort } from './record-port.js';
import { makeNodeInfo } from '../model/nodeInfo.js';
import { TOP } from './splines-constants.js';
import type { FieldT } from './types.js';
import type { Box } from '../model/geom.js';

function field(id: string | null, b: Box, fld: FieldT[] | null = null): FieldT {
  return { size: { x: 0, y: 0 }, b, n_flds: fld ? fld.length : 0,
    lp: null, fld, id, LR: 0, sides: 15 };
}

/** 3-field record (f0|f1|f2), 100×36, node-local coords centered at origin. */
function recordNode() {
  const f0 = field('f0', { ll: { x: -50, y: -18 }, ur: { x: -16, y: 18 } });
  const f1 = field('f1', { ll: { x: -16, y: -18 }, ur: { x: 16, y: 18 } });
  const f2 = field('f2', { ll: { x: 16, y: -18 }, ur: { x: 50, y: 18 } });
  const root = field(null, { ll: { x: -50, y: -18 }, ur: { x: 50, y: 18 } }, [f0, f1, f2]);
  const info = Object.assign(makeNodeInfo(), {
    coord: { x: 0, y: 0 }, lw: 50, rw: 50, ht: 36, shape_info: root,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { info, root: { info: { rankdir: 0 } } } as any;
}

describe('mapRecPort', () => {
  it('finds a field by id; returns null for a missing id', () => {
    const n = recordNode();
    expect(mapRecPort(n.info.shape_info, 'f1')!.id).toBe('f1');
    expect(mapRecPort(n.info.shape_info, 'nope')).toBeNull();
  });
});

describe('recordPort', () => {
  it('f0:n → port on the left field top (p.x left of center, side TOP)', () => {
    const p = recordPort(recordNode(), 'f0', 'n');
    expect(p.p).toEqual({ x: -33, y: 18 });
    expect(p.p.x).toBeLessThan(0);
    expect(p.side & TOP).toBe(TOP);
    expect(p.defined).toBe(true);
  });

  it('f0 with no compass → dynamic port at the field center', () => {
    const p = recordPort(recordNode(), 'f0', '');
    expect(p.dyna).toBe(true);
    expect(p.p).toEqual({ x: -33, y: 0 });
  });

  it('a non-field portname falls back to a compass on the whole record', () => {
    const p = recordPort(recordNode(), 'n', '');
    expect(p.p).toEqual({ x: 0, y: 18 });
    expect(p.side & TOP).toBe(TOP);
  });

  it('empty portname → default Center port', () => {
    expect(recordPort(recordNode(), '', '').defined).toBe(false);
  });
});
