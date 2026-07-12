// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import {
  PlainRenderer,
  PlainExtRenderer,
  ImapRenderer,
  ImapNpRenderer,
  CmapxRenderer,
  CmapxNpRenderer,
  createPlainRenderer,
  createPlainExtRenderer,
  createImapRenderer,
  createImapNpRenderer,
  createCmapxRenderer,
  createCmapxNpRenderer,
  mapGraphName,
  buildMapCtx,
} from './map.js';
import { makeJob, makeObjState, makeGraph, makeNode } from './map-test-helpers.js';
import { MapShape } from '../gvc/job.js';
import { Graph } from '../model/graph.js';
import type { Point, Spline } from '../model/geom.js';
import type { TextlabelT } from '../common/types.js';
import {
  type MapCtx,
  mapTransform,
  computeNodeUrlMap,
  computeGraphUrlMap,
  computeLabelRectMap,
  computeEdgeSplineMaps,
} from '../gvc/anchor.js';

// ---------------------------------------------------------------------------
// Avoid Lizard quote-tracker bug: never put " inside string literals.
// ---------------------------------------------------------------------------

const DQ = '\x22';

// ---------------------------------------------------------------------------
// Factory test bodies
// ---------------------------------------------------------------------------

export function testPlainFactory(): void {
  const r = createPlainRenderer();
  expect(r.type).toBe('plain');
  expect(r.quality).toBe(0);
}

export function testPlainExtFactory(): void {
  const r = createPlainExtRenderer();
  expect(r.type).toBe('plain-ext');
  expect(r.quality).toBe(0);
}

export function testImapFactory(): void {
  const r = createImapRenderer();
  expect(r.type).toBe('imap');
  expect(r.quality).toBe(0);
}

export function testImapNpFactory(): void {
  const r = createImapNpRenderer();
  expect(r.type).toBe('imap-np');
  expect(r.quality).toBe(0);
}

export function testCmapxFactory(): void {
  const r = createCmapxRenderer();
  expect(r.type).toBe('cmapx');
  expect(r.quality).toBe(0);
}

export function testCmapxNpFactory(): void {
  const r = createCmapxNpRenderer();
  expect(r.type).toBe('cmapx-np');
  expect(r.quality).toBe(0);
}

// ---------------------------------------------------------------------------
// PlainRenderer integration test bodies
// ---------------------------------------------------------------------------

export function testPlainEndGraph(): void {
  const r = new PlainRenderer();
  const job = makeJob();
  const g = makeGraph();
  makeNode(g, 'A');
  r.beginGraph(g, job);
  r.endGraph(g, job);
  const out = job.output.join('');
  expect(out).toContain('graph ');
  expect(out).toContain('node A');
  expect(out).toContain('stop');
}

export function testPlainExtEndGraph(): void {
  const r = new PlainExtRenderer();
  const job = makeJob();
  const g = makeGraph();
  makeNode(g, 'A');
  r.endGraph(g, job);
  expect(job.output.join('')).toContain('stop');
}

// ---------------------------------------------------------------------------
// ImapRenderer integration test bodies
// ---------------------------------------------------------------------------

export function testImapBeginGraph(): void {
  const r = new ImapRenderer();
  const job = makeJob();
  r.beginGraph(makeGraph(), job);
  expect(job.output.join('')).toContain('base referer');
}

export function testImapBeginAnchorNoMap(): void {
  const r = new ImapRenderer();
  const job = makeJob();
  const before = job.output.length;
  r.beginAnchor?.('http://x.com', '', '', '', job);
  expect(job.output.length).toBe(before);
}

export function testImapNpBeginGraph(): void {
  const r = new ImapNpRenderer();
  const job = makeJob();
  r.beginGraph(makeGraph(), job);
  expect(job.output.join('')).toContain('base referer');
}

export function testImapNpBeginAnchorNoMap(): void {
  const r = new ImapNpRenderer();
  const job = makeJob();
  const before = job.output.length;
  r.beginAnchor?.('http://x.com', '', '', '', job);
  expect(job.output.length).toBe(before);
}

// ---------------------------------------------------------------------------
// CmapxRenderer integration test bodies
// ---------------------------------------------------------------------------

export function testCmapxBeginGraph(): void {
  const r = new CmapxRenderer();
  const job = makeJob();
  r.beginGraph(makeGraph(), job);
  const out = job.output.join('');
  expect(out).toContain('<map id=' + DQ + 'G' + DQ);
  expect(out).toContain('name=' + DQ + 'G' + DQ);
}

export function testCmapxEndGraph(): void {
  const r = new CmapxRenderer();
  const job = makeJob();
  r.endGraph(makeGraph(), job);
  expect(job.output.join('')).toContain('</map>');
}

export function testCmapxBeginAnchorNoMap(): void {
  const r = new CmapxRenderer();
  const job = makeJob();
  const before = job.output.length;
  r.beginAnchor?.('http://x.com', 'tip', '_blank', 'n1', job);
  expect(job.output.length).toBe(before);
}

export function testCmapxBeginAnchorWithMap(): void {
  const r = new CmapxRenderer();
  const job = makeJob();
  const obj = makeObjState();
  obj.urlMapShape = MapShape.Rectangle;
  obj.urlMapPts = [{ x: 10, y: 80 }, { x: 90, y: 20 }] as Point[];
  job.pushObj(obj);
  r.beginAnchor?.('http://x.com', 'tip', '_blank', 'n1', job);
  const out = job.output.join('');
  expect(out).toContain('<area shape=' + DQ + 'rect' + DQ);
  expect(out).toContain('href=' + DQ + 'http://x.com' + DQ);
}

// ---------------------------------------------------------------------------
// CmapxNpRenderer integration test bodies
// ---------------------------------------------------------------------------

export function testCmapxNpBeginGraph(): void {
  const r = new CmapxNpRenderer();
  const job = makeJob();
  r.beginGraph(makeGraph(), job);
  expect(job.output.join('')).toContain('<map id=' + DQ + 'G' + DQ);
}

export function testCmapxNpEndGraph(): void {
  const r = new CmapxNpRenderer();
  const job = makeJob();
  r.endGraph(makeGraph(), job);
  expect(job.output.join('')).toContain('</map>');
}

// ---------------------------------------------------------------------------
// describe / it registrations
// ---------------------------------------------------------------------------

describe('PlainRenderer', () => {
  it('factory returns type=plain quality=0', testPlainFactory);
  it('endGraph writes full plain output', testPlainEndGraph);
});

describe('PlainExtRenderer', () => {
  it('factory returns type=plain-ext quality=0', testPlainExtFactory);
  it('endGraph writes plain output', testPlainExtEndGraph);
});

describe('ImapRenderer', () => {
  it('factory returns type=imap quality=0', testImapFactory);
  it('beginGraph writes base referer', testImapBeginGraph);
  it('beginAnchor no-op without map pts', testImapBeginAnchorNoMap);
});

describe('ImapNpRenderer', () => {
  it('factory returns type=imap-np quality=0', testImapNpFactory);
  it('beginGraph writes base referer', testImapNpBeginGraph);
  it('beginAnchor no-op without map pts', testImapNpBeginAnchorNoMap);
});

describe('CmapxRenderer', () => {
  it('factory returns type=cmapx quality=0', testCmapxFactory);
  it('beginGraph emits map open tag', testCmapxBeginGraph);
  it('endGraph emits map close tag', testCmapxEndGraph);
  it('beginAnchor no-op without map pts', testCmapxBeginAnchorNoMap);
  it('beginAnchor emits area when map pts present', testCmapxBeginAnchorWithMap);
});

describe('CmapxNpRenderer', () => {
  it('factory returns type=cmapx-np quality=0', testCmapxNpFactory);
  it('beginGraph emits map open tag', testCmapxNpBeginGraph);
  it('endGraph emits map close tag', testCmapxNpEndGraph);
});

// ---------------------------------------------------------------------------
// Imagemap geometry (url_map_p) — anchor.ts + map.ts helpers
// ---------------------------------------------------------------------------

/** MapCtx: origin bb, pad 4, scale 1, no margin, polygon-capable. */
function unitCtx(overrides: Partial<MapCtx> = {}): MapCtx {
  return {
    bb: { ll: { x: 0, y: 0 }, ur: { x: 144, y: 72 } },
    pad: { x: 4, y: 4 }, scale: 1, marginOff: { x: 0, y: 0 }, mapPolygon: true,
    ...overrides,
  };
}

describe('mapGraphName', () => {
  it('anonymous root (digraph {) maps to the internal %1', () => {
    expect(mapGraphName(new Graph('', 'directed', true))).toBe('%1');
  });
  it('explicit empty name (digraph "") stays empty', () => {
    expect(mapGraphName(new Graph('', 'directed', false))).toBe('');
  });
  it('named graph keeps its name', () => {
    expect(mapGraphName(new Graph('G', 'directed'))).toBe('G');
  });
  it('anonymous graph renders <map id=%1> in cmapx', () => {
    const r = new CmapxRenderer();
    const job = makeJob();
    const g = new Graph('', 'directed', true);
    g.info.bb = { ll: { x: 0, y: 0 }, ur: { x: 144, y: 72 } };
    r.beginGraph(g, job);
    expect(job.output.join('')).toContain('<map id=' + DQ + '%1' + DQ);
  });
});

describe('mapTransform', () => {
  it('applies pad, Y-flip, scale and margin offset', () => {
    const ctx = unitCtx({ scale: 2, marginOff: { x: 5, y: 7 } });
    // x = (10 + 4 - 0)*2 + 5 = 33 ; y = (72 + 4 - 20)*2 + 7 = 119
    expect(mapTransform({ x: 10, y: 20 }, ctx)).toEqual({ x: 33, y: 119 });
  });
});

describe('buildMapCtx', () => {
  it('defaults the imagemap dpi to 96 (devscale 96/72)', () => {
    const g = makeGraph();
    const job = makeJob();
    job.pad = { x: 4, y: 4 };
    const ctx = buildMapCtx(g, job, true);
    expect(ctx.scale).toBeCloseTo(96 / 72, 6);
    expect(ctx.mapPolygon).toBe(true);
  });
});

describe('computeNodeUrlMap', () => {
  it('maps an unshaped (record/box) node to its lw/rw bbox rectangle', () => {
    const g = makeGraph();
    const n = makeNode(g);
    n.attrs.set('href', 'x');
    n.info.lw = 36; n.info.rw = 36; n.info.ht = 36;
    const obj = makeObjState();
    computeNodeUrlMap(n, obj, unitCtx());
    expect(obj.urlMapShape).toBe(MapShape.Rectangle);
    // coord (72,36) ± (36, 18) → (36,18),(108,54) → transform → (40,58),(112,22)
    expect(obj.urlMapPts).toEqual([{ x: 40, y: 58 }, { x: 112, y: 22 }]);
  });
  it('skips nodes with no href/URL/tooltip (empty map)', () => {
    const g = makeGraph();
    const n = makeNode(g);
    n.info.lw = 36; n.info.rw = 36; n.info.ht = 36;
    const obj = makeObjState();
    computeNodeUrlMap(n, obj, unitCtx());
    expect(obj.urlMapPts).toEqual([]);
  });
});

describe('computeGraphUrlMap + computeLabelRectMap', () => {
  it('graph hot spot is the padded drawing rectangle', () => {
    const obj = makeObjState();
    computeGraphUrlMap(obj, unitCtx());
    // clip = [-4,-4]..[148,76] → transform → (0,80),(152,0)
    expect(obj.urlMapShape).toBe(MapShape.Rectangle);
    expect(obj.urlMapPts).toEqual([{ x: 0, y: 80 }, { x: 152, y: 0 }]);
  });
  it('label hot spot is the pos ± dimen/2 rectangle', () => {
    const obj = makeObjState();
    const lab = { pos: { x: 50, y: 30 }, dimen: { x: 20, y: 10 }, set: true } as TextlabelT;
    computeLabelRectMap(lab, obj, unitCtx());
    // (40,25),(60,35) → transform → (44,51),(64,41)
    expect(obj.urlMapPts).toEqual([{ x: 44, y: 51 }, { x: 64, y: 41 }]);
  });
});

describe('computeEdgeSplineMaps', () => {
  it('wraps a straight single-Bézier edge in one closed polygon', () => {
    const spl: Spline = {
      list: [{
        list: [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 20 }, { x: 0, y: 30 }],
        size: 4, sflag: 0, eflag: 0, sp: { x: 0, y: 0 }, ep: { x: 0, y: 30 },
      }],
      size: 1, bb: { ll: { x: 0, y: 0 }, ur: { x: 0, y: 30 } },
    };
    const polys = computeEdgeSplineMaps(spl, 2, unitCtx());
    expect(polys).toHaveLength(1);
    // 2 flattened points → 2 offset pairs → a 4-point outline
    expect(polys[0]).toHaveLength(4);
  });
});
