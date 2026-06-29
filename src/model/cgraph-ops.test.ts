// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import { Graph } from './graph.js';
import { Node } from './node.js';
import { parse } from '../parser/index.js';
import {
  agnode,
  agsubg,
  agsubnode,
  agdelnode,
  agdelsubg,
  agGraphAttr,
} from './cgraph-ops.js';

const NEW_RANK = '_new_rank';

function makeRoot(): Graph {
  return new Graph('G', 'directed');
}

describe('agsubg', () => {
  it('creates a registered subgraph and re-finds the same object', () => {
    const root = makeRoot();
    const sg = agsubg(root, NEW_RANK, true);
    expect(sg).not.toBeNull();
    expect(root.subgraphs.get(NEW_RANK)).toBe(sg);
    expect(sg?.parent).toBe(root);
    expect(sg?.root).toBe(root);

    const again = agsubg(root, NEW_RANK, false);
    expect(again).toBe(sg);
  });

  it('returns null for an absent name with create=false', () => {
    const root = makeRoot();
    expect(agsubg(root, NEW_RANK, false)).toBeNull();
  });
});

describe('agsubnode', () => {
  it('adds a node to the subgraph and every enclosing graph up to root', () => {
    const root = makeRoot();
    const mid = agsubg(root, 'cluster_a', true);
    const sg = agsubg(mid as Graph, 'inner', true) as Graph;
    const n = agnode(root, 'x', true) as Node;

    const result = agsubnode(sg, n, true);
    expect(result).toBe(n);
    expect(sg.nodes.get('x')).toBe(n);
    expect((mid as Graph).nodes.get('x')).toBe(n);
    expect(root.nodes.get('x')).toBe(n);
  });

  it('returns null when the node belongs to a different root', () => {
    const root = makeRoot();
    const sg = agsubg(root, NEW_RANK, true) as Graph;
    const other = new Graph('H', 'directed');
    const foreign = new Node(0, 'y', other);
    expect(agsubnode(sg, foreign, true)).toBeNull();
  });
});

describe('agnode', () => {
  it('creates-or-gets a named node on the root graph', () => {
    const root = makeRoot();
    const a = agnode(root, 'a', true) as Node;
    expect(a.name).toBe('a');
    expect(root.nodes.get('a')).toBe(a);
    expect(agnode(root, 'a', true)).toBe(a);
  });

  it('returns null for an absent named node with create=false', () => {
    const root = makeRoot();
    expect(agnode(root, 'missing', false)).toBeNull();
  });

  it('mints two anonymous nodes with distinct ids and names', () => {
    const root = makeRoot();
    agnode(root, 'seed', true);
    const a1 = agnode(root, null, true) as Node;
    const a2 = agnode(root, '', true) as Node;

    expect(a1.id).not.toBe(a2.id);
    expect(a1.name).not.toBe(a2.name);
    expect(root.nodes.get(a1.name)).toBe(a1);
    expect(root.nodes.get(a2.name)).toBe(a2);
  });
});

describe('agdelnode', () => {
  it('removes the node from all member graphs', () => {
    const root = makeRoot();
    const sg = agsubg(root, NEW_RANK, true) as Graph;
    const n = agnode(root, 'z', true) as Node;
    agsubnode(sg, n, true);
    expect(sg.nodes.has('z')).toBe(true);

    agdelnode(sg, n);
    expect(sg.nodes.has('z')).toBe(false);
    expect(root.nodes.has('z')).toBe(false);
  });
});

describe('agdelsubg', () => {
  it('removes the subgraph so a later create=false lookup is null', () => {
    const root = makeRoot();
    const sg = agsubg(root, NEW_RANK, true) as Graph;
    agdelsubg(root, sg);
    expect(agsubg(root, NEW_RANK, false)).toBeNull();
  });
});

describe('agGraphAttr — faithful agxget for graph attributes', () => {
  it("returns the graph's own value when set", () => {
    const root = makeRoot();
    root.attrs.set('ordering', 'out');
    root.declaredGraphAttrs.add('ordering');
    expect(agGraphAttr(root, 'ordering')).toBe('out');
  });

  it('returns "" (not undefined) for a declared-but-unset graph attribute', () => {
    // cgraph: a subgraph setting ordering declares it graph-wide with "" default,
    // so the root reads "" — the load-bearing distinction ordered_edges relies on.
    const root = makeRoot();
    root.declaredGraphAttrs.add('ordering'); // declared graph-wide (e.g. on a subgraph)
    expect(root.attrs.get('ordering')).toBeUndefined();
    expect(agGraphAttr(root, 'ordering')).toBe('');
  });

  it('returns undefined for an attribute never declared graph-wide', () => {
    const root = makeRoot();
    expect(agGraphAttr(root, 'ordering')).toBeUndefined();
  });

  it('reads the declared set from the ROOT, not the local graph', () => {
    const root = makeRoot();
    const sg = agsubg(root, 'sub', true)!;
    root.declaredGraphAttrs.add('ordering');
    // sg has no own value and an empty local declared set, but root declares it
    expect(agGraphAttr(sg, 'ordering')).toBe('');
  });
});

describe('declaredGraphAttrs population via parse (builder)', () => {
  it('subgraph-scoped ordering=out → root sees "" (declared), not undefined', () => {
    const g = parse('digraph { { rank=same; a; b; ordering=out; } a->b; }');
    expect(g.declaredGraphAttrs.has('ordering')).toBe(true);
    expect(g.attrs.get('ordering')).toBeUndefined();
    expect(agGraphAttr(g, 'ordering')).toBe(''); // C ignores subgraph-scoped ordering
  });

  it('graph-level ordering=out → root value is "out"', () => {
    const g = parse('digraph { ordering=out; a->b; }');
    expect(agGraphAttr(g, 'ordering')).toBe('out');
  });

  it('graph[ordering=out] attr statement also declares it graph-wide', () => {
    const g = parse('digraph { graph[ordering=out]; a->b; }');
    expect(agGraphAttr(g, 'ordering')).toBe('out');
  });

  it('no ordering anywhere → agGraphAttr undefined', () => {
    const g = parse('digraph { a->b; }');
    expect(agGraphAttr(g, 'ordering')).toBeUndefined();
  });
});
