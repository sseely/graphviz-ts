// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for placeRegularEdgeLabels — the post-routing virtual-node label
 * placement loop ported from dotsplines.c:422-430.
 *
 * @see lib/dotgen/dotsplines.c:422-430
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { makeEdgeInfo, makePort } from '../../model/edgeInfo.js';
import type { TextlabelT } from '../../common/types.js';
import { VIRTUAL, NORMAL } from './fastgr.js';
import { placeRegularEdgeLabels } from './splines-label.js';

// ---------------------------------------------------------------------------
// Minimal builders
// ---------------------------------------------------------------------------

function makeGraph(): Graph {
  const g = new Graph('g', 'directed');
  g.info.bb = { ll: { x: 0, y: 0 }, ur: { x: 200, y: 200 } };
  return g;
}

function makeVirtualNode(id: number, name: string, g: Graph, x: number, y: number): Node {
  const n = new Node(id, name, g);
  n.info = makeNodeInfo();
  n.info.node_type = VIRTUAL;
  n.info.coord = { x, y };
  n.info.lw = 20;
  n.info.rw = 20;
  n.info.ht = 10;
  return n;
}

function makeTextLabel(w: number, h: number): TextlabelT {
  return {
    text: 'lbl', fontname: 'Helvetica', fontcolor: 'black',
    charset: 0, fontsize: 14,
    dimen: { x: w, y: h }, space: { x: w, y: h }, pos: { x: 0, y: 0 },
    u: { kind: 'txt', span: [], nspans: 0 },
    valign: 0, set: false, html: false,
  };
}

function makeEdge(tail: Node, head: Node, g: Graph): Edge {
  const e = new Edge(tail, head, '');
  e.info = makeEdgeInfo(makePort(), makePort());
  g.edges.push(e);
  return e;
}

function linkIn(vn: Node, src: Node, g: Graph): Edge {
  const e = makeEdge(src, vn, g);
  vn.info.in = { list: [e], size: 1 };
  return e;
}

function linkOut(vn: Node, dst: Node, g: Graph): Edge {
  const e = makeEdge(vn, dst, g);
  vn.info.out = { list: [e], size: 1 };
  return e;
}

/**
 * Build a minimal single-vn chain: src → vn → dst.
 * Returns [g, vn, label].  vn is the only entry in g.info.nlist.
 */
function buildSingleVnChain(
  vnX: number, vnY: number, lblW: number, lblH: number,
): [Graph, Node, TextlabelT] {
  const g = makeGraph();
  const src = makeVirtualNode(0, 'src', g, 0, 0);
  src.info.node_type = NORMAL;
  const vn  = makeVirtualNode(1, 'vn', g, vnX, vnY);
  const dst = makeVirtualNode(2, 'dst', g, vnX * 2, 0);
  dst.info.node_type = NORMAL;
  const label = makeTextLabel(lblW, lblH);
  vn.info.label = label;
  linkIn(vn, src, g);
  const outEdge = linkOut(vn, dst, g);
  outEdge.info.label = label;
  g.info.nlist = vn;
  return [g, vn, label];
}

// ---------------------------------------------------------------------------
// placeRegularEdgeLabels — single virtual node
// ---------------------------------------------------------------------------

describe('placeRegularEdgeLabels', () => {
  it('sets pos.x = coord.x + w/2 and pos.y = coord.y', () => {
    // @see lib/dotgen/dotsplines.c:place_vnlabel
    const [g, , label] = buildSingleVnChain(40, 100, 30, 14);
    placeRegularEdgeLabels(g);
    // x = 40 + 30/2 = 55, y = 100
    expect(label.pos.x).toBe(55);
    expect(label.pos.y).toBe(100);
    expect(label.set).toBe(true);
  });

  it('skips NORMAL nodes', () => {
    const g = makeGraph();
    const n = makeVirtualNode(0, 'n', g, 40, 100);
    n.info.node_type = NORMAL;
    const label = makeTextLabel(20, 10);
    n.info.label = label;
    g.info.nlist = n;
    placeRegularEdgeLabels(g);
    expect(label.set).toBe(false);
  });

  it('skips virtual nodes with no label', () => {
    const g = makeGraph();
    const vn = makeVirtualNode(0, 'vn', g, 40, 100);
    const src = makeVirtualNode(1, 'src', g, 0, 0);
    src.info.node_type = NORMAL;
    linkIn(vn, src, g);
    g.info.nlist = vn;
    expect(() => placeRegularEdgeLabels(g)).not.toThrow();
  });

  it('skips flat-edge virtual nodes (in.size===0)', () => {
    // @see lib/dotgen/dotsplines.c:place_vnlabel — if in_val(n)==0 return
    const g = makeGraph();
    const vn  = makeVirtualNode(0, 'vn', g, 40, 100);
    const dst = makeVirtualNode(1, 'dst', g, 80, 0);
    dst.info.node_type = NORMAL;
    const label = makeTextLabel(20, 10);
    vn.info.label = label;
    const outEdge = linkOut(vn, dst, g);
    outEdge.info.label = label;
    // vn.info.in is undefined → in.size===0 guard fires
    g.info.nlist = vn;
    placeRegularEdgeLabels(g);
    expect(label.set).toBe(false);
  });

  it('expands g.info.bb to include the label bounding box', () => {
    // @see lib/dotgen/dotsplines.c:updateBB call at 422-430
    const [g, , label] = buildSingleVnChain(20, 20, 40, 20);
    g.info.bb = { ll: { x: 50, y: 50 }, ur: { x: 100, y: 100 } };
    placeRegularEdgeLabels(g);
    // pos.x=40 pos.y=20; label hw=20 hh=10 → extends to ll=(20,10)
    expect(g.info.bb.ll.x).toBeLessThanOrEqual(20);
    expect(g.info.bb.ll.y).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// placeRegularEdgeLabels — multiple virtual nodes in nlist
// ---------------------------------------------------------------------------

describe('placeRegularEdgeLabels — multi-node nlist', () => {
  it('processes all virtual nodes in nlist order', () => {
    const g = makeGraph();
    const src = makeVirtualNode(0, 'src', g, 0, 0);
    src.info.node_type = NORMAL;
    const vn1 = makeVirtualNode(1, 'vn1', g, 40, 100);
    const vn2 = makeVirtualNode(2, 'vn2', g, 80, 200);
    const dst = makeVirtualNode(3, 'dst', g, 120, 300);
    dst.info.node_type = NORMAL;
    const lbl1 = makeTextLabel(20, 10);
    const lbl2 = makeTextLabel(30, 12);
    vn1.info.label = lbl1;
    vn2.info.label = lbl2;
    linkIn(vn1, src, g);
    const e1 = linkOut(vn1, vn2, g);
    e1.info.label = lbl1;
    linkIn(vn2, vn1, g);
    const e2 = linkOut(vn2, dst, g);
    e2.info.label = lbl2;
    g.info.nlist = vn1;
    vn1.info.next = vn2;
    placeRegularEdgeLabels(g);
    expect(lbl1.set).toBe(true);
    expect(lbl2.set).toBe(true);
    expect(lbl1.pos.y).toBe(100);
    expect(lbl2.pos.y).toBe(200);
  });
});
