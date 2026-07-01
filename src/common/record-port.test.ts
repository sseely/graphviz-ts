// SPDX-License-Identifier: EPL-2.0

/**
 * Record-shape edge ports. Geometry verified against C graphviz 15.0.0
 * (lib/common/shapes.c:map_rec_port:3716, record_port:3732). A field's box is
 * in node-local coordinates; the resolved port point is relative to the node.
 *
 * @see lib/common/shapes.c:record_port
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../index.js';
import { recordPort, recordPath, mapRecPort } from './record-port.js';
import { makeNodeInfo } from '../model/nodeInfo.js';
import { makePort } from '../model/edgeInfo.js';
import { TOP } from './splines-constants.js';
import type { FieldT } from './types.js';
import type { Box, Port } from '../model/geom.js';

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

// recordPath (pboxfn): the box path from a port to the border is the top-level
// field's full-node-height vertical strip containing the port x. Origin of the
// graphs-biglabel fix — begin/endPath call this for record nodes so interior
// (side==0) ports route to the port column, not the whole node's maximal bbox.
// @see lib/common/shapes.c:record_path (line 3793)
describe('recordPath', () => {
  const portAt = (x: number): Port => ({ ...makePort(), p: { x, y: 0 }, defined: true });

  it('port in the center field → that field strip, full node height, kptr=1', () => {
    const rv: Box[] = [];
    const kptr = [0];
    const mask = recordPath(recordNode(), portAt(0), TOP, rv, kptr);
    // f1 x-range [-16,16]; node coord (0,0), ht 36 → y in [-18,18].
    expect(rv[0]).toEqual({ ll: { x: -16, y: -18 }, ur: { x: 16, y: 18 } });
    expect(kptr[0]).toBe(1);
    expect(mask).toBe(TOP);
  });

  it('port in the left field → the left field strip', () => {
    const rv: Box[] = [];
    const kptr = [0];
    recordPath(recordNode(), portAt(-33), TOP, rv, kptr);
    expect(rv[0]).toEqual({ ll: { x: -50, y: -18 }, ur: { x: -16, y: 18 } });
  });

  it('undefined port → returns 0, writes nothing', () => {
    const rv: Box[] = [];
    const kptr = [0];
    const mask = recordPath(recordNode(), makePort(), TOP, rv, kptr);
    expect(mask).toBe(0);
    expect(kptr[0]).toBe(0);
    expect(rv.length).toBe(0);
  });
});

// record_gencode outer box rounding (mission rounded-clusters-mrecord, AC3/AC4).
// C forces style.rounded for Mrecord and takes the SPECIAL_CORNERS branch, so
// the outer box is a rounded <path>; the field divider stays a <polyline>.
// @see lib/common/shapes.c:record_gencode
describe('record_gencode rounded outer box', () => {
  it('Mrecord box is a rounded <path> conformant with the oracle; divider unchanged', () => {
    const svg = renderSvg('digraph{a[shape=Mrecord,label="x|y"]}', 'dot');
    expect(svg).toContain('<polyline'); // field divider unchanged
    expect(svg).toContain(
      'd="M12,-0.5C12,-0.5 42,-0.5 42,-0.5 48,-0.5 54,-6.5 54,-12.5 54,-12.5 ' +
      '54,-24.5 54,-24.5 54,-30.5 48,-36.5 42,-36.5 42,-36.5 12,-36.5 12,-36.5 ' +
      '6,-36.5 0,-30.5 0,-24.5 0,-24.5 0,-12.5 0,-12.5 0,-6.5 6,-0.5 12,-0.5"',
    );
  });

  it('plain record outer box stays a sharp <polygon>, no rounded <path>', () => {
    const svg = renderSvg('digraph{a[shape=record,label="x|y"]}', 'dot');
    expect(svg).toContain('<polygon');
    expect(svg).not.toContain('<path');
  });
});

// record_gencode fill + pen: C resolves node style (stylenode/penColor/findFill)
// for records exactly as for poly nodes. Pre-fix the port drew every record box
// fill="none" stroke="black"; now style=filled fills and color= strokes the box
// AND the field dividers. @see lib/common/shapes.c:record_gencode
describe('record_gencode fill + pen', () => {
  it('style=filled record → solid fill on the box polygon', () => {
    const svg = renderSvg(
      'digraph{a[shape=record,style=filled,fillcolor=lightyellow,label="x|y"]}', 'dot');
    expect(svg).toContain('<polygon fill="lightyellow" stroke="black"');
  });

  it('style=filled Mrecord → fill on the rounded <path>', () => {
    const svg = renderSvg(
      'digraph{a[shape=Mrecord,style=filled,fillcolor=lightblue,label="x|y"]}', 'dot');
    expect(svg).toContain('<path fill="lightblue" stroke="black"');
  });

  it('color=red record → red stroke on both the box and the field divider', () => {
    const svg = renderSvg('digraph{a[shape=record,color=red,label="x|y"]}', 'dot');
    expect(svg).toContain('<polygon fill="none" stroke="red"');
    expect(svg).toContain('<polyline fill="none" stroke="red"');
  });

  it('plain record stays fill="none" stroke="black" (no regression)', () => {
    const svg = renderSvg('digraph{a[shape=record,label="x|y"]}', 'dot');
    expect(svg).toContain('<polygon fill="none" stroke="black"');
  });
});

// Pen width and pen style (dashed/dotted/bold) also flow through the shared
// applyNodeStyle resolver — onto the box AND the field dividers — matching
// C's stylenode. Oracle-verified (dot 15.1.0). Locks the shared pen path.
describe('record_gencode pen width + style', () => {
  it('penwidth=3 record → stroke-width="3" on the box and divider', () => {
    const svg = renderSvg('digraph{a[shape=record,penwidth=3,label="x|y"]}', 'dot');
    expect(svg).toContain('<polygon fill="none" stroke="black" stroke-width="3"');
    expect(svg).toContain('<polyline fill="none" stroke="black" stroke-width="3"');
  });

  it('style=dashed record → stroke-dasharray on the box and divider', () => {
    const svg = renderSvg('digraph{a[shape=record,style=dashed,label="x|y"]}', 'dot');
    expect(svg).toContain('<polygon fill="none" stroke="black" stroke-dasharray="5,2"');
    expect(svg).toContain('<polyline fill="none" stroke="black" stroke-dasharray="5,2"');
  });

  it('style=bold record → stroke-width="2" (bold maps to penwidth 2)', () => {
    const svg = renderSvg('digraph{a[shape=record,style=bold,label="x|y"]}', 'dot');
    expect(svg).toContain('stroke-width="2"');
  });

  it('Mrecord style=dotted penwidth=2 → both attrs on the rounded <path>', () => {
    const svg = renderSvg(
      'digraph{a[shape=Mrecord,style=dotted,penwidth=2,label="x|y"]}', 'dot');
    expect(svg).toContain('<path fill="none" stroke="black" stroke-width="2" stroke-dasharray="1,5"');
  });
});
