// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect, beforeEach } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { CIRCO_LAYOUT_ENGINE, circoLayoutFull } from './index.js';
import { buildDerivedGraph, buildDerivedEdges, derivedComponents } from './circular.js';
import { createBlocktree } from './blocktree.js';
import { blockGraph, buildSpanTree, findLongestPath } from './blockpath.js';
import { makeCircState } from './blocks.js';
import type { SubGraph } from './blocks.js';
import { circoInitGraph } from './init.js';

let _id = 0;
export function freshGraph(name = 'g'): Graph { _id = 0; return new Graph(name, 'undirected'); }
export function addNode(g: Graph, name: string): Node {
  const n = new Node(_id++, name, g);
  n.info = makeNodeInfo(); n.info.lw = 18; n.info.rw = 18; n.info.ht = 18;
  g.nodes.set(name, n); return n;
}
export function addEdge(g: Graph, t: Node, h: Node): void { g.edges.push(new Edge(t, h, `${t.name}-${h.name}`)); }
export function makeK4(): Graph {
  const g = freshGraph('k4'); const ns = ['a','b','c','d'].map((x) => addNode(g, x));
  for (let i = 0; i < ns.length; i++) for (let j = i+1; j < ns.length; j++) addEdge(g, ns[i]!, ns[j]!);
  return g;
}
export function makeRing(n: number): Graph {
  const g = freshGraph(`ring${n}`);
  const nodes = Array.from({length: n}, (_, i) => addNode(g, `n${i}`));
  for (let i = 0; i < n; i++) addEdge(g, nodes[i]!, nodes[(i+1)%n]!);
  return g;
}
export function makeTriangle(prefix: string): Graph {
  const g = freshGraph(`tri_${prefix}`);
  const [a, b, c] = ['a','b','c'].map((x) => addNode(g, `${prefix}_${x}`));
  addEdge(g, a!, b!); addEdge(g, b!, c!); addEdge(g, c!, a!); return g;
}
export function mergeGraphs(g1: Graph, g2: Graph): Graph {
  const g = freshGraph('merged');
  for (const [k,n] of g1.nodes) g.nodes.set(k,n); for (const [k,n] of g2.nodes) g.nodes.set(k,n);
  for (const e of g1.edges) g.edges.push(e); for (const e of g2.edges) g.edges.push(e);
  return g;
}
export function nodePositions(g: Graph): Array<{x:number;y:number}> {
  return [...g.nodes.values()].map((n) => ({x: n.info.pos?.[0] ?? n.info.coord.x, y: n.info.pos?.[1] ?? n.info.coord.y}));
}
export function allDistinct(positions: Array<{x:number;y:number}>): boolean {
  for (let i = 0; i < positions.length; i++) for (let j = i+1; j < positions.length; j++) {
    if (Math.hypot(positions[i]!.x - positions[j]!.x, positions[i]!.y - positions[j]!.y) < 0.1) return false;
  }
  return true;
}

describe('CIRCO_LAYOUT_ENGINE identity', () => {
  it('has type "circo"', () => { expect(CIRCO_LAYOUT_ENGINE.type).toBe('circo'); });
  it('exposes layout function', () => { expect(typeof CIRCO_LAYOUT_ENGINE.layout).toBe('function'); });
  it('exposes cleanup function', () => { expect(typeof CIRCO_LAYOUT_ENGINE.cleanup).toBe('function'); });
});

describe('createBlocktree on K4', () => {
  it('yields one root block with 4 nodes', () => {
    const g = makeK4(); circoInitGraph(g);
    const dg = buildDerivedGraph(g); const edges = buildDerivedEdges(g, dg);
    const comp: SubGraph = {name:'_k4', nodes:[...dg.nodes.values()], edges:[], parent:dg};
    for (const dn of comp.nodes) dn.orig.info.alg = dn.cdata;
    const root = createBlocktree(comp, makeCircState(0), edges);
    expect(root.subGraph.nodes.length).toBe(4); expect(root.children.length).toBe(0);
  });
});

describe('block internals for 6-ring', () => {
  it('produces a 6-node block and 6-node spanning path', () => {
    const g = makeRing(6); circoInitGraph(g);
    const dg = buildDerivedGraph(g); const allEdges = buildDerivedEdges(g, dg);
    const comps = derivedComponents(g, dg, allEdges);
    const block = createBlocktree(comps[0]!, makeCircState(0), allEdges);
    blockGraph(comps[0]!.edges, block);
    expect(block.subGraph.nodes.length).toBe(6);
    expect(block.subGraph.edges.length).toBeGreaterThan(0);
    const spanMap = buildSpanTree(block.subGraph.nodes, block.subGraph.edges);
    const path = findLongestPath([...spanMap.values()]);
    expect(path.length).toBe(6);
  });
});

describe('6-node ring layout: position validity', () => {
  let g: Graph;
  beforeEach(() => { g = makeRing(6); });
  it('assigns non-zero positions to all nodes', () => {
    circoLayoutFull(g);
    for (const n of g.nodes.values()) {
      const p = n.info.pos ?? [0,0];
      expect(Math.abs(p[0] ?? 0) + Math.abs(p[1] ?? 0)).toBeGreaterThan(0);
    }
  });
  it('produces 6 distinct positions', () => {
    circoLayoutFull(g);
    const pos = nodePositions(g).map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`);
    expect(new Set(pos).size).toBe(6);
  });
});

describe('6-node ring layout: equal radius', () => {
  it('places all nodes at equal radius', () => {
    const g = makeRing(6); circoLayoutFull(g);
    const radii = [...g.nodes.values()].map((n) => { const p = n.info.pos ?? [0,0]; return Math.hypot(p[0]??0, p[1]??0); });
    const r0 = radii[0]!;
    for (const r of radii) expect(r).toBeCloseTo(r0, 3);
  });
});

describe('two disconnected triangles: non-overlapping', () => {
  it('assigns non-overlapping positions to all 6 nodes', () => {
    const g = mergeGraphs(makeTriangle('t1'), makeTriangle('t2')); circoLayoutFull(g);
    expect(allDistinct(nodePositions(g))).toBe(true);
  });
  it('assigns pos to all 6 nodes', () => {
    const g = mergeGraphs(makeTriangle('p1'), makeTriangle('p2')); circoLayoutFull(g);
    for (const n of g.nodes.values()) expect(n.info.pos).toBeDefined();
  });
});
