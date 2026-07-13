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
import { parse } from '../parser/index.js';
import { render } from '../render/public.js';

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

// ---------------------------------------------------------------------------
// xlabel on RECORD shapes — @see lib/common/utils.c:441-453
//
// C's common_init_node runs the same three steps for EVERY shape: make_label
// (:441, with is_record only selecting the raw-text branch of labels.c:139),
// then ND_xlabel (:443-447), then the shape's initfn (:453). SH_RECORD selects
// initfn=record_init; it is NOT a reason to skip the xlabel. The port used to
// early-return on the record branch and never create ND_xlabel, so record and
// Mrecord nodes silently lost their xlabel: no placement, no `_ldraw_` text op,
// no `xlp` attribute, and a graph `bb` short by the xlabel's extent.
//
// The corpus cannot catch this — record ∩ xlabel is EMPTY across all 180
// corpus inputs — so these are hand-written regressions.
// ---------------------------------------------------------------------------

/** Init a node of the given shape carrying an xlabel. */
function shapedNodeWithXlabel(shape: string): { g: Graph; n: Node } {
  const g = makeGraph();
  const n = addNode(g, 'A', { shape, label: '<p1>x|<p2>y', xlabel: 'NX' });
  commonInitNode(n, g);
  return { g, n };
}

describe.each(['record', 'Mrecord', 'box'])('commonInitNode — xlabel on shape=%s', (shape) => {
  it('creates ND_xlabel with the attr text', () => {
    const { n } = shapedNodeWithXlabel(shape);
    expect(n.info.xlabel).toBeDefined();
    expect((n.info.xlabel as TextlabelT).text).toBe('NX');
  });

  it('measures the xlabel dimen (stub measurer: 10x5)', () => {
    const { n } = shapedNodeWithXlabel(shape);
    const xl = n.info.xlabel as TextlabelT;
    expect(xl.dimen.x).toBe(10);
    expect(xl.dimen.y).toBe(5);
  });

  it('sets the NODE_XLABEL bit on the root has_labels', () => {
    const { g } = shapedNodeWithXlabel(shape);
    expect((g.root.info.has_labels ?? 0) & NODE_XLABEL).toBe(NODE_XLABEL);
  });

  it('still builds the main label and sizes the node', () => {
    const { n } = shapedNodeWithXlabel(shape);
    expect(n.info.label).toBeDefined();
    expect(n.info.ht).toBeGreaterThan(0);
    expect((n.info.lw ?? 0) + (n.info.rw ?? 0)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: the xlabel must survive placement and reach the xdot output.
// Values below are the native oracle's
// (`GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Txdot -Kdot`).
// ---------------------------------------------------------------------------

/** Render one node of `shape` with xlabel "NX" plus a plain box, to xdot. */
function renderXdotWithXlabel(shape: string): string {
  const g = parse(
    `digraph { r [shape=${shape}, label="<p1>x|<p2>y", xlabel="NX"]; ` +
      `s [shape=box, xlabel="BX"]; r -> s }`,
  );
  return render(g, 'xdot', { engine: 'dot' });
}

/** The attribute block xdot emits for node `name`. */
function nodeBlock(xdot: string, name: string): string {
  const line = xdot.split('\n').find((l) => l.trimStart().startsWith(`${name} [`));
  expect(line, `no xdot block for node ${name}`).toBeDefined();
  return line!;
}

describe.each(['record', 'Mrecord', 'box'])('xdot output — xlabel on shape=%s', (shape) => {
  it('emits an xlp attribute for the xlabeled node', () => {
    expect(nodeBlock(renderXdotWithXlabel(shape), 'r')).toMatch(/xlp="[-\d.,]+"/);
  });

  it('emits the xlabel text as an _ldraw_ text op', () => {
    // T <x> <y> <justify> <width> <len> -<text>; the xlabel text is "NX" (len 2).
    expect(nodeBlock(renderXdotWithXlabel(shape), 'r')).toMatch(/_ldraw_="[^"]*T [-\d.]+ [-\d.]+ 0 [\d.]+ 2 -NX/);
  });

  it('the plain box node keeps its own xlabel (control)', () => {
    expect(nodeBlock(renderXdotWithXlabel(shape), 's')).toMatch(/_ldraw_="[^"]*2 -BX/);
  });
});

describe('xdot output — record xlabel matches the native oracle', () => {
  // Oracle (dot -Txdot -Kdot) for
  //   digraph { r [shape=record, label="<p1>x|<p2>y", xlabel="NX"];
  //             s [shape=box, xlabel="BX"]; r -> s }
  // r: xlp="10.11,117.4", _ldraw_ ... T 10.11 113.2 0 20.22 2 -NX
  // graph bb="0,0,74.221,125.8" — the bb includes the xlabel's extent; before
  // the fix the port emitted bb="0,0,73.448,109", short by the xlabel.
  const xdot = renderXdotWithXlabel('record');

  it('places the record xlabel at the oracle position', () => {
    expect(nodeBlock(xdot, 'r')).toContain('xlp="10.11,117.4"');
  });

  it('draws the record xlabel text at the oracle position', () => {
    expect(nodeBlock(xdot, 'r')).toContain('T 10.11 113.2 0 20.22 2 -NX');
  });

  it('grows the graph bb to cover the xlabel', () => {
    expect(xdot).toContain('bb="0,0,74.221,125.8"');
  });
});
