// SPDX-License-Identifier: EPL-2.0
/**
 * Tests for T36: flat edges, edge classification (class1/class2), abomination.
 * Covers the four acceptance criteria from the T36 task spec.
 */

import { describe, it, expect } from 'vitest';
import { class2 } from './classify.js';
import { abomination, hasInterveningNode, findlr } from './flat.js';
import { NORMAL, VIRTUAL } from './fastgr.js';
import type { RankEntry } from '../../model/rankEntry.js';
import type { Node } from '../../model/node.js';
import { makeTestGraph, addTestEdge, setupRanks } from './position.test.js';
import { renderSvg } from '../../index.js';

/** Build a minimal RankEntry from (order, node_type, label?) triples. */
function rankOf(specs: Array<{ order: number; type: number; label?: unknown }>): RankEntry {
  const v = specs.map(s => ({ info: { order: s.order, node_type: s.type, label: s.label } })) as unknown as Node[];
  return { n: v.length, v } as unknown as RankEntry;
}

// C checkFlatAdjacent (flat.c:211): a between-node blocks flat-edge adjacency
// only when it is a NORMAL node or a LABELED virtual node; an unlabeled virtual
// node (an edge merely passing through the rank) does NOT block.
describe('hasInterveningNode — node-type aware (flat.c:checkFlatAdjacent)', () => {
  it('a NORMAL node strictly between the endpoints blocks adjacency', () => {
    const rk = rankOf([{ order: 0, type: NORMAL }, { order: 1, type: NORMAL }, { order: 2, type: NORMAL }]);
    expect(hasInterveningNode(rk, 0, 2)).toBe(true);
  });

  it('an UNLABELED virtual node between does NOT block adjacency', () => {
    const rk = rankOf([{ order: 0, type: NORMAL }, { order: 1, type: VIRTUAL }, { order: 2, type: NORMAL }]);
    expect(hasInterveningNode(rk, 0, 2)).toBe(false);
  });

  it('a LABELED virtual node between blocks adjacency', () => {
    const rk = rankOf([{ order: 0, type: NORMAL }, { order: 1, type: VIRTUAL, label: {} }, { order: 2, type: NORMAL }]);
    expect(hasInterveningNode(rk, 0, 2)).toBe(true);
  });

  it('no node strictly between the endpoints → not blocked', () => {
    const rk = rankOf([{ order: 0, type: NORMAL }, { order: 2, type: NORMAL }]);
    expect(hasInterveningNode(rk, 0, 2)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC1: flat edge in class2 → NodeInfo.flatOut + GraphInfo.hasFlatEdges
// ---------------------------------------------------------------------------

describe('class2: flat edge (AC1)', () => {
  it('puts same-rank edge in flat_out and sets hasFlatEdges', () => {
    const [g, nodes] = makeTestGraph(2);
    setupRanks(g, [0, 0]);
    nodes[0].info.clust = undefined;
    nodes[1].info.clust = undefined;
    const e = addTestEdge(g, nodes[0], nodes[1]);
    class2(g);
    expect(g.info.has_flat_edges).toBe(true);
    const flatOut = nodes[0].info.flat_out;
    expect(flatOut).toBeDefined();
    expect(flatOut!.list.slice(0, flatOut!.size)).toContain(e);
  });
});

// ---------------------------------------------------------------------------
// AC2: forward edge spanning 3 ranks → 1 virtual node at rank 1, 2 virt edges
// ---------------------------------------------------------------------------

describe('class2: forward edge chain (AC2)', () => {
  it('creates virtual node at rank 1 and two virtual edges for A(0)→B(2)', () => {
    const [g, nodes] = makeTestGraph(2);
    setupRanks(g, [0, 2]);
    nodes[0].info.clust = undefined;
    nodes[1].info.clust = undefined;
    const e = addTestEdge(g, nodes[0], nodes[1]);
    class2(g);
    // e.info.to_virt is the first virtual edge: A → vn
    const ve1 = e.info.to_virt;
    expect(ve1).toBeDefined();
    const vn = ve1!.head;
    expect(vn.info.rank).toBe(1);
    // second virtual edge: vn → B
    const vnOut = vn.info.out;
    expect(vnOut).toBeDefined();
    const ve2 = vnOut!.list[0];
    expect(ve2).toBeDefined();
    expect(ve2.head).toBe(nodes[1]);
  });
});

// ---------------------------------------------------------------------------
// AC3: backward edge → make_chain called in reverse direction
// ---------------------------------------------------------------------------

describe('class2: backward edge (AC3)', () => {
  it('converts backward edge to forward virtual chain (head→tail direction)', () => {
    const [g, nodes] = makeTestGraph(2);
    // nodes[0] at rank 1, nodes[1] at rank 0 — edge goes from higher to lower rank
    setupRanks(g, [1, 0]);
    nodes[0].info.clust = undefined;
    nodes[1].info.clust = undefined;
    const e = addTestEdge(g, nodes[0], nodes[1]);
    class2(g);
    // make_chain(g, head, tail, e) should have run: chain from nodes[1](rank0) to nodes[0](rank1)
    // e.info.to_virt points to the first virtual edge in the reversed chain
    expect(e.info.to_virt).toBeDefined();
    // The chain starts at e.head (rank 0) going to e.tail (rank 1)
    const firstVirt = e.info.to_virt!;
    expect(firstVirt.tail.info.rank).toBe(0);
    expect(firstVirt.head.info.rank).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AC4: abomination — labeled non-adjacent flat edge at rank 0
// ---------------------------------------------------------------------------

function makeAbomGraph() {
  const [g] = makeTestGraph(0);
  g.info.minrank = 0;
  g.info.maxrank = 1;
  g.info.rank = [
    { n: 0, an: 0, v: [], av: [], ht1: 1, ht2: 1, pht1: 1, pht2: 1, candidate: false, valid: false, cache_nc: 0 },
    { n: 0, an: 0, v: [], av: [], ht1: 1, ht2: 1, pht1: 1, pht2: 1, candidate: false, valid: false, cache_nc: 0 },
  ];
  return g;
}

// AD-2: abomination renumbers 0-based (no negative indices). minrank stays 0,
// maxrank bumps by 1, a new empty rank is inserted at index 0, and every
// existing rank shifts up by one index.
describe('abomination: 0-based renumber (AC4)', () => {
  it('keeps minrank at 0 and bumps maxrank by 1', () => {
    const g = makeAbomGraph();
    abomination(g);
    expect(g.info.minrank).toBe(0);
    expect(g.info.maxrank).toBe(2);
  });
});

describe('abomination: new rank entry', () => {
  it('inserts an empty rank at index 0 and shifts existing ranks up', () => {
    const g = makeAbomGraph();
    const old0 = g.info.rank![0];
    const old1 = g.info.rank![1];
    abomination(g);
    expect(g.info.rank![0].n).toBe(0);
    expect(g.info.rank![0]).not.toBe(old0);
    expect(g.info.rank![1]).toBe(old0);
    expect(g.info.rank![2]).toBe(old1);
  });
});

// ---------------------------------------------------------------------------
// Cluster rank state must follow the +1 renumber (plantuml-ts xusuxe-62-guba767)
//
// C's abomination puts the flat-label rank at index -1 and never touches
// ND_rank, so a cluster's ABSOLUTE-rank-indexed state stays valid. The port
// renumbers +1 instead (AD-2), so that state has to move with it — otherwise
// rec_reset_vlists (mincross.c:reset_vlist) re-aliases the cluster's rank window
// onto the newly inserted label rank and contain_nodes reads a hole.
// @see lib/dotgen/flat.c:abomination
// ---------------------------------------------------------------------------

describe('abomination: shifts cluster rank state (AD-2)', () => {
  /** Root with one cluster occupying absolute rank 0. */
  function makeClusteredAbomGraph() {
    const g = makeAbomGraph();
    const [sub] = makeTestGraph(0);
    const leader = { info: { rank: 0, order: 0 } } as unknown as Node;
    sub.info.minrank = 0;
    sub.info.maxrank = 0;
    sub.info.rank = [
      { n: 2, an: 0, v: [], av: [], ht1: 1, ht2: 1, pht1: 1, pht2: 1,
        candidate: false, valid: false, cache_nc: 0, vStart: 0 },
    ] as unknown as RankEntry[];
    sub.info.rankleader = [leader];
    g.info.clust = [sub];
    g.info.n_cluster = 1;
    return { g, sub, leader, clusterRank0: sub.info.rank![0] };
  }

  it('bumps the cluster minrank/maxrank with the root renumber', () => {
    const { g, sub } = makeClusteredAbomGraph();
    abomination(g);
    expect(sub.info.minrank).toBe(1);
    expect(sub.info.maxrank).toBe(1);
  });

  it('moves the cluster rank entry up one absolute index', () => {
    const { g, sub, clusterRank0 } = makeClusteredAbomGraph();
    abomination(g);
    // The cluster's window (n=2) now lives at rank 1, where its nodes are.
    expect(sub.info.rank![1]).toBe(clusterRank0);
    expect(sub.info.rank![1].n).toBe(2);
    // The vacated slot is a fresh empty rank, not a stale alias of the window.
    expect(sub.info.rank![0]).not.toBe(clusterRank0);
    expect(sub.info.rank![0].n).toBe(0);
  });

  it('moves the cluster rankleader up one absolute index', () => {
    const { g, sub, leader } = makeClusteredAbomGraph();
    abomination(g);
    expect(sub.info.rankleader![1]).toBe(leader);
  });
});

// Regression (plantuml-ts fixture xusuxe-62-guba767): a labeled minlen=0 edge
// from an external node into a cluster member, with a second edge-less member.
// The labeled flat edge triggers abomination; before the cluster-rank shift the
// cluster window aliased the label rank (n=2 over a 1-element array) and
// contain_nodes threw "Cannot read properties of undefined (reading 'info')".
// Geometry is pinned by test/golden/{refs,refs-xdot}/dot-cluster-labeled-minlen0;
// this asserts the layout completes and lands on the native oracle's frame.
describe('labeled minlen=0 edge into a cluster (xusuxe-62-guba767)', () => {
  const src = `digraph G {
    nodesep=0.4861111111111111;
    ranksep=0.8333333333333334;
    subgraph cluster0 {
      label="Cloudogu Ecosystem";
      smeagol [shape=box, fixedsize=true, label="", width=4.215820313277778, height=1.1388888888888888];
      nexus   [shape=box, fixedsize=true, label="", width=4.0079888244166675, height=1.1388888888888888];
    }
    developer [shape=box, fixedsize=true, label="", width=0.925604926166667, height=1.0277777777777777];
    developer -> smeagol [minlen=0, label="\\"Edit Slides\\"", fontname="Times"];
  }`;

  it('lays out without throwing', () => {
    expect(() => renderSvg(src, 'dot')).not.toThrow();
  });

  it('matches the native oracle drawing frame', () => {
    // Native oracle: graph bb="0,0,745.32,253.8" -> svg viewBox 753 x 262.
    // Before the cluster-rank shift this input could not lay out at all.
    const svg = renderSvg(src, 'dot');
    expect(svg).toContain('viewBox="0.00 0.00 753.00 262.00"');
  });
});

// ---------------------------------------------------------------------------
// flat_limits / findlr — graphviz #1213
//
// A labeled flat edge's label virtual node must be placed on rank r-1 using C's
// topology-aware flat_limits (setbounds/findlr), NOT a crude order comparison.
// The previous port compared the r-1 vnodes' own orders against the flat edge's
// rank-r endpoint orders and placed the label too far left (order 3 instead of
// 8 for 1213-1's V1->V9). That shifted every constraint=false back-edge chain
// vnode +1 in order, perturbing their positions and routing corridors and
// warping V0->V2, V0->V3, V10->V6, V10->V7. The fix routes all 5 edges to byte
// parity with the C oracle. @see lib/dotgen/flat.c:flat_limits
// ---------------------------------------------------------------------------

describe('findlr (flat.c:findlr): sorted endpoint orders', () => {
  const nodeAt = (order: number): Node => ({ info: { order } }) as unknown as Node;
  it('returns [lo, hi] regardless of argument order', () => {
    expect(findlr(nodeAt(4), nodeAt(2))).toEqual([2, 4]);
    expect(findlr(nodeAt(2), nodeAt(4))).toEqual([2, 4]);
    expect(findlr(nodeAt(3), nodeAt(3))).toEqual([3, 3]);
  });
});

/** Parse the absolute control points of an SVG path `d` attribute. */
function pathPoints(d: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const re = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) out.push([Number(m[1]), Number(m[2])]);
  return out;
}

/** Extract edge title → path `d` from rendered SVG. */
function edgePaths(svg: string): Map<string, string> {
  const map = new Map<string, string>();
  const parts = svg.split(/<g [^>]*class="edge"/);
  for (let i = 1; i < parts.length; i++) {
    const tm = parts[i].match(/<title>([^<]+)<\/title>/);
    const dm = parts[i].match(/<path[^>]*\sd="([^"]+)"/);
    if (tm && dm) map.set(tm[1].replace(/&#45;/g, '-').replace(/&gt;/g, '>'), dm[1]);
  }
  return map;
}

// 1213-1 (constraint=false back edges through clusters + one labeled flat edge).
const DOT_1213_1 = `digraph G {
V4
V0
V2
subgraph cluster_0 { V3 V1 }
subgraph cluster_1 { V10 V5 V11 }
subgraph cluster_2 { V9 V8 V6 }
V7
V0 -> V3 [constraint=false]
V4 -> V0
V3 -> V1
V0 -> V2 [constraint=false]
V10 -> V6 [label=a,constraint=false]
V11 -> V10
V9 -> V8
V6 -> V9
V5 -> V11
V10 -> V7 [constraint=false]
V4 -> V5 [constraint=false]
V3 -> V6 [constraint=false]
V2 -> V7 [constraint=false]
V1 -> V9 [label=b,constraint=false]
V1 -> V8
V0 -> V11 [constraint=false]
V0 -> V10
}`;

// Oracle control points (native dot, GVBINDIR=/tmp/ghl, default Estimate
// measurer, SVG frame). These are the five edges the #1213 bug warped; before
// the flat_limits fix the port emitted extra bezier segments (e.g. V0->V2 had
// 13 control points vs the oracle's 10) so the point-count assertion fails on
// pre-fix code.
const ORACLE_1213_1: Record<string, string> = {
  'V0->V2': 'M50.15,-116.81C58.52,-119.74 68.1,-122.81 77,-125 151.47,-143.28 343.33,-160.37 418,-177.8 424.44,-179.3 431.22,-181.19 437.72,-183.15',
  'V0->V3': 'M50.6,-116.22C58.92,-119.07 68.35,-122.24 77,-125 146.71,-147.28 228.82,-171.39 274.6,-184.63',
  'V1->V9': 'M300.65,-124.3C290.66,-140.23 273.64,-160.44 254.5,-153.73 240.84,-148.95 227.99,-139.48 217.83,-130.31',
  'V10->V6': 'M139.79,-44.84C145.4,-47.22 151.41,-49.73 157,-52 190.12,-65.44 211.79,-51.52 232,-81 250.74,-108.34 232.01,-145.94 215.31,-170.31',
  'V10->V7': 'M138.65,-45.37C144.5,-47.85 150.9,-50.27 157,-52 240.04,-75.51 284.07,-24.14 349,-81 361.84,-92.25 371.9,-136.74 377.39,-166.65',
};

describe('flat_limits #1213: constraint=false splines match the C oracle', () => {
  const svg = renderSvg(DOT_1213_1, 'dot');
  const got = edgePaths(svg);
  for (const [title, oracleD] of Object.entries(ORACLE_1213_1)) {
    it(`${title} matches the oracle control points`, () => {
      const a = pathPoints(oracleD);
      const b = pathPoints(got.get(title) ?? '');
      // Same number of bezier control points (pre-fix emitted extra segments).
      expect(b.length).toBe(a.length);
      for (let i = 0; i < a.length; i++) {
        expect(b[i][0]).toBeCloseTo(a[i][0], 1);
        expect(b[i][1]).toBeCloseTo(a[i][1], 1);
      }
    });
  }
});
