// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import { createGraph } from './builder.js';
import { parse, serialize } from '../parser/index.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function normalizeDoc(dot: string): string {
  return dot.trim().replace(/\s+/g, ' ');
}

function parsedSerial(src: string): string {
  return normalizeDoc(serialize(parse(src)));
}

function builtSerial(b: ReturnType<typeof createGraph>): string {
  return normalizeDoc(serialize(b.graph));
}

// ── createGraph defaults ──────────────────────────────────────────────────────

describe('createGraph defaults', () => {
  it('creates a directed graph when no opts supplied', () => {
    const b = createGraph();
    expect(b.graph.kind).toBe('directed');
  });

  it('creates an undirected graph when directed=false', () => {
    const b = createGraph({ directed: false });
    expect(b.graph.kind).toBe('undirected');
  });

  it('creates strict-directed when strict=true and directed=true', () => {
    const b = createGraph({ directed: true, strict: true });
    expect(b.graph.kind).toBe('strict-directed');
  });

  it('creates strict-undirected when strict=true and directed=false', () => {
    const b = createGraph({ directed: false, strict: true });
    expect(b.graph.kind).toBe('strict-undirected');
  });

  it('sets graph name from opts', () => {
    const b = createGraph({ name: 'G' });
    expect(b.graph.name).toBe('G');
  });
});

// ── addNode / addEdge string form ─────────────────────────────────────────────

describe('addNode + addEdge string form structural parity', () => {
  it('digraph { a -> b } matches parsed form', () => {
    const b = createGraph({ directed: true });
    b.addNode('a');
    b.addNode('b');
    b.addEdge('a', 'b');
    expect(builtSerial(b)).toBe(parsedSerial('digraph { a -> b }'));
  });

  it('node attrs are serialized', () => {
    const b = createGraph({ directed: true });
    b.addNode('x', { shape: 'box' });
    const dot = serialize(b.graph);
    expect(dot).toContain('shape=box');
  });

  it('edge attrs are serialized', () => {
    const b = createGraph({ directed: true });
    b.addNode('a');
    b.addNode('b');
    b.addEdge('a', 'b', { label: 'e1' });
    const dot = serialize(b.graph);
    expect(dot).toContain('label=e1');
  });
});

// ── addEdge with GvNode handles ───────────────────────────────────────────────

describe('addEdge with GvNode handles', () => {
  it('handle form produces same graph structure as string form', () => {
    const bStr = createGraph({ directed: true });
    bStr.addNode('a');
    bStr.addNode('b');
    bStr.addEdge('a', 'b');

    const bHnd = createGraph({ directed: true });
    const na = bHnd.addNode('a');
    const nb = bHnd.addNode('b');
    bHnd.addEdge(na, nb);

    expect(builtSerial(bHnd)).toBe(builtSerial(bStr));
  });

  it('handle tail/head names match node names', () => {
    const b = createGraph({ directed: true });
    const na = b.addNode('alpha');
    const nb = b.addNode('beta');
    const e = b.addEdge(na, nb);
    expect(e.tail).toBe('alpha');
    expect(e.head).toBe('beta');
  });
});

// ── addSubgraph ───────────────────────────────────────────────────────────────

describe('addSubgraph membership', () => {
  it('node added to subgraph is present in both subgraph and root', () => {
    const b = createGraph({ directed: true });
    const sg = b.addSubgraph('cluster_0');
    sg.addNode('n1');
    expect(b.graph.nodes.has('n1')).toBe(true);
    const sub = b.graph.subgraphs.get('cluster_0');
    expect(sub?.nodes.has('n1')).toBe(true);
  });

  it('subgraph is registered in root subgraphs map', () => {
    const b = createGraph({ directed: true });
    b.addSubgraph('cluster_1');
    expect(b.graph.subgraphs.has('cluster_1')).toBe(true);
  });

  it('subgraph attrs are set', () => {
    const b = createGraph({ directed: true });
    const sg = b.addSubgraph('cluster_2', { label: 'grp' });
    expect(sg.getAttr('label')).toBe('grp');
  });
});

// ── setAttr / getAttr on GvNode ───────────────────────────────────────────────

describe('GvNode setAttr / getAttr', () => {
  it('getAttr returns undefined before any set', () => {
    const b = createGraph({ directed: true });
    const n = b.addNode('z');
    expect(n.getAttr('color')).toBeUndefined();
  });

  it('getAttr returns value after setAttr', () => {
    const b = createGraph({ directed: true });
    const n = b.addNode('z');
    n.setAttr('color', 'red');
    expect(n.getAttr('color')).toBe('red');
  });

  it('setAttr on node handle appears in serialized DOT', () => {
    const b = createGraph({ directed: true });
    const n = b.addNode('z');
    n.setAttr('color', 'blue');
    const dot = serialize(b.graph);
    expect(dot).toContain('color=blue');
  });
});

// ── GvEdge setAttr / getAttr ──────────────────────────────────────────────────

describe('GvEdge setAttr / getAttr', () => {
  it('getAttr returns undefined before any set', () => {
    const b = createGraph({ directed: true });
    b.addNode('a');
    b.addNode('b');
    const e = b.addEdge('a', 'b');
    expect(e.getAttr('weight')).toBeUndefined();
  });

  it('getAttr returns value after setAttr', () => {
    const b = createGraph({ directed: true });
    b.addNode('a');
    b.addNode('b');
    const e = b.addEdge('a', 'b');
    e.setAttr('weight', '2');
    expect(e.getAttr('weight')).toBe('2');
  });
});

// ── GvGraphBuilder setAttr / getAttr ─────────────────────────────────────────

describe('GvGraphBuilder setAttr / getAttr', () => {
  it('getAttr returns undefined before any set', () => {
    const b = createGraph({ directed: true });
    expect(b.getAttr('rankdir')).toBeUndefined();
  });

  it('getAttr returns value after setAttr', () => {
    const b = createGraph({ directed: true });
    b.setAttr('rankdir', 'LR');
    expect(b.getAttr('rankdir')).toBe('LR');
  });
});
