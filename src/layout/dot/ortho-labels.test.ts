// SPDX-License-Identifier: EPL-2.0

/**
 * T2 — edge-label positioning for splines=ortho.
 *
 * C parity (dotsplines.c:251-259 + ortho.c:1196-1199): when the graph has edge
 * labels, dot POSITIONS the labels (setEdgeLabelPos) then calls orthoEdges(g,
 * true) — which warns and downgrades useLbls=false. Edges are NOT routed around
 * labels (ADR-2). This test verifies: label positioned + warning emitted +
 * orthogonal spline; route geometry identical with/without a label (no
 * rerouting); and no warning / no positioning when there are no labels.
 *
 * @see lib/dotgen/dotsplines.c:setEdgeLabelPos, dot_splines_
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { makeEdgeInfo, makePort } from '../../model/edgeInfo.js';
import { dotSplines_, EDGETYPE_ORTHO } from './splines.js';
import { EDGE_LABEL, HEAD_LABEL, TAIL_LABEL } from './rank.js';
import { VIRTUAL } from './fastgr.js';

interface LabelObj { pos: { x: number; y: number }; dimen: { x: number; y: number }; set: boolean }

function makeGraph(): Graph {
  const g = new Graph('g', 'directed');
  g.info.nodesep = 36;
  g.info.ranksep = 36;
  g.info.flags = EDGETYPE_ORTHO;
  g.info.bb = { ll: { x: -100, y: -100 }, ur: { x: 100, y: 100 } };
  return g;
}

function makeNode(id: number, name: string, g: Graph, x: number, y: number): Node {
  const n = new Node(id, name, g);
  n.info = makeNodeInfo();
  n.info.coord = { x, y };
  n.info.lw = 18; n.info.rw = 18; n.info.ht = 36;
  g.nodes.set(name, n);
  return n;
}

function makeEdge(tail: Node, head: Node, g: Graph): Edge {
  const e = new Edge(tail, head, '');
  e.info = makeEdgeInfo(makePort(), makePort());
  g.edges.push(e);
  return e;
}

/** Two real nodes a→b plus, optionally, a VIRTUAL edge-label node in nlist. */
function buildGraph(withLabel: boolean): { g: Graph; e: Edge; label?: LabelObj } {
  const g = makeGraph();
  const a = makeNode(0, 'a', g, 0, 90);
  const b = makeNode(1, 'b', g, 0, 0);
  const e = makeEdge(a, b, g);
  // real-node rank list
  a.info.next = b;
  if (!withLabel) {
    g.info.nlist = a;
    return { g, e };
  }
  // Virtual label node carrying the edge label on its (normal) out-edge.
  const label: LabelObj = { pos: { x: 0, y: 0 }, dimen: { x: 20, y: 14 }, set: false };
  const vl = new Node(2, 'vl', g);
  vl.info = makeNodeInfo();
  vl.info.node_type = VIRTUAL;
  vl.info.coord = { x: 0, y: 45 };
  const lblEdge = new Edge(vl, b, '');
  lblEdge.info = makeEdgeInfo(makePort(), makePort());
  lblEdge.info.edge_type = 0; // normal — findNormalOutEdge stops here
  // only pos/dimen/set are read by setEdgeLabelPos/placeVnlabel/updateBB
  lblEdge.info.label = label as unknown as typeof lblEdge.info.label;
  vl.info.label = label as unknown as typeof vl.info.label;
  vl.info.in = { list: [e], size: 1 };
  vl.info.out = { list: [lblEdge], size: 1 };
  g.root.info.has_labels = EDGE_LABEL;
  a.info.next = b; b.info.next = vl; g.info.nlist = a;
  return { g, e, label };
}

function splPoints(e: Edge): string {
  return e.info.spl!.list[0]!.list.map((p) => `${p.x},${p.y}`).join(' ');
}

describe('dot splines=ortho edge labels (T2)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('positions the edge label and warns (no routing around it)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { g, e, label } = buildGraph(true);
    const rc = dotSplines_(g, true);

    expect(rc).toBe(0);
    expect(label!.set).toBe(true);
    expect(label!.pos.y).toBe(45); // vnode coord.y (placeVnlabel)
    expect(warn).toHaveBeenCalledOnce();
    expect(e.info.spl).toBeDefined();
    // orthogonal: single vertical run
    expect(new Set(e.info.spl!.list[0]!.list.map((p) => p.x)).size).toBe(1);
  });

  it('does NOT reroute around the label (geometry == no-label route)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const withL = buildGraph(true);
    const without = buildGraph(false);
    dotSplines_(withL.g, true);
    dotSplines_(without.g, true);
    expect(splPoints(withL.e)).toBe(splPoints(without.e));
  });

  it('no labels: no warning, no label placement (exactly T1)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { g, e } = buildGraph(false);
    const rc = dotSplines_(g, true);
    expect(rc).toBe(0);
    expect(warn).not.toHaveBeenCalled();
    expect(e.info.spl).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// splines=ortho port labels — C's `goto finish` lands ON the port-label block
// (dotsplines.c:436-458), so head/tail labels with labelangle/labeldistance
// are placed via place_portlabel for ortho too. Regression: 144_ortho.dot —
// the ortho dispatch returned without placing them, leaving the labels to the
// xlabels pass (wrong distance and angle, Δ up to 34.6).
// ---------------------------------------------------------------------------

describe('dot splines=ortho port labels (144_ortho)', () => {
  it('places head/tail labels via place_portlabel after ortho routing', () => {
    const { g, e } = buildGraph(false);
    const headLabel: LabelObj = { pos: { x: 0, y: 0 }, dimen: { x: 20, y: 14 }, set: false };
    const tailLabel: LabelObj = { pos: { x: 0, y: 0 }, dimen: { x: 20, y: 14 }, set: false };
    e.info.head_label = headLabel as unknown as typeof e.info.head_label;
    e.info.tail_label = tailLabel as unknown as typeof e.info.tail_label;
    e.attrs.set('labeldistance', '2.2');
    // The `headlabel`/`taillabel` ATTRS must be declared, not just the label
    // objects: C gates place_portlabel on `E_headlabel`/`E_taillabel`
    // (= agfindedgeattr, input.c:772), and `ED_head_label` is only ever created
    // by common_init_edge READING that attr — so a label object without its
    // attr is a state a real parse cannot produce. Setting only `info` (as this
    // test originally did) modelled an unreachable graph.
    e.attrs.set('headlabel', 'H');
    e.attrs.set('taillabel', 'T');
    g.info.has_labels = HEAD_LABEL | TAIL_LABEL;

    const rc = dotSplines_(g, true);
    expect(rc).toBe(0);
    expect(headLabel.set).toBe(true);
    expect(tailLabel.set).toBe(true);

    // place_portlabel: pos = pe + 10*labeldistance in direction
    // atan2(pf-pe) - 25° — assert the exact distance from the spline end.
    const bez = e.info.spl!.list[e.info.spl!.size - 1]!;
    const pe = bez.eflag ? bez.ep : bez.list[bez.size - 1]!;
    const d = Math.hypot(headLabel.pos.x - pe.x, headLabel.pos.y - pe.y);
    expect(d).toBeCloseTo(22, 6);
  });
});
