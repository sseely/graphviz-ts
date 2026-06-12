// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for place_root_label and the root-graph-label bb expansion
 * wired into gvPostprocess.
 *
 * Test setup: bb={ll:{0,0},ur:{100,50}}, label.dimen={40,12}.
 * PAD adds XPAD=16→dimX=56, YPAD=8→dimY=20 to the dimen passed to placeRootLabel.
 *
 * Default (labelloc absent, labeljust absent): LABEL_AT_BOTTOM, centered
 *   px = (0+100)/2 = 50;  py = 0 + 20/2 = 10
 * labelloc="t": LABEL_AT_TOP
 *   px = 50;              py = 50 - 20/2 = 40
 * labeljust="l": LABEL_AT_LEFT
 *   px = 0 + 56/2 = 28;  py = 10
 * labeljust="r": LABEL_AT_RIGHT
 *   px = 100 - 56/2 = 72; py = 10
 *
 * @see lib/common/postproc.c:place_root_label
 * @see lib/common/postproc.c:619-655 (bb expansion)
 */

import { describe, it, expect } from 'vitest';
import { gvPostprocess, placeRootLabel } from './postproc.js';
import { Graph } from '../model/graph.js';
import { Node } from '../model/node.js';
import { RANKDIR_TB } from '../layout/dot/init.js';
import type { TextlabelT } from './types.js';

/** Cast g.info.label to TextlabelT for assertion access. */
function getLabel(g: Graph): TextlabelT {
  return g.info.label as TextlabelT;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeTestGraph(rankdir: number): Graph {
  const g = new Graph('test', 'directed');
  g.info.rankdir = (rankdir << 2) | rankdir;
  g.info.bb = { ll: { x: 0, y: 0 }, ur: { x: 100, y: 50 } };
  return g;
}

function addNode(g: Graph): Node {
  const n = new Node(g.nodes.size, 'n', g);
  n.info.coord = { x: 10, y: 20 };
  n.info.width = 1;
  n.info.height = 0.5;
  n.info.lw = 36;
  n.info.rw = 36;
  n.info.ht = 36;
  g.nodes.set(n.name, n);
  return n;
}

/** Build a minimal stub label (set=false) for placeRootLabel tests. */
function makeStubLabel(dimenX: number, dimenY: number): TextlabelT {
  return {
    text: 'gl',
    fontname: 'Helvetica',
    fontcolor: 'black',
    charset: 0,
    fontsize: 14,
    dimen: { x: dimenX, y: dimenY },
    space: { x: dimenX, y: dimenY },
    pos: { x: 0, y: 0 },
    u: { kind: 'txt', span: [], nspans: 0 },
    valign: 0,
    set: false,
    html: false,
  };
}

/** Graph with label attached, bb={ll:{0,0},ur:{100,50}}, TB rankdir. */
function makeLabeledGraph(attrs: Record<string, string> = {}): Graph {
  const g = makeTestGraph(RANKDIR_TB);
  for (const [k, v] of Object.entries(attrs)) g.attrs.set(k, v);
  g.info.label = makeStubLabel(40, 12);
  return g;
}

// ---------------------------------------------------------------------------
// placeRootLabel — unit tests (dimen already PAD-expanded by caller)
// @see lib/common/postproc.c:174-200
// ---------------------------------------------------------------------------

function assertBottomCentered(): void {
  const g = makeLabeledGraph();
  placeRootLabel(g, { x: 56, y: 20 });
  const lbl = getLabel(g);
  expect(lbl.pos.x).toBeCloseTo(50, 6);
  expect(lbl.pos.y).toBeCloseTo(10, 6);
  expect(lbl.set).toBe(true);
}

function assertTop(): void {
  const g = makeLabeledGraph({ labelloc: 't' });
  placeRootLabel(g, { x: 56, y: 20 });
  const lbl = getLabel(g);
  expect(lbl.pos.x).toBeCloseTo(50, 6);
  expect(lbl.pos.y).toBeCloseTo(40, 6);
  expect(lbl.set).toBe(true);
}

function assertLeft(): void {
  const g = makeLabeledGraph({ labeljust: 'l' });
  placeRootLabel(g, { x: 56, y: 20 });
  const lbl = getLabel(g);
  expect(lbl.pos.x).toBeCloseTo(28, 6);
  expect(lbl.pos.y).toBeCloseTo(10, 6);
}

function assertRight(): void {
  const g = makeLabeledGraph({ labeljust: 'r' });
  placeRootLabel(g, { x: 56, y: 20 });
  const lbl = getLabel(g);
  expect(lbl.pos.x).toBeCloseTo(72, 6);
  expect(lbl.pos.y).toBeCloseTo(10, 6);
}

function assertAbsentLabelNoop(): void {
  const g = makeTestGraph(RANKDIR_TB);
  expect(() => placeRootLabel(g, { x: 56, y: 20 })).not.toThrow();
  expect(g.info.label).toBeUndefined();
}

describe('placeRootLabel: label positioned correctly per labelpos/labeljust', () => {
  it('default (bottom, centered): py = ll.y + dimY/2', assertBottomCentered);
  it('labelloc="t": py = ur.y - dimY/2', assertTop);
  it('labeljust="l": px = ll.x + dimX/2', assertLeft);
  it('labeljust="r": px = ur.x - dimX/2', assertRight);
  it('absent label: no-op, no throw', assertAbsentLabelNoop);
});

// ---------------------------------------------------------------------------
// gvPostprocess end-to-end: root graph label creation + placement
//
// With bb={ll:{0,0},ur:{100,50}} and label.dimen={40,12}:
//   expandBbForRootLabel → dimen={56,20}; default=BOTTOM+TB → bb.ll.y -= 20
//   Offset = ll = {0,-20}; translateDrawing shifts coords; bb.ll becomes {0,0}
//   placeRootLabel: py = 0 + 10 = 10; px = 50
// @see lib/common/postproc.c:619-655, 675-676
// ---------------------------------------------------------------------------

function assertE2eBottomCenter(): void {
  const g = makeTestGraph(RANKDIR_TB);
  addNode(g);
  g.info.label = makeStubLabel(40, 12);
  gvPostprocess(g);
  const lbl = getLabel(g);
  expect(lbl).toBeDefined();
  expect(lbl.set).toBe(true);
  expect(lbl.pos.x).toBeCloseTo(50, 4);
  expect(lbl.pos.y).toBeCloseTo(10, 4);
}

function assertE2eTop(): void {
  const g = makeTestGraph(RANKDIR_TB);
  addNode(g);
  g.attrs.set('labelloc', 't');
  g.info.label = makeStubLabel(40, 12);
  gvPostprocess(g);
  const lbl = getLabel(g);
  expect(lbl.set).toBe(true);
  // Top: bb.ur.y expanded by 20 → 70; after offset (ll.y=0): ur.y=70; py=70-10=60
  expect(lbl.pos.y).toBeCloseTo(60, 4);
}

function assertE2eNoLabel(): void {
  const g = makeTestGraph(RANKDIR_TB);
  addNode(g);
  expect(() => gvPostprocess(g)).not.toThrow();
  expect(g.info.label).toBeUndefined();
}

describe('gvPostprocess: root graph label end-to-end', () => {
  it('label present → set=true, positioned at bottom-center', assertE2eBottomCenter);
  it('labelloc="t" → label placed at top', assertE2eTop);
  it('no graph label → postprocess completes, label stays undefined', assertE2eNoLabel);
});
