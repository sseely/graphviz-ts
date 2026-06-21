// SPDX-License-Identifier: EPL-2.0

/**
 * Unit tests for nodeinit.ts — xlabel creation and has_labels bit.
 *
 * Ports the xlabel block of common_init_node:
 *   lib/common/utils.c:443-447
 *
 * @see lib/common/utils.c:common_init_node
 */

import { describe, it, expect } from 'vitest';
import type { TextMeasurer } from './textmeasure.js';
import type { PolygonT, TextlabelT } from './types.js';
import { Graph } from '../model/graph.js';
import { Node } from '../model/node.js';
import { makeNodeInfo } from '../model/nodeInfo.js';
import { NODE_XLABEL } from '../layout/dot/rank.js';
import { commonInitNode } from './nodeinit.js';
import { HTML_STRING_MARK } from './html-string.js';

const stubMeasurer: TextMeasurer = { measure: () => ({ w: 10, h: 5 }) };

function makeGraph(): Graph {
  const g = new Graph('g', 'directed');
  (g.root.info as unknown as Record<string, unknown>).gvc = { textMeasurer: stubMeasurer };
  return g;
}

function addNode(g: Graph, name: string, attrs: Record<string, string> = {}): Node {
  const n = new Node(1, name, g);
  n.info = makeNodeInfo();
  for (const [k, v] of Object.entries(attrs)) n.attrs.set(k, v);
  g.nodes.set(name, n);
  return n;
}

function nodeWithXlabel(xlabel: string): { g: Graph; n: Node } {
  const g = makeGraph();
  const n = addNode(g, 'A', xlabel ? { xlabel } : {});
  commonInitNode(n, g);
  return { g, n };
}

// ---------------------------------------------------------------------------
// No xlabel — @see lib/common/utils.c:443 (N_xlabel guard)
// ---------------------------------------------------------------------------

describe('commonInitNode — xlabel absent', () => {
  it('leaves xlabel undefined', () => {
    const { n } = nodeWithXlabel('');
    expect(n.info.xlabel).toBeUndefined();
  });

  it('leaves NODE_XLABEL bit unset', () => {
    const { g } = nodeWithXlabel('');
    expect((g.info.has_labels ?? 0) & NODE_XLABEL).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Empty xlabel — C guards str[0]; @see lib/common/utils.c:443
// ---------------------------------------------------------------------------

describe('commonInitNode — xlabel empty string', () => {
  it('leaves xlabel undefined when attr is empty', () => {
    const g = makeGraph();
    const n = addNode(g, 'A', { xlabel: '' });
    commonInitNode(n, g);
    expect(n.info.xlabel).toBeUndefined();
  });

  it('leaves NODE_XLABEL bit unset when attr is empty', () => {
    const g = makeGraph();
    const n = addNode(g, 'A', { xlabel: '' });
    commonInitNode(n, g);
    expect((g.info.has_labels ?? 0) & NODE_XLABEL).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// xlabel present — @see lib/common/utils.c:444-446
// ---------------------------------------------------------------------------

describe('commonInitNode — xlabel text and dimen', () => {
  it('creates xlabel with correct text', () => {
    const { n } = nodeWithXlabel('nx');
    expect((n.info.xlabel as TextlabelT).text).toBe('nx');
  });

  it('xlabel has measured dimen from stub measurer', () => {
    const { n } = nodeWithXlabel('nx');
    const xl = n.info.xlabel as TextlabelT;
    expect(xl.dimen.x).toBe(10);
    expect(xl.dimen.y).toBe(5);
  });

  it('xlabel set=false (not yet placed by addXLabels)', () => {
    const { n } = nodeWithXlabel('nx');
    expect((n.info.xlabel as TextlabelT).set).toBe(false);
  });
});

describe('commonInitNode — xlabel font attrs', () => {
  it('uses default fontname when node has no font attr', () => {
    const { n } = nodeWithXlabel('nx');
    expect((n.info.xlabel as TextlabelT).fontname).toBe('Times,serif');
  });

  it('uses per-node fontname override', () => {
    const g = makeGraph();
    const n = addNode(g, 'A', { xlabel: 'nx', fontname: 'Helvetica' });
    commonInitNode(n, g);
    expect((n.info.xlabel as TextlabelT).fontname).toBe('Helvetica');
  });
});

describe('commonInitNode — NODE_XLABEL bit', () => {
  it('sets NODE_XLABEL on root has_labels', () => {
    const { g } = nodeWithXlabel('nx');
    expect((g.info.has_labels ?? 0) & NODE_XLABEL).toBeTruthy();
  });

  it('accumulates bit across multiple nodes', () => {
    const g = makeGraph();
    const n1 = addNode(g, 'A', { xlabel: 'nx' });
    const n2 = addNode(g, 'B', { xlabel: 'ny' });
    commonInitNode(n1, g);
    commonInitNode(n2, g);
    expect((g.info.has_labels ?? 0) & NODE_XLABEL).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// shape=point sizing — @see lib/common/shapes.c:point_init
// ---------------------------------------------------------------------------

/** Init a `shape=point` node with the given extra attrs. */
function pointNode(attrs: Record<string, string> = {}): Node {
  const g = makeGraph();
  const n = addNode(g, 'A', { shape: 'point', ...attrs });
  commonInitNode(n, g);
  return n;
}

describe('commonInitNode — shape=point default size', () => {
  it('defaults to DEF_POINT (0.05in) ignoring the label', () => {
    const n = pointNode();
    // AC1: ND_width == ND_height == 0.05in (rx 1.8pt).
    expect(n.info.width).toBeCloseTo(0.05, 9);
    expect(n.info.height).toBeCloseTo(0.05, 9);
  });

  it('sets lw/rw/ht to the 3.6pt dot (rx 1.8pt)', () => {
    const n = pointNode();
    expect(n.info.lw).toBeCloseTo(1.8, 9);
    expect(n.info.rw).toBeCloseTo(1.8, 9);
    expect(n.info.ht).toBeCloseTo(3.6, 9);
  });

  it('keeps the label object (suppressed at render, not deleted)', () => {
    expect(pointNode().info.label).toBeDefined();
  });
});

describe('commonInitNode — shape=point set width/height', () => {
  it('honors the min of set width/height, not DEF_POINT (AC4)', () => {
    const n = pointNode({ width: '0.2' });
    expect(n.info.width).toBeCloseTo(0.2, 9);
    expect(n.info.height).toBeCloseTo(0.2, 9);
    expect(n.info.lw).toBeCloseTo(7.2, 9);
  });

  it('uses the smaller of width and height', () => {
    expect(pointNode({ width: '0.5', height: '0.1' }).info.width).toBeCloseTo(0.1, 9);
  });
});

describe('commonInitNode — shape=point polygon rings', () => {
  it('installs a sides=2 ellipse polygon with the 1.8pt inner ring', () => {
    const poly = pointNode().info.shape_info as PolygonT;
    expect(poly.sides).toBe(2);
    expect(poly.peripheries).toBe(1);
    expect(poly.vertices![0]).toEqual({ x: -1.8, y: -1.8 });
    expect(poly.vertices![1]).toEqual({ x: 1.8, y: 1.8 });
  });

  it('grows by GAP per extra periphery (peripheries=2 → outer rx 5.8)', () => {
    const poly = pointNode({ peripheries: '2' }).info.shape_info as PolygonT;
    expect(poly.peripheries).toBe(2);
    expect(poly.vertices![1]!.x).toBeCloseTo(1.8, 9);
    expect(poly.vertices![3]!.x).toBeCloseTo(5.8, 9);
  });
});

// ---------------------------------------------------------------------------
// HTML xlabel — @see lib/common/utils.c:444 (aghtmlstr dispatch)
// ---------------------------------------------------------------------------

/** Build a node with an HTML xlabel attr. */
function nodeWithHtmlXlabel(): { g: Graph; n: Node } {
  const g = makeGraph();
  const n = addNode(g, 'A', { xlabel: `${HTML_STRING_MARK}<b>x</b>` });
  commonInitNode(n, g);
  return { g, n };
}

describe('commonInitNode — html xlabel html flag', () => {
  it('sets html=true', () => {
    const { n } = nodeWithHtmlXlabel();
    expect((n.info.xlabel as TextlabelT).html).toBe(true);
  });

  it('sets u.kind="html"', () => {
    const { n } = nodeWithHtmlXlabel();
    expect((n.info.xlabel as TextlabelT).u.kind).toBe('html');
  });

  it('set=false (not yet placed)', () => {
    const { n } = nodeWithHtmlXlabel();
    expect((n.info.xlabel as TextlabelT).set).toBe(false);
  });
});

describe('commonInitNode — html xlabel bits', () => {
  it('sets NODE_XLABEL bit', () => {
    const { g } = nodeWithHtmlXlabel();
    expect((g.root.info.has_labels ?? 0) & NODE_XLABEL).toBeTruthy();
  });

  it('plain-text xlabel remains html=false', () => {
    const { n } = nodeWithXlabel('plain');
    expect((n.info.xlabel as TextlabelT).html).toBe(false);
  });
});
