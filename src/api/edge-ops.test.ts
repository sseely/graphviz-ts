// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import { Graph } from '../model/graph.js';
import { agnode, agsubg } from '../model/cgraph-ops.js';
import { addEdge } from './edge-ops.js';
import { parse, serialize, serializeEdges } from '../parser/index.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeGraph(kind: Graph['kind']): Graph {
  return new Graph('G', kind);
}

function getNode(g: Graph, name: string) {
  const n = agnode(g, name, true);
  if (n === null) throw new Error(`agnode returned null for ${name}`);
  return n;
}

function makeSg(root: Graph, name: string) {
  const sg = agsubg(root, name, true);
  if (sg === null) throw new Error('agsubg returned null');
  return sg;
}

// ── strict directed: dedup ────────────────────────────────────────────────────

describe('addEdge — strict directed graph', () => {
  it('returns existing edge on duplicate (tail,head) call', () => {
    const g = makeGraph('strict-directed');
    const e1 = addEdge(g, getNode(g, 'a'), getNode(g, 'b'));
    const e2 = addEdge(g, getNode(g, 'a'), getNode(g, 'b'));
    expect(g.root.edges).toHaveLength(1);
    expect(e2).toBe(e1);
  });

  it('strict-dedup ignores the name parameter', () => {
    const g = makeGraph('strict-directed');
    const a = getNode(g, 'a');
    const b = getNode(g, 'b');
    const e1 = addEdge(g, a, b, 'myedge');
    const e2 = addEdge(g, a, b, 'othername');
    expect(g.root.edges).toHaveLength(1);
    expect(e2).toBe(e1);
  });
});

// ── strict undirected: symmetric dedup ───────────────────────────────────────

describe('addEdge — strict undirected graph', () => {
  it('treats (a,b) and (b,a) as the same pair', () => {
    const g = makeGraph('strict-undirected');
    const a = getNode(g, 'a');
    const b = getNode(g, 'b');
    const e1 = addEdge(g, a, b);
    const e2 = addEdge(g, b, a);
    expect(g.root.edges).toHaveLength(1);
    expect(e2).toBe(e1);
  });
});

// ── non-strict: no dedup ──────────────────────────────────────────────────────

describe('addEdge — non-strict directed graph', () => {
  it('allows two distinct edges between the same endpoints', () => {
    const g = makeGraph('directed');
    const a = getNode(g, 'a');
    const b = getNode(g, 'b');
    const e1 = addEdge(g, a, b);
    const e2 = addEdge(g, a, b);
    expect(g.root.edges).toHaveLength(2);
    expect(e1).not.toBe(e2);
    expect(e1.tail).toBe(a);
    expect(e1.head).toBe(b);
  });
});

// ── graphSeq bookkeeping ──────────────────────────────────────────────────────

describe('addEdge — graphSeq', () => {
  it('assigns 1-based graphSeq matching parser behaviour', () => {
    const g = makeGraph('directed');
    const a = getNode(g, 'a');
    const b = getNode(g, 'b');
    const c = getNode(g, 'c');
    const e1 = addEdge(g, a, b);
    const e2 = addEdge(g, b, c);
    expect(e1.graphSeq).toBe(1);
    expect(e2.graphSeq).toBe(2);
  });
});

// ── subgraph dual-list insertion ──────────────────────────────────────────────

describe('addEdge — subgraph', () => {
  it('inserts edge into both subgraph and root', () => {
    const root = makeGraph('directed');
    const sg = makeSg(root, 'sg');
    const e = addEdge(sg, getNode(root, 'a'), getNode(root, 'b'));
    expect(root.edges).toHaveLength(1);
    expect(root.edges[0]).toBe(e);
    expect(sg.edges).toHaveLength(1);
    expect(sg.edges[0]).toBe(e);
  });

  it('registers tail and head nodes in the subgraph', () => {
    const root = makeGraph('directed');
    const sg = makeSg(root, 'sg');
    const a = getNode(root, 'a');
    const b = getNode(root, 'b');
    addEdge(sg, a, b);
    expect(sg.nodes.get('a')).toBe(a);
    expect(sg.nodes.get('b')).toBe(b);
  });

  it('does NOT double-insert into root when called directly on root', () => {
    const root = makeGraph('directed');
    addEdge(root, getNode(root, 'a'), getNode(root, 'b'));
    expect(root.edges).toHaveLength(1);
  });
});

// ── name field ────────────────────────────────────────────────────────────────

describe('addEdge — name field', () => {
  it('defaults to empty string when name is omitted', () => {
    const g = makeGraph('directed');
    const e = addEdge(g, getNode(g, 'a'), getNode(g, 'b'));
    expect(e.name).toBe('');
  });

  it('stores supplied name on the edge', () => {
    const g = makeGraph('directed');
    const e = addEdge(g, getNode(g, 'a'), getNode(g, 'b'), 'mykey');
    expect(e.name).toBe('mykey');
  });
});

// ── round-trip parity with parser (non-strict) ────────────────────────────────

describe('addEdge — round-trip parity with parser', () => {
  it('produces same edge lines as parsing equivalent DOT (non-strict)', () => {
    const g = makeGraph('directed');
    addEdge(g, getNode(g, 'a'), getNode(g, 'b'));
    addEdge(g, getNode(g, 'b'), getNode(g, 'c'));
    const parsed = parse('digraph G { a -> b; b -> c; }');
    expect(serializeEdges(g).sort()).toEqual(serializeEdges(parsed).sort());
  });

  it('round-trips through serialize → parse for a directed graph', () => {
    const g = makeGraph('directed');
    const a = getNode(g, 'a');
    const b = getNode(g, 'b');
    addEdge(g, a, b);
    addEdge(g, b, a);
    const reparsed = parse(serialize(g));
    expect(reparsed.edges).toHaveLength(2);
    expect(reparsed.edges[0]?.tail.name).toBe('a');
    expect(reparsed.edges[0]?.head.name).toBe('b');
    expect(reparsed.edges[1]?.tail.name).toBe('b');
    expect(reparsed.edges[1]?.head.name).toBe('a');
  });
});
