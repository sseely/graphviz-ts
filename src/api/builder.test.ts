// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import { createGraph } from './builder.js';
import { parse, serialize } from '../parser/index.js';
import { GvcContext } from '../gvc/context.js';
import { createMeasurer } from '../common/textmeasure-factory.js';
import { DOT_LAYOUT_ENGINE } from '../layout/dot/index.js';
import { getLayout } from './geometry.js';
import type { GvGraphBuilder } from './builder.js';

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

// ── setHtmlAttr — HTML-string label support (issue 07) ───────────────────────

describe('setHtmlAttr marks the value as an HTML string', () => {
  // U+0001 — the internal HTML-string marker (common/html-string.ts);
  // computed here so no literal control character sits in the source.
  const MARK = String.fromCharCode(1);
  const HTML = '<TABLE FIXEDSIZE="TRUE" WIDTH="10" HEIGHT="3"><TR><TD></TD></TR></TABLE>';

  it('node.setHtmlAttr prefixes the value with the HTML marker (U+0001)', () => {
    const b = createGraph({ directed: true });
    const n = b.addNode('F');
    n.setHtmlAttr('label', HTML);
    expect(n.getAttr('label')).toBe(MARK + HTML);
  });

  it('edge.setHtmlAttr prefixes the value with the HTML marker', () => {
    const b = createGraph({ directed: true });
    const e = b.addEdge('a', 'b');
    e.setHtmlAttr('label', HTML);
    expect(e.getAttr('label')).toBe(MARK + HTML);
  });

  it('subgraph builder setHtmlAttr prefixes the value with the HTML marker', () => {
    const b = createGraph({ directed: true });
    const sg = b.addSubgraph('cluster0');
    sg.setHtmlAttr('label', HTML);
    expect(sg.getAttr('label')).toBe(MARK + HTML);
  });

  it('a marked HTML value round-trips to `label=<...>` on serialize', () => {
    const b = createGraph({ directed: true });
    b.addNode('F').setHtmlAttr('label', '<B>x</B>');
    // serialize emits an HTML value as `<...>`, not a quoted string.
    expect(normalizeDoc(serialize(b.graph))).toContain('label=<<B>x</B>>');
  });
});

// ── setHtmlAttr end-to-end: cluster HTML-table label sizing (issue 07) ────────

describe('setHtmlAttr drives cluster HTML-table header reservation', () => {
  const HTML = '<TABLE FIXEDSIZE="TRUE" WIDTH="10" HEIGHT="3"><TR><TD></TD></TR></TABLE>';

  /** Build the issue's single-child cluster; apply the cluster label with fn. */
  function clusterHeaderReserve(apply: (sg: GvGraphBuilder) => void): number {
    const b = createGraph({ directed: true });
    b.addNode('F', {
      shape: 'box', fixedsize: 'true', label: '', width: '0.694', height: '0.694',
    });
    const sg = b.addSubgraph('cluster0');
    apply(sg);
    sg.addNode('F');
    const ctx = new GvcContext(createMeasurer());
    ctx.register(DOT_LAYOUT_ENGINE);
    ctx.layout(b.graph, 'dot');
    const snap = getLayout(b.graph, { yAxis: 'up' });
    const c = snap.clusters.find((x) => x.name === 'cluster0')!;
    const node = snap.nodes.find((n) => n.name === 'F')!;
    // up-frame: header band = cluster top minus node top.
    return (c.y + c.height) - (node.y + node.height / 2);
  }

  it('reserves FIXEDSIZE HEIGHT + 16 for a marked HTML-table label', () => {
    // 19 = HEIGHT(3) + 16, per issue 07 / g5 ledger §C2.
    const reserve = clusterHeaderReserve((sg) => sg.setHtmlAttr('label', HTML));
    expect(reserve).toBeCloseTo(19, 1);
  });

  it('a plain setAttr label measures the literal markup as text (larger)', () => {
    // The whole point of setHtmlAttr: setAttr treats the value as a literal
    // string, so the long "<TABLE ...>" text reserves more than the table.
    const htmlReserve = clusterHeaderReserve((sg) => sg.setHtmlAttr('label', HTML));
    const plainReserve = clusterHeaderReserve((sg) => sg.setAttr('label', HTML));
    expect(plainReserve).toBeGreaterThan(htmlReserve);
  });
});
