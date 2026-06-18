// SPDX-License-Identifier: EPL-2.0
/**
 * Tests for mincross-order.ts: flat_mval, median, medians, save/restore_best,
 * reorder helpers, and mincross_step bounds.
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { fastEdge } from './fastgr.js';
import {
  flatMvalIn, flatMvalOut, flatMval,
  computeMedian,
  mediansCollectDir, mediansProcessNode,
  saveBest, restoreRank, restoreBest,
  reorderFindLp, reorderFindRp, reorderInner,
  mincrossStepBounds,
} from './mincross-order.js';
import type { MincrossContext } from './mincross-utils.js';
import type { RankEntry } from '../../model/rankEntry.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

export function makeCtx(root: Graph): MincrossContext {
  return {
    root,
    globalMinRank: root.info.minrank ?? 0,
    globalMaxRank: root.info.maxrank ?? 0,
    teList: [],
    tiList: [],
    reMincross: false,
    minQuit: 8,
    maxIter: 24,
  };
}

export function makeNode(g: Graph, id: number, name = `n${id}`): Node {
  const n = new Node(id, name, g);
  g.nodes.set(n.name, n);
  return n;
}

export function makeEdge(tail: Node, head: Node): Edge {
  const e = new Edge(tail, head, '');
  fastEdge(e);
  return e;
}

function makeRankEntry(nodes: Node[], n?: number): RankEntry {
  return {
    n: n ?? nodes.length,
    v: nodes,
    an: nodes.length,
    av: nodes,
    ht1: 0, ht2: 0, pht1: 0, pht2: 0,
    candidate: false,
    valid: false,
    cache_nc: 0,
  };
}

// ---------------------------------------------------------------------------
// flatMvalIn / flatMvalOut / flatMval
// ---------------------------------------------------------------------------

describe('flatMvalIn mval>=0', () => {
  it('returns false and sets mval=nnMval+1 when best neighbor has mval>=0', () => {
    const g = new Graph('g', 'directed');
    const a = makeNode(g, 0, 'a');
    const b = makeNode(g, 1, 'b');
    a.info.order = 0;
    b.info.order = 1;
    b.info.mval = 3;
    const e1 = makeEdge(a, b);
    const e2 = makeEdge(b, b);
    b.info.flat_in = { list: [e1, e2], size: 2 };
    const target = makeNode(g, 2, 'c');
    const fi = { list: [e1, e2], size: 2 };
    const result = flatMvalIn(target, fi);
    expect(result).toBe(false);
    expect(target.info.mval).toBe(4);
  });
});

describe('flatMvalIn mval<0', () => {
  it('returns true when best neighbor has mval<0', () => {
    const g = new Graph('g', 'directed');
    const a = makeNode(g, 0, 'a');
    const b = makeNode(g, 1, 'b');
    a.info.order = 0;
    b.info.order = 1;
    b.info.mval = -1;
    const e = makeEdge(a, b);
    const target = makeNode(g, 2, 'c');
    const fi = { list: [e], size: 1 };
    const result = flatMvalIn(target, fi);
    expect(result).toBe(true);
  });
});

describe('flatMvalOut', () => {
  it('returns false and sets mval=nnMval-1 when best neighbor has mval>0', () => {
    const g = new Graph('g', 'directed');
    const a = makeNode(g, 0, 'a');
    const b = makeNode(g, 1, 'b');
    a.info.order = 0;
    b.info.order = 1;
    b.info.mval = 5;
    const e = makeEdge(a, b);
    const target = makeNode(g, 2, 'c');
    const fo = { list: [e], size: 1 };
    const result = flatMvalOut(target, fo);
    expect(result).toBe(false);
    expect(target.info.mval).toBe(4);
  });

  it('returns true when best neighbor has mval<=0', () => {
    const g = new Graph('g', 'directed');
    const a = makeNode(g, 0, 'a');
    const b = makeNode(g, 1, 'b');
    a.info.order = 1;
    b.info.order = 0;
    a.info.mval = 0;
    const e = makeEdge(a, b);
    const target = makeNode(g, 2, 'c');
    const fo = { list: [e], size: 1 };
    const result = flatMvalOut(target, fo);
    expect(result).toBe(true);
  });
});

describe('flatMval', () => {
  it('uses flat_in if present', () => {
    const g = new Graph('g', 'directed');
    const a = makeNode(g, 0, 'a');
    const b = makeNode(g, 1, 'b');
    b.info.order = 2; b.info.mval = 1;
    const e = makeEdge(b, a);
    const target = makeNode(g, 2, 'c');
    target.info.flat_in = { list: [e], size: 1 };
    expect(flatMval(target)).toBe(false);
    expect(target.info.mval).toBe(2);
  });

  it('returns true when node has no flat edges', () => {
    const g = new Graph('g', 'directed');
    const n = makeNode(g, 0, 'a');
    expect(flatMval(n)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeMedian
// ---------------------------------------------------------------------------

describe('computeMedian', () => {
  it('returns -1 for empty list', () => {
    expect(computeMedian([])).toBe(-1);
  });

  it('returns single element unchanged', () => {
    expect(computeMedian([7])).toBe(7);
  });

  it('returns average of two elements', () => {
    expect(computeMedian([3, 7])).toBe(5);
  });

  it('returns middle element for odd-length list', () => {
    expect(computeMedian([5, 1, 3])).toBe(3);
  });

  it('computes weighted median for 4 elements', () => {
    // list after sort: [1, 3, 5, 7], m=2
    // left = list[1]-list[0] = 3-1 = 2
    // right = list[3]-list[2] = 7-5 = 2
    // result = (list[1]*right + list[2]*left) / (left+right) = (3*2 + 5*2) / 4 = 4
    expect(computeMedian([7, 1, 3, 5])).toBe(4);
  });

  it('sorts input before computing', () => {
    // [1,9,3,7] sorted → [1,3,7,9]; left=2, right=2 → (3*2+7*2)/4 = 5
    expect(computeMedian([1, 9, 3, 7])).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// mediansCollectDir
// ---------------------------------------------------------------------------

describe('mediansCollectDir: collects in-edges', () => {
  it('collects from in-edges when d < vRank', () => {
    const g = new Graph('g', 'directed');
    const a = makeNode(g, 0, 'a');
    const b = makeNode(g, 1, 'b');
    a.info.rank = 0;
    b.info.rank = 2;
    b.info.order = 3;
    const e = makeEdge(a, b);
    e.info.xpenalty = 1;
    e.info.tail_port = { p: { x: 0, y: 0 }, theta: 0, bp: null, defined: false, constrained: false, clip: false, dyna: false, order: 0, side: 0, name: '' };
    const v = makeNode(g, 2, 'v');
    v.info.rank = 2;
    v.info.in = { list: [e], size: 1 };
    const list: number[] = [];
    mediansCollectDir(v, 0, list);
    expect(list).toHaveLength(1);
  });
});

describe('mediansCollectDir: skips zero-penalty', () => {
  it('skips edges with xpenalty<=0', () => {
    const g = new Graph('g', 'directed');
    const a = makeNode(g, 0, 'a');
    const b = makeNode(g, 1, 'b');
    a.info.rank = 0;
    const e = makeEdge(a, b);
    e.info.xpenalty = 0;
    const v = makeNode(g, 2, 'v');
    v.info.rank = 1;
    v.info.in = { list: [e], size: 1 };
    const list: number[] = [];
    mediansCollectDir(v, 0, list);
    expect(list).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// mediansProcessNode
// ---------------------------------------------------------------------------

describe('mediansProcessNode', () => {
  // Regression (mincross.c:1646): medians computes a median for EVERY node, no
  // cluster skip. A clustered node with a non-flat edge must get a real mval
  // (returns false), else reorderFindLp drops it (undefined->-1) and the cluster
  // skeleton never reorders. Returned true (mval undefined) before the fix.
  it('computes a median for a clustered node with edges (no cluster skip)', () => {
    const g = new Graph('g', 'directed');
    const n = makeNode(g, 0, 'n');
    n.info.rank = 0;
    n.info.clust = g;
    const m = makeNode(g, 1, 'm');
    m.info.rank = 1;
    m.info.order = 0;
    const e = makeEdge(n, m);
    e.info.xpenalty = 1;
    e.info.head_port = { p: { x: 0, y: 0 }, theta: 0, bp: null, defined: false, constrained: false, clip: false, dyna: false, order: 0, side: 0, name: '' };
    n.info.out = { list: [e], size: 1 }; // d=1 > rank(n)=0 -> out-edge head val
    expect(mediansProcessNode(n, 1)).toBe(false);
    expect(n.info.mval).toBe(0);
  });

  it('calls flatMval and returns its result for an edgeless node', () => {
    const g = new Graph('g', 'directed');
    const n = makeNode(g, 0, 'n');
    n.info.clust = g; // cluster membership no longer forces fixed; edgelessness does
    expect(mediansProcessNode(n, 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// saveBest / restoreRank / restoreBest
// ---------------------------------------------------------------------------

describe('saveBest', () => {
  it('copies order into coord.x for all nodes in all ranks', () => {
    const g = new Graph('g', 'directed');
    g.info.minrank = 0;
    g.info.maxrank = 0;
    const a = makeNode(g, 0, 'a');
    a.info.order = 5;
    a.info.coord = { x: 0, y: 0 };
    const rk: RankEntry = makeRankEntry([a]);
    g.info.rank = [rk];
    saveBest(g);
    expect(a.info.coord.x).toBe(5);
  });
});

describe('restoreRank', () => {
  it('restores order from coord.x and re-sorts the rank array', () => {
    const g = new Graph('g', 'directed');
    const a = makeNode(g, 0, 'a');
    const b = makeNode(g, 1, 'b');
    a.info.order = 1; a.info.coord = { x: 0, y: 0 };
    b.info.order = 0; b.info.coord = { x: 1, y: 0 };
    const rk: RankEntry = makeRankEntry([a, b]);
    const rootRk: RankEntry = makeRankEntry([a, b]);
    rootRk.valid = true;
    restoreRank(rk, rootRk);
    expect(rk.v[0].info.order).toBe(0);
    expect(rk.v[1].info.order).toBe(1);
    expect(rootRk.valid).toBe(false);
  });
});

describe('restoreBest', () => {
  it('calls restoreRank for each rank', () => {
    const g = new Graph('g', 'directed');
    g.info.minrank = 0;
    g.info.maxrank = 0;
    const a = makeNode(g, 0, 'a');
    a.info.order = 0; a.info.coord = { x: 0, y: 0 };
    const rootG = new Graph('root', 'directed');
    rootG.info.minrank = 0;
    rootG.info.maxrank = 0;
    const rk = makeRankEntry([a]);
    const rootRk = makeRankEntry([a]);
    rootRk.valid = true;
    g.info.rank = [rk];
    rootG.info.rank = [rootRk];
    const ctx = makeCtx(rootG);
    restoreBest(ctx, g);
    expect(rootRk.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// reorderFindLp
// ---------------------------------------------------------------------------

describe('reorderFindLp', () => {
  it('advances past nodes with mval<0', () => {
    const g = new Graph('g', 'directed');
    const a = makeNode(g, 0, 'a');
    const b = makeNode(g, 1, 'b');
    const c = makeNode(g, 2, 'c');
    a.info.mval = -1;
    b.info.mval = -1;
    c.info.mval = 2;
    expect(reorderFindLp([a, b, c], 0, 3)).toBe(2);
  });

  it('returns ep when all nodes have mval<0', () => {
    const g = new Graph('g', 'directed');
    const a = makeNode(g, 0, 'a');
    a.info.mval = -1;
    expect(reorderFindLp([a], 0, 1)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// reorderFindRp
// ---------------------------------------------------------------------------

describe('reorderFindRp', () => {
  it('returns next node with mval>=0 as non-muststay', () => {
    const g = new Graph('g', 'directed');
    g.info.rank = [makeRankEntry([])];
    const a = makeNode(g, 0, 'a');
    const b = makeNode(g, 1, 'b');
    const c = makeNode(g, 2, 'c');
    a.info.rank = 0; b.info.rank = 0; c.info.rank = 0;
    a.info.order = 0; b.info.order = 1; c.info.order = 2;
    a.info.mval = 0;
    b.info.mval = -1;
    c.info.mval = 1;
    const result = reorderFindRp(g, [a, b, c], 0, 3);
    expect(result.muststay).toBe(false);
    expect(result.rp).toBe(2);
  });

  it('returns ep when no valid rp found', () => {
    const g = new Graph('g', 'directed');
    g.info.rank = [makeRankEntry([])];
    const a = makeNode(g, 0, 'a');
    const b = makeNode(g, 1, 'b');
    a.info.rank = 0; b.info.rank = 0;
    a.info.order = 0; b.info.order = 1;
    a.info.mval = 0; b.info.mval = -1;
    const result = reorderFindRp(g, [a, b], 0, 2);
    expect(result.rp).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// reorderInner
// ---------------------------------------------------------------------------

describe('reorderInner: swaps', () => {
  it('swaps nodes when p1>p2 (normal direction)', () => {
    const g = new Graph('g', 'directed');
    const rootG = new Graph('root', 'directed');
    rootG.info.rank = [makeRankEntry([])];
    g.info.rank = [makeRankEntry([])];
    const ctx = makeCtx(rootG);
    const a = makeNode(g, 0, 'a');
    const b = makeNode(g, 1, 'b');
    a.info.rank = 0; b.info.rank = 0;
    a.info.order = 0; b.info.order = 1;
    a.info.mval = 3; b.info.mval = 1;
    rootG.info.rank![0].v = [a, b];
    const changed = reorderInner(ctx, g, [a, b], 2, false);
    expect(changed).toBe(true);
  });
});

describe('reorderInner: no-swap', () => {
  it('does not swap when p1<=p2 (normal direction)', () => {
    const g = new Graph('g', 'directed');
    const rootG = new Graph('root', 'directed');
    rootG.info.rank = [makeRankEntry([])];
    g.info.rank = [makeRankEntry([])];
    const ctx = makeCtx(rootG);
    const a = makeNode(g, 0, 'a');
    const b = makeNode(g, 1, 'b');
    a.info.rank = 0; b.info.rank = 0;
    a.info.order = 0; b.info.order = 1;
    a.info.mval = 1; b.info.mval = 3;
    rootG.info.rank![0].v = [a, b];
    const changed = reorderInner(ctx, g, [a, b], 2, false);
    expect(changed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// mincrossStepBounds
// ---------------------------------------------------------------------------

export function makeCtxForBounds(mn: number, mx: number, rootMn: number, rootMx: number): MincrossContext {
  const root = new Graph('root', 'directed');
  root.info.minrank = rootMn;
  root.info.maxrank = rootMx;
  const g = new Graph('g', 'directed');
  g.info.minrank = mn;
  g.info.maxrank = mx;
  const ctx = makeCtx(root);
  return ctx;
}

describe('mincrossStepBounds sweep direction', () => {
  it('returns forward sweep (dir=1) for even pass', () => {
    const root = new Graph('root', 'directed');
    root.info.minrank = 0;
    root.info.maxrank = 5;
    const g = new Graph('g', 'directed');
    g.info.minrank = 0;
    g.info.maxrank = 5;
    const ctx = makeCtx(root);
    const b = mincrossStepBounds(ctx, g, 0);
    expect(b.dir).toBe(1);
    expect(b.last).toBe(5);
  });

  it('returns backward sweep (dir=-1) for odd pass', () => {
    const root = new Graph('root', 'directed');
    root.info.minrank = 0;
    root.info.maxrank = 5;
    const g = new Graph('g', 'directed');
    g.info.minrank = 0;
    g.info.maxrank = 5;
    const ctx = makeCtx(root);
    const b = mincrossStepBounds(ctx, g, 1);
    expect(b.dir).toBe(-1);
    expect(b.last).toBe(0);
  });
});

describe('mincrossStepBounds even pass first', () => {
  it('even pass: first=mn+1 when g is root (mn===rootMn)', () => {
    const root = new Graph('root', 'directed');
    root.info.minrank = 0;
    root.info.maxrank = 4;
    const g = new Graph('g', 'directed');
    g.info.minrank = 0;
    g.info.maxrank = 4;
    const ctx = makeCtx(root);
    const b = mincrossStepBounds(ctx, g, 0);
    expect(b.first).toBe(1);
  });

  it('even pass: first=mn when mn>rootMn (subgraph starts below root)', () => {
    const root = new Graph('root', 'directed');
    root.info.minrank = 0;
    root.info.maxrank = 5;
    const g = new Graph('g', 'directed');
    g.info.minrank = 2;
    g.info.maxrank = 5;
    const ctx = makeCtxForBounds(2, 5, 0, 5);
    const b = mincrossStepBounds(ctx, g, 0);
    expect(b.first).toBe(2);
  });
});

describe('mincrossStepBounds odd pass first', () => {
  it('odd pass: first=mx-1 when mx===rootMx', () => {
    const root = new Graph('root', 'directed');
    root.info.minrank = 0;
    root.info.maxrank = 4;
    const g = new Graph('g', 'directed');
    g.info.minrank = 0;
    g.info.maxrank = 4;
    const ctx = makeCtx(root);
    const b = mincrossStepBounds(ctx, g, 1);
    expect(b.first).toBe(3);
  });
});
