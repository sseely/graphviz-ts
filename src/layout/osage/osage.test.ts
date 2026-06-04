// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for the osage layout engine.
 *
 * NOTE: All helper and body functions are exported so that Lizard resets
 * its cyclomatic-complexity counter at each `export function` boundary.
 * Without this, Lizard merges non-exported function bodies into adjacent
 * exported symbols and produces inflated length metrics.
 *
 * @see lib/osage/osageinit.c
 * @see plans/graphviz-ts-port/batch-10/T51-osage.md
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { PackMode } from '../pack/index.js';
import {
  OSAGE_LAYOUT_ENGINE,
  PARENT,
  isCluster,
  clusterInitGraph,
  mkClusters,
  osageLayoutRec,
  osageReposition,
  osageLayout,
  osageCleanup,
  buildPackInfo,
} from './index.js';

// ---------------------------------------------------------------------------
// Test helpers — all exported for Lizard boundary resets
// ---------------------------------------------------------------------------

let _nodeId = 0;

/** Create a fresh directed graph; resets the node ID counter. */
export function freshGraph(name = 'g'): Graph {
  _nodeId = 0;
  return new Graph(name, 'directed');
}

/** Add a node with default osage-compatible sizes (0.75in × 0.5in → 54×36pt). */
export function addNode(g: Graph, name: string): Node {
  const n = new Node(_nodeId++, name, g);
  n.info = makeNodeInfo();
  n.info.width = 0.75;
  n.info.height = 0.5;
  n.info.lw = 27;
  n.info.rw = 27;
  n.info.ht = 36;
  g.nodes.set(name, n);
  return n;
}

/** Create a named subgraph as a child of parent. */
export function addCluster(parent: Graph, name: string): Graph {
  const sg = new Graph(name, 'directed');
  sg.parent = parent;
  sg.root = parent.root;
  sg.info.bb = { ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } };
  parent.subgraphs.set(name, sg);
  return sg;
}

/** Add a node to both the root graph and a cluster subgraph. */
export function addNodeToCluster(root: Graph, cluster: Graph, name: string): Node {
  const n = addNode(root, name);
  cluster.nodes.set(name, n);
  root.nodes.set(name, n);
  return n;
}

/** Build a graph with two cluster subgraphs, each containing 3 nodes. */
export function makeTwoClusterGraph(): { g: Graph; c1: Graph; c2: Graph } {
  const g = freshGraph('g');
  const c1 = addCluster(g, 'cluster_A');
  const c2 = addCluster(g, 'cluster_B');
  addNodeToCluster(g, c1, 'a1');
  addNodeToCluster(g, c1, 'a2');
  addNodeToCluster(g, c1, 'a3');
  addNodeToCluster(g, c2, 'b1');
  addNodeToCluster(g, c2, 'b2');
  addNodeToCluster(g, c2, 'b3');
  return { g, c1, c2 };
}

/** Return true when two boxes have any overlapping area. */
export function boxesOverlap(
  a: { ll: { x: number; y: number }; ur: { x: number; y: number } },
  b: { ll: { x: number; y: number }; ur: { x: number; y: number } },
): boolean {
  return (
    a.ll.x < b.ur.x &&
    a.ur.x > b.ll.x &&
    a.ll.y < b.ur.y &&
    a.ur.y > b.ll.y
  );
}

// ---------------------------------------------------------------------------
// Test body functions — exported so Lizard resets CCN at each boundary
// ---------------------------------------------------------------------------

// --- OSAGE_LAYOUT_ENGINE identity ---

export function testEngineType(): void {
  expect(OSAGE_LAYOUT_ENGINE.type).toBe('osage');
}

export function testEngineLayoutFn(): void {
  expect(typeof OSAGE_LAYOUT_ENGINE.layout).toBe('function');
}

export function testEngineCleanupFn(): void {
  expect(typeof OSAGE_LAYOUT_ENGINE.cleanup).toBe('function');
}

// --- PARENT ---

export function testParentNull(): void {
  const g = freshGraph();
  const n = addNode(g, 'n');
  expect(PARENT(n)).toBeNull();
}

export function testParentReturnsCluster(): void {
  const g = freshGraph();
  const c = addCluster(g, 'cluster_c');
  const n = addNode(g, 'n');
  n.info.alg = { kind: 'osage', ownerCluster: c };
  expect(PARENT(n)).toBe(c);
}

export function testParentDifferentKind(): void {
  const g = freshGraph();
  const n = addNode(g, 'n');
  n.info.alg = { kind: 'neato' };
  expect(PARENT(n)).toBeNull();
}

// --- isCluster ---

export function testIsClusterTrue(): void {
  const g = new Graph('cluster_foo', 'directed');
  expect(isCluster(g)).toBe(true);
}

export function testIsClusterFalse(): void {
  const g = new Graph('foo', 'directed');
  expect(isCluster(g)).toBe(false);
}

export function testIsClusterExact(): void {
  const g = new Graph('cluster', 'directed');
  expect(isCluster(g)).toBe(true);
}

// --- clusterInitGraph ---

export function testClusterInitSetsNdim(): void {
  const g = freshGraph();
  addNode(g, 'n');
  clusterInitGraph(g);
  expect(g.info.ndim).toBe(2);
}

export function testClusterInitSetsLwRwHt(): void {
  const g = freshGraph();
  const n = addNode(g, 'n');
  n.info.width = 1;
  n.info.height = 0.5;
  clusterInitGraph(g);
  expect(n.info.lw).toBeCloseTo(36, 5);
  expect(n.info.rw).toBeCloseTo(36, 5);
  expect(n.info.ht).toBeCloseTo(36, 5);
}

export function testClusterInitDefaults(): void {
  const g = freshGraph();
  const n = addNode(g, 'n');
  n.info.width = 0;
  n.info.height = 0;
  clusterInitGraph(g);
  expect(n.info.lw).toBeCloseTo(0.75 * 72 / 2, 5);
  expect(n.info.rw).toBeCloseTo(0.75 * 72 / 2, 5);
  expect(n.info.ht).toBeCloseTo(0.5 * 72, 5);
}

// --- mkClusters ---

export function testMkClustersDirectChildren(): void {
  const g = freshGraph();
  addCluster(g, 'cluster_A');
  addCluster(g, 'cluster_B');
  mkClusters(g, null, g);
  expect(g.info.n_cluster).toBe(2);
  expect(g.info.clust).toHaveLength(2);
}

export function testMkClustersIgnoresNonCluster(): void {
  const g = freshGraph();
  addCluster(g, 'cluster_A');
  addCluster(g, 'not_a_cluster');
  mkClusters(g, null, g);
  expect(g.info.n_cluster).toBe(1);
}

export function testMkClustersPromotes(): void {
  const g = freshGraph();
  const sg = addCluster(g, 'wrap');
  const inner = new Graph('cluster_inner', 'directed');
  inner.parent = sg;
  inner.root = g;
  inner.info.bb = { ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } };
  sg.subgraphs.set('cluster_inner', inner);
  mkClusters(g, null, g);
  expect(g.info.n_cluster).toBe(1);
}

export function testMkClustersNoClusterGraph(): void {
  const g = freshGraph();
  addNode(g, 'n');
  mkClusters(g, null, g);
  expect(g.info.n_cluster).toBe(0);
}

// --- buildPackInfo (pack mode floor) ---

export function testPackModeFloorNode(): void {
  const g = freshGraph();
  ((g.info as unknown) as Record<string, unknown>)['packMode'] = 'node';
  const pinfo = buildPackInfo(g);
  expect(pinfo.mode).toBeGreaterThanOrEqual(PackMode.Graph);
}

export function testPackModeFloorCluster(): void {
  const g = freshGraph();
  ((g.info as unknown) as Record<string, unknown>)['packMode'] = 'cluster';
  const pinfo = buildPackInfo(g);
  expect(pinfo.mode).toBeGreaterThanOrEqual(PackMode.Graph);
}

export function testPackModePreservesGraph(): void {
  const g = freshGraph();
  ((g.info as unknown) as Record<string, unknown>)['packMode'] = 'graph';
  const pinfo = buildPackInfo(g);
  expect(pinfo.mode).toBe(PackMode.Graph);
}

export function testPackModePreservesArray(): void {
  const g = freshGraph();
  ((g.info as unknown) as Record<string, unknown>)['packMode'] = 'array';
  const pinfo = buildPackInfo(g);
  expect(pinfo.mode).toBe(PackMode.Array);
}

// --- osageLayoutRec: alg.kind invariant ---

export function testAlgKindFlatGraph(): void {
  const g = freshGraph();
  addNode(g, 'a');
  addNode(g, 'b');
  addNode(g, 'c');
  clusterInitGraph(g);
  mkClusters(g, null, g);
  osageLayoutRec(g, 0);
  for (const n of g.nodes.values()) {
    expect(n.info.alg?.kind).toBe('osage');
  }
}

export function testAlgKindNestedClusters(): void {
  const { g, c1, c2 } = makeTwoClusterGraph();
  clusterInitGraph(g);
  c1.info.bb = { ll: { x: 0, y: 0 }, ur: { x: 54, y: 36 } };
  c2.info.bb = { ll: { x: 0, y: 0 }, ur: { x: 54, y: 36 } };
  mkClusters(g, null, g);
  osageLayoutRec(g, 0);
  for (const n of g.nodes.values()) {
    expect(n.info.alg?.kind).toBe('osage');
  }
}

export function testAlgKindOwnerCluster(): void {
  const g = freshGraph();
  const c = addCluster(g, 'cluster_C');
  const n = addNodeToCluster(g, c, 'n1');
  clusterInitGraph(g);
  c.info.bb = { ll: { x: 0, y: 0 }, ur: { x: 54, y: 36 } };
  mkClusters(g, null, g);
  osageLayoutRec(g, 0);
  expect(n.info.alg?.kind).toBe('osage');
  if (n.info.alg?.kind === 'osage') {
    expect(n.info.alg.ownerCluster).toBe(c);
  }
}

// --- osageLayoutRec: empty cluster ---

export function testEmptyClusterDfltSz(): void {
  const g = freshGraph();
  mkClusters(g, null, g);
  osageLayoutRec(g, 0);
  expect(g.info.bb.ur.x - g.info.bb.ll.x).toBe(18);
  expect(g.info.bb.ur.y - g.info.bb.ll.y).toBe(18);
}

// --- osageLayout: cluster non-overlap ---

export function testNoOverlapTwoClusters(): void {
  const { g, c1, c2 } = makeTwoClusterGraph();
  g.info.flags = 0;
  osageLayout(g);
  expect(boxesOverlap(c1.info.bb, c2.info.bb)).toBe(false);
}

export function testNonZeroBoundingBoxes(): void {
  const { g, c1, c2 } = makeTwoClusterGraph();
  g.info.flags = 0;
  osageLayout(g);
  const area1 =
    (c1.info.bb.ur.x - c1.info.bb.ll.x) * (c1.info.bb.ur.y - c1.info.bb.ll.y);
  const area2 =
    (c2.info.bb.ur.x - c2.info.bb.ll.x) * (c2.info.bb.ur.y - c2.info.bb.ll.y);
  expect(area1).toBeGreaterThan(0);
  expect(area2).toBeGreaterThan(0);
}

export function testAbsoluteNodeCoords(): void {
  const { g } = makeTwoClusterGraph();
  g.info.flags = 0;
  osageLayout(g);
  for (const n of g.nodes.values()) {
    expect(Number.isFinite(n.info.coord.x)).toBe(true);
    expect(Number.isFinite(n.info.coord.y)).toBe(true);
  }
}

// --- osageReposition ---

export function testRepositionDepth0NoOp(): void {
  const g = freshGraph();
  const n = addNode(g, 'n');
  n.info.alg = { kind: 'osage', ownerCluster: g };
  n.info.coord = { x: 10, y: 20 };
  g.info.bb = { ll: { x: 5, y: 5 }, ur: { x: 100, y: 100 } };
  g.info.n_cluster = 0;
  osageReposition(g, 0);
  expect(n.info.coord.x).toBe(10);
  expect(n.info.coord.y).toBe(20);
}

export function testRepositionDepth1Shifts(): void {
  const g = freshGraph();
  const c = addCluster(g, 'cluster_c');
  const n = addNode(c, 'n');
  n.info.alg = { kind: 'osage', ownerCluster: c };
  n.info.coord = { x: 5, y: 5 };
  c.info.bb = { ll: { x: 10, y: 20 }, ur: { x: 100, y: 100 } };
  c.info.n_cluster = 0;
  osageReposition(c, 1);
  expect(n.info.coord.x).toBe(15);
  expect(n.info.coord.y).toBe(25);
}

// --- osageCleanup ---

export function testCleanupClearsAlg(): void {
  const g = freshGraph();
  const c = addCluster(g, 'cluster_c');
  const n = addNodeToCluster(g, c, 'n');
  n.info.alg = { kind: 'osage', ownerCluster: c };
  g.info.n_cluster = 1;
  g.info.clust = [c];
  c.info.n_cluster = 0;
  osageCleanup(g);
  expect(n.info.alg).toBeUndefined();
}

export function testCleanupClearsClusterArrays(): void {
  const g = freshGraph();
  const c = addCluster(g, 'cluster_c');
  g.info.n_cluster = 1;
  g.info.clust = [c];
  c.info.n_cluster = 0;
  osageCleanup(g);
  expect(g.info.clust).toBeUndefined();
  expect(g.info.n_cluster).toBeUndefined();
}

export function testCleanupLeavesOtherAlg(): void {
  const g = freshGraph();
  const n = addNode(g, 'n');
  n.info.alg = { kind: 'neato' };
  g.info.n_cluster = 0;
  osageCleanup(g);
  expect(n.info.alg?.kind).toBe('neato');
}

// --- full pipeline smoke tests ---

export function testSingleClusterPipeline(): void {
  const g = freshGraph('root');
  const c = addCluster(g, 'cluster_only');
  addNodeToCluster(g, c, 'x');
  addNodeToCluster(g, c, 'y');
  g.info.flags = 0;
  osageLayout(g);
  expect(g.info.bb.ur.x - g.info.bb.ll.x).toBeGreaterThan(0);
  expect(g.info.bb.ur.y - g.info.bb.ll.y).toBeGreaterThan(0);
}

export function testFlatNoClusterPipeline(): void {
  const g = freshGraph('flat');
  addNode(g, 'p');
  addNode(g, 'q');
  g.info.flags = 0;
  osageLayout(g);
  expect(g.info.bb.ur.x - g.info.bb.ll.x).toBeGreaterThan(0);
  expect(g.info.bb.ur.y - g.info.bb.ll.y).toBeGreaterThan(0);
}

// ---------------------------------------------------------------------------
// describe blocks — each callback is one line, delegating to exported fns
// ---------------------------------------------------------------------------

describe('OSAGE_LAYOUT_ENGINE identity', () => {
  it('has type "osage"', testEngineType);
  it('exposes layout function', testEngineLayoutFn);
  it('exposes cleanup function', testEngineCleanupFn);
});

describe('PARENT', () => {
  it('returns null for unclaimed node', testParentNull);
  it('returns ownerCluster after claim', testParentReturnsCluster);
  it('returns null when alg has different kind', testParentDifferentKind);
});

describe('isCluster', () => {
  it('returns true for name starting with "cluster"', testIsClusterTrue);
  it('returns false for name not starting with "cluster"', testIsClusterFalse);
  it('returns true for name exactly "cluster"', testIsClusterExact);
});

describe('clusterInitGraph', () => {
  it('sets ndim to 2', testClusterInitSetsNdim);
  it('sets lw/rw/ht on all nodes', testClusterInitSetsLwRwHt);
  it('uses default 0.75in × 0.5in when width/height not set', testClusterInitDefaults);
});

describe('mkClusters', () => {
  it('discovers direct cluster subgraphs', testMkClustersDirectChildren);
  it('ignores non-cluster subgraphs', testMkClustersIgnoresNonCluster);
  it('promotes clusters from non-cluster subgraphs', testMkClustersPromotes);
  it('sets n_cluster to 0 for graph with no clusters', testMkClustersNoClusterGraph);
});

describe('buildPackInfo — pack mode floor', () => {
  it('upgrades PackMode.Node to PackMode.Graph', testPackModeFloorNode);
  it('upgrades PackMode.Cluster to PackMode.Graph', testPackModeFloorCluster);
  it('preserves PackMode.Graph', testPackModePreservesGraph);
  it('preserves PackMode.Array', testPackModePreservesArray);
});

describe('osageLayoutRec — alg.kind === "osage" invariant', () => {
  it('claims all nodes in a flat graph', testAlgKindFlatGraph);
  it('claims all nodes in nested clusters', testAlgKindNestedClusters);
  it('sets ownerCluster to the innermost enclosing cluster', testAlgKindOwnerCluster);
});

describe('osageLayoutRec — empty cluster', () => {
  it('assigns DFLT_SZ bounding box to empty cluster with no label', testEmptyClusterDfltSz);
});

describe('osageLayout — cluster non-overlap', () => {
  it('packs two clusters without bounding-box overlap', testNoOverlapTwoClusters);
  it('produces non-zero bounding boxes for both clusters', testNonZeroBoundingBoxes);
  it('assigns absolute coordinates to all nodes', testAbsoluteNodeCoords);
});

describe('osageReposition', () => {
  it('does not translate at depth 0 (root pass is no-op)', testRepositionDepth0NoOp);
  it('shifts node coords at depth > 0', testRepositionDepth1Shifts);
});

describe('osageCleanup', () => {
  it('clears alg from all nodes', testCleanupClearsAlg);
  it('clears cluster arrays from GraphInfo', testCleanupClearsClusterArrays);
  it('leaves non-osage alg data untouched', testCleanupLeavesOtherAlg);
});

describe('osageLayout full pipeline', () => {
  it('produces valid root bounding box for a single-cluster graph', testSingleClusterPipeline);
  it('handles a graph with only loose nodes (no clusters)', testFlatNoClusterPipeline);
});
