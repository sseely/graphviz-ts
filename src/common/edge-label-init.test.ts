// SPDX-License-Identifier: EPL-2.0

/**
 * Unit tests for edge-label-init.ts — font fallback chain and label creation.
 *
 * Mirrors the font-attr resolution logic in:
 *   - initFontEdgeAttr      (lib/common/utils.c:456-461)
 *   - initFontLabelEdgeAttr (lib/common/utils.c:463-471)
 *   - common_init_edge headlabel/taillabel block (lib/common/utils.c:533-545)
 *
 * @see lib/common/utils.c:initFontEdgeAttr
 * @see lib/common/utils.c:initFontLabelEdgeAttr
 */

import { describe, it, expect } from 'vitest';
import type { TextMeasurer } from './textmeasure.js';
import { Graph } from '../model/graph.js';
import { Node } from '../model/node.js';
import { Edge } from '../model/edge.js';
import { makeNodeInfo } from '../model/nodeInfo.js';
import { makeEdgeInfo, makePort } from '../model/edgeInfo.js';
import { EDGE_LABEL, EDGE_XLABEL, HEAD_LABEL, TAIL_LABEL } from '../layout/dot/rank.js';
import {
  initFontEdgeAttr,
  initFontLabelEdgeAttr,
  initEdgeLabels,
} from './edge-label-init.js';
import { DEFAULT_FONTNAME, DEFAULT_COLOR, DEFAULT_FONTSIZE } from './make-label.js';

// ---------------------------------------------------------------------------
// Stub measurer — geometry zeroed; sufficient for init-phase tests
// ---------------------------------------------------------------------------

const stubMeasurer: TextMeasurer = { measure: () => ({ w: 0, h: 0 }) };

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function addNode(g: Graph, id: number, name: string): Node {
  const n = new Node(id, name, g);
  n.info = makeNodeInfo();
  g.nodes.set(name, n);
  return n;
}

function addEdge(g: Graph, tail: Node, head: Node, attrs: Map<string, string>): Edge {
  const e = new Edge(tail, head, '');
  e.info = makeEdgeInfo(makePort(), makePort());
  for (const [k, v] of attrs) e.attrs.set(k, v);
  g.edges.push(e);
  return e;
}

/** Create a directed graph with two nodes a→b and one edge carrying attrs. */
function makeEdgeInGraph(attrs: Map<string, string>): {
  g: Graph;
  e: Edge;
} {
  const g = new Graph('g', 'directed');
  const a = addNode(g, 1, 'a');
  const b = addNode(g, 2, 'b');
  const e = addEdge(g, a, b, attrs);
  return { g, e };
}

// ---------------------------------------------------------------------------
// initFontEdgeAttr — font fallback chain
// @see lib/common/utils.c:456-461
// ---------------------------------------------------------------------------

describe('initFontEdgeAttr', () => {
  it('uses edge fontsize/fontname/fontcolor when set', () => {
    const { e } = makeEdgeInGraph(new Map([
      ['fontsize', '20'], ['fontname', 'Helvetica'], ['fontcolor', 'red'],
    ]));
    const fi = initFontEdgeAttr(e);
    expect(fi.fontsize).toBe(20);
    expect(fi.fontname).toBe('Helvetica');
    expect(fi.fontcolor).toBe('red');
  });

  it('falls back to global defaults when attrs absent', () => {
    const { e } = makeEdgeInGraph(new Map());
    const fi = initFontEdgeAttr(e);
    expect(fi.fontsize).toBe(DEFAULT_FONTSIZE);
    expect(fi.fontname).toBe(DEFAULT_FONTNAME);
    expect(fi.fontcolor).toBe(DEFAULT_COLOR);
  });

  it('clamps fontsize below MIN_FONTSIZE up to the minimum', () => {
    const { e } = makeEdgeInGraph(new Map([['fontsize', '0']]));
    // C late_double: `if (rv < minimum) return minimum` — utils.c:66-67;
    // MIN_FONTSIZE = 1.0 (const.h:63)
    expect(initFontEdgeAttr(e).fontsize).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// initFontLabelEdgeAttr — labelfont* fallback chain
// @see lib/common/utils.c:463-471
// ---------------------------------------------------------------------------

describe('initFontLabelEdgeAttr', () => {
  it('uses labelfont* attrs when all present', () => {
    const { e } = makeEdgeInGraph(new Map([
      ['labelfontsize', '9'], ['labelfontname', 'Courier'], ['labelfontcolor', 'blue'],
    ]));
    const lfi = initFontLabelEdgeAttr(e, initFontEdgeAttr(e));
    expect(lfi.fontsize).toBe(9);
    expect(lfi.fontname).toBe('Courier');
    expect(lfi.fontcolor).toBe('blue');
  });

  it('falls back to fi when labelfont* absent', () => {
    const { e } = makeEdgeInGraph(new Map([
      ['fontsize', '18'], ['fontname', 'Arial'], ['fontcolor', 'green'],
    ]));
    const lfi = initFontLabelEdgeAttr(e, initFontEdgeAttr(e));
    expect(lfi.fontsize).toBe(18);
    expect(lfi.fontname).toBe('Arial');
    expect(lfi.fontcolor).toBe('green');
  });

  it('falls back to global defaults when both fi and labelfont* absent', () => {
    const { e } = makeEdgeInGraph(new Map());
    const lfi = initFontLabelEdgeAttr(e, initFontEdgeAttr(e));
    expect(lfi.fontsize).toBe(DEFAULT_FONTSIZE);
    expect(lfi.fontname).toBe(DEFAULT_FONTNAME);
    expect(lfi.fontcolor).toBe(DEFAULT_COLOR);
  });
});

// ---------------------------------------------------------------------------
// initEdgeLabels — head_label / tail_label creation + has_labels bits
// @see lib/common/utils.c:533-545
// ---------------------------------------------------------------------------

describe('initEdgeLabels — noop', () => {
  it('no-ops when neither headlabel nor taillabel is set', () => {
    const { g, e } = makeEdgeInGraph(new Map());
    initEdgeLabels(e, g, stubMeasurer);
    expect(e.info.head_label).toBeUndefined();
    expect(e.info.tail_label).toBeUndefined();
    expect(g.info.has_labels ?? 0).toBe(0);
  });
});

describe('initEdgeLabels — headlabel', () => {
  it('creates head_label and sets HEAD_LABEL bit', () => {
    const { g, e } = makeEdgeInGraph(new Map([['headlabel', 'H']]));
    initEdgeLabels(e, g, stubMeasurer);
    expect(e.info.head_label?.text).toBe('H');
    expect((g.info.has_labels ?? 0) & HEAD_LABEL).toBeTruthy();
    expect(e.info.tail_label).toBeUndefined();
  });

  it('uses labelfont* chain for head_label attrs', () => {
    const { g, e } = makeEdgeInGraph(new Map([
      ['headlabel', 'H'], ['labelfontname', 'Courier'],
      ['labelfontsize', '9'], ['labelfontcolor', 'blue'],
    ]));
    initEdgeLabels(e, g, stubMeasurer);
    expect(e.info.head_label?.fontname).toBe('Courier');
    expect(e.info.head_label?.fontsize).toBe(9);
    expect(e.info.head_label?.fontcolor).toBe('blue');
  });
});

describe('initEdgeLabels — taillabel', () => {
  it('creates tail_label and sets TAIL_LABEL bit', () => {
    const { g, e } = makeEdgeInGraph(new Map([['taillabel', 'T']]));
    initEdgeLabels(e, g, stubMeasurer);
    expect(e.info.tail_label?.text).toBe('T');
    expect((g.info.has_labels ?? 0) & TAIL_LABEL).toBeTruthy();
    expect(e.info.head_label).toBeUndefined();
  });
});

describe('initEdgeLabels — both labels', () => {
  it('creates both labels and sets both bits', () => {
    const { g, e } = makeEdgeInGraph(
      new Map([['headlabel', 'H'], ['taillabel', 'T']]),
    );
    initEdgeLabels(e, g, stubMeasurer);
    expect(e.info.head_label?.text).toBe('H');
    expect(e.info.tail_label?.text).toBe('T');
    expect((g.info.has_labels ?? 0) & HEAD_LABEL).toBeTruthy();
    expect((g.info.has_labels ?? 0) & TAIL_LABEL).toBeTruthy();
  });
});

/** Two-edge graph for accumulation tests. */
function makeTwoEdgeGraph(): { g: Graph; e1: Edge; e2: Edge } {
  const g = new Graph('g', 'directed');
  const a = addNode(g, 1, 'a');
  const b = addNode(g, 2, 'b');
  const e1 = addEdge(g, a, b, new Map([['headlabel', 'H1']]));
  const e2 = addEdge(g, a, b, new Map([['headlabel', 'H2']]));
  return { g, e1, e2 };
}

describe('initEdgeLabels — accumulation', () => {
  it('accumulates HEAD_LABEL bit across multiple edges', () => {
    const { g, e1, e2 } = makeTwoEdgeGraph();
    initEdgeLabels(e1, g, stubMeasurer);
    initEdgeLabels(e2, g, stubMeasurer);
    expect((g.info.has_labels ?? 0) & HEAD_LABEL).toBeTruthy();
    expect(e1.info.head_label?.text).toBe('H1');
    expect(e2.info.head_label?.text).toBe('H2');
  });
});

// ---------------------------------------------------------------------------
// initEdgeLabels — label= (EDGE_LABEL) creation
// @see lib/common/utils.c:517-523
// ---------------------------------------------------------------------------

describe('initEdgeLabels — label noop', () => {
  it('no-ops when label attr is absent', () => {
    const { g, e } = makeEdgeInGraph(new Map());
    initEdgeLabels(e, g, stubMeasurer);
    expect(e.info.label).toBeUndefined();
    expect((g.info.has_labels ?? 0) & EDGE_LABEL).toBe(0);
  });

  it('no-ops when label attr is empty string', () => {
    const { g, e } = makeEdgeInGraph(new Map([['label', '']]));
    initEdgeLabels(e, g, stubMeasurer);
    expect(e.info.label).toBeUndefined();
    expect((g.info.has_labels ?? 0) & EDGE_LABEL).toBe(0);
  });
});

describe('initEdgeLabels — label creation', () => {
  it('creates e.info.label and sets EDGE_LABEL bit', () => {
    const { g, e } = makeEdgeInGraph(new Map([['label', 'el']]));
    initEdgeLabels(e, g, stubMeasurer);
    expect(e.info.label?.text).toBe('el');
    expect((g.info.has_labels ?? 0) & EDGE_LABEL).toBeTruthy();
  });

  it('uses edge fontinfo chain for label fontname/fontsize/fontcolor', () => {
    const { g, e } = makeEdgeInGraph(new Map([
      ['label', 'el'],
      ['fontname', 'Arial'], ['fontsize', '16'], ['fontcolor', 'navy'],
    ]));
    initEdgeLabels(e, g, stubMeasurer);
    expect(e.info.label?.fontname).toBe('Arial');
    expect(e.info.label?.fontsize).toBe(16);
    expect(e.info.label?.fontcolor).toBe('navy');
  });

  it('falls back to global font defaults when no font attrs set', () => {
    const { g, e } = makeEdgeInGraph(new Map([['label', 'el']]));
    initEdgeLabels(e, g, stubMeasurer);
    expect(e.info.label?.fontname).toBe(DEFAULT_FONTNAME);
    expect(e.info.label?.fontsize).toBe(DEFAULT_FONTSIZE);
    expect(e.info.label?.fontcolor).toBe(DEFAULT_COLOR);
  });
});

describe('initEdgeLabels — label_ontop', () => {
  it('defaults label_ontop to 0 when label_float absent', () => {
    const { g, e } = makeEdgeInGraph(new Map([['label', 'el']]));
    initEdgeLabels(e, g, stubMeasurer);
    expect(e.info.label_ontop).toBe(0);
  });

  it('sets label_ontop to 1 when label_float="true"', () => {
    const { g, e } = makeEdgeInGraph(new Map([
      ['label', 'el'], ['label_float', 'true'],
    ]));
    initEdgeLabels(e, g, stubMeasurer);
    expect(e.info.label_ontop).toBe(1);
  });

  it('sets label_ontop to 0 when label_float="false"', () => {
    const { g, e } = makeEdgeInGraph(new Map([
      ['label', 'el'], ['label_float', 'false'],
    ]));
    initEdgeLabels(e, g, stubMeasurer);
    expect(e.info.label_ontop).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// initEdgeLabels — xlabel= (EDGE_XLABEL) creation
// @see lib/common/utils.c:525-531
// ---------------------------------------------------------------------------

describe('initEdgeLabels — xlabel noop', () => {
  it('no-ops when xlabel attr is absent', () => {
    const { g, e } = makeEdgeInGraph(new Map());
    initEdgeLabels(e, g, stubMeasurer);
    expect(e.info.xlabel).toBeUndefined();
    expect((g.info.has_labels ?? 0) & EDGE_XLABEL).toBe(0);
  });

  it('no-ops when xlabel attr is empty string', () => {
    const { g, e } = makeEdgeInGraph(new Map([['xlabel', '']]));
    initEdgeLabels(e, g, stubMeasurer);
    expect(e.info.xlabel).toBeUndefined();
    expect((g.info.has_labels ?? 0) & EDGE_XLABEL).toBe(0);
  });
});

describe('initEdgeLabels — xlabel creation', () => {
  it('creates e.info.xlabel and sets EDGE_XLABEL bit', () => {
    const { g, e } = makeEdgeInGraph(new Map([['xlabel', 'ex']]));
    initEdgeLabels(e, g, stubMeasurer);
    expect(e.info.xlabel?.text).toBe('ex');
    expect((g.info.has_labels ?? 0) & EDGE_XLABEL).toBeTruthy();
  });

  it('initializes fi for xlabel when label is absent', () => {
    const { g, e } = makeEdgeInGraph(new Map([
      ['xlabel', 'ex'],
      ['fontname', 'Helvetica'], ['fontsize', '12'], ['fontcolor', 'blue'],
    ]));
    initEdgeLabels(e, g, stubMeasurer);
    expect(e.info.xlabel?.fontname).toBe('Helvetica');
    expect(e.info.xlabel?.fontsize).toBe(12);
    expect(e.info.xlabel?.fontcolor).toBe('blue');
  });

  it('accumulates EDGE_LABEL and EDGE_XLABEL bits independently', () => {
    const { g, e } = makeEdgeInGraph(new Map([['label', 'el'], ['xlabel', 'ex']]));
    initEdgeLabels(e, g, stubMeasurer);
    expect((g.info.has_labels ?? 0) & EDGE_LABEL).toBeTruthy();
    expect((g.info.has_labels ?? 0) & EDGE_XLABEL).toBeTruthy();
  });
});

describe('initEdgeLabels — xlabel fi laziness', () => {
  it('reuses fi from label block when both label and xlabel are set', () => {
    // C: if (!fi.fontname) initFontEdgeAttr(e, &fi) — init once, reuse
    const { g, e } = makeEdgeInGraph(new Map([
      ['label', 'el'], ['xlabel', 'ex'],
      ['fontname', 'Courier'], ['fontsize', '10'], ['fontcolor', 'red'],
    ]));
    initEdgeLabels(e, g, stubMeasurer);
    expect(e.info.label?.fontname).toBe('Courier');
    expect(e.info.xlabel?.fontname).toBe('Courier');
    expect(e.info.label?.fontsize).toBe(10);
    expect(e.info.xlabel?.fontsize).toBe(10);
  });
});
