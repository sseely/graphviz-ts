// SPDX-License-Identifier: EPL-2.0

/**
 * Unit tests for attr-driven initialisation of edge fields in dotInitEdge.
 *
 * Tests cover:
 *   - lateInt semantics for `minlen` (default 1, minimum 0)
 *   - mapbool semantics for `constraint` (C: is_nonconstraint / E_constr)
 *   - Interaction: constraint=false zeroes xpenalty/weight via nonconstraintEdge
 *   - Default path: no attrs → existing behaviour unchanged
 *
 * @see lib/dotgen/dotinit.c:dot_init_edge
 * @see lib/dotgen/rank.c:is_nonconstraint
 * @see lib/common/utils.c:late_int
 * @see lib/common/utils.c:mapbool
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { makeEdgeInfo, makePort } from '../../model/edgeInfo.js';
import { dotInitEdge } from './init.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGraph(name: string): Graph {
  return new Graph(name, 'directed');
}

function addNode(g: Graph, id: number, nm: string): Node {
  const n = new Node(id, nm, g);
  n.info = makeNodeInfo();
  g.nodes.set(nm, n);
  return n;
}

function addEdge(g: Graph, tail: Node, head: Node, attrs?: Record<string, string>): Edge {
  const e = new Edge(tail, head, '');
  e.info = makeEdgeInfo(makePort(), makePort());
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      e.attrs.set(k, v);
    }
  }
  g.edges.push(e);
  return e;
}

/** Build a fresh edge with optional attrs, run dotInitEdge, return the edge. */
function initEdge(attrs?: Record<string, string>): Edge {
  const g = makeGraph('test');
  const a = addNode(g, 0, 'A');
  const b = addNode(g, 1, 'B');
  const e = addEdge(g, a, b, attrs);
  dotInitEdge(e);
  return e;
}

// ---------------------------------------------------------------------------
// lateInt semantics for minlen
// @see lib/common/utils.c:late_int  (defaultValue=1, minimum=0)
// ---------------------------------------------------------------------------

describe('dotInitEdge: minlen attr — lateInt semantics (default=1, min=0)', () => {
  it('uses default 1 when minlen attr is absent', () => {
    expect(initEdge().info.minlen).toBe(1);
  });

  it('uses default 1 when minlen attr is empty string', () => {
    expect(initEdge({ minlen: '' }).info.minlen).toBe(1);
  });

  it('parses minlen="2" as 2', () => {
    expect(initEdge({ minlen: '2' }).info.minlen).toBe(2);
  });

  it('parses minlen="0" as 0 (minimum respected)', () => {
    expect(initEdge({ minlen: '0' }).info.minlen).toBe(0);
  });

  it('clamps negative minlen to 0 (minimum=0)', () => {
    expect(initEdge({ minlen: '-3' }).info.minlen).toBe(0);
  });

  it('returns default 1 for non-numeric minlen attr value', () => {
    expect(initEdge({ minlen: 'abc' }).info.minlen).toBe(1);
  });

  it('parses minlen="5" as 5', () => {
    expect(initEdge({ minlen: '5' }).info.minlen).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// mapbool semantics for constraint — absent/empty guard
// C: constr[0] check means absent or empty string leaves field unset.
// @see lib/dotgen/rank.c:is_nonconstraint
// ---------------------------------------------------------------------------

describe('dotInitEdge: constraint attr absent/empty — no field set', () => {
  it('leaves e.info.constraint undefined when attr is absent', () => {
    expect(initEdge().info.constraint).toBeUndefined();
  });

  it('leaves e.info.constraint undefined when attr is empty', () => {
    expect(initEdge({ constraint: '' }).info.constraint).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// mapbool semantics for constraint — falsy spellings
// @see lib/common/utils.c:mapbool
// ---------------------------------------------------------------------------

describe('dotInitEdge: constraint attr — falsy spellings set constraint=false', () => {
  it('sets constraint=false when attr is "false"', () => {
    expect(initEdge({ constraint: 'false' }).info.constraint).toBe(false);
  });

  it('sets constraint=false when attr is "FALSE" (case-insensitive)', () => {
    expect(initEdge({ constraint: 'FALSE' }).info.constraint).toBe(false);
  });

  it('sets constraint=false when attr is "no"', () => {
    expect(initEdge({ constraint: 'no' }).info.constraint).toBe(false);
  });

  it('sets constraint=false when attr is "0"', () => {
    expect(initEdge({ constraint: '0' }).info.constraint).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// mapbool semantics for constraint — truthy spellings
// @see lib/common/utils.c:mapbool
// ---------------------------------------------------------------------------

describe('dotInitEdge: constraint attr — truthy spellings set constraint=true', () => {
  it('sets constraint=true when attr is "true"', () => {
    expect(initEdge({ constraint: 'true' }).info.constraint).toBe(true);
  });

  it('sets constraint=true when attr is "TRUE"', () => {
    expect(initEdge({ constraint: 'TRUE' }).info.constraint).toBe(true);
  });

  it('sets constraint=true when attr is "yes"', () => {
    expect(initEdge({ constraint: 'yes' }).info.constraint).toBe(true);
  });

  it('sets constraint=true when attr is "1"', () => {
    expect(initEdge({ constraint: '1' }).info.constraint).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Interaction: constraint=false zeroes xpenalty and weight
// @see lib/dotgen/dotinit.c:dot_init_edge:73-76
// ---------------------------------------------------------------------------

describe('dotInitEdge: constraint=false zeroes xpenalty and weight', () => {
  it('sets xpenalty=0 and weight=0 when constraint=false', () => {
    const e = initEdge({ constraint: 'false' });
    expect(e.info.xpenalty).toBe(0);
    expect(e.info.weight).toBe(0);
  });

  it('keeps xpenalty=1 and weight=1 when constraint=true', () => {
    const e = initEdge({ constraint: 'true' });
    expect(e.info.xpenalty).toBe(1);
    expect(e.info.weight).toBe(1);
  });

  it('keeps xpenalty=1 and weight=1 when constraint attr is absent', () => {
    const e = initEdge();
    expect(e.info.xpenalty).toBe(1);
    expect(e.info.weight).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Default path: no attrs → existing behaviour unchanged
// @see lib/dotgen/dotinit.c:dot_init_edge (baseline regression guard)
// ---------------------------------------------------------------------------

describe('dotInitEdge: default path regression', () => {
  it('sets weight=1, count=1, xpenalty=1, minlen=1 when no attrs', () => {
    const e = initEdge();
    expect(e.info.weight).toBe(1);
    expect(e.info.count).toBe(1);
    expect(e.info.xpenalty).toBe(1);
    expect(e.info.minlen).toBe(1);
  });
});
