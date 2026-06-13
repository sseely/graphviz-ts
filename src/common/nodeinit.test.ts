// SPDX-License-Identifier: EPL-2.0

/**
 * Unit tests for nodeinit.ts — xlabel creation and has_labels bit.
 *
 * Ports the xlabel block of common_init_node:
 *   lib/common/utils.c:443-447
 *
 * @see lib/common/utils.c:common_init_node
 */

import { describe, it, expect } from 'vitest';
import type { TextMeasurer } from './textmeasure.js';
import type { TextlabelT } from './types.js';
import { Graph } from '../model/graph.js';
import { Node } from '../model/node.js';
import { makeNodeInfo } from '../model/nodeInfo.js';
import { NODE_XLABEL } from '../layout/dot/rank.js';
import { commonInitNode } from './nodeinit.js';
import { HTML_STRING_MARK } from './html-string.js';

const stubMeasurer: TextMeasurer = { measure: () => ({ w: 10, h: 5 }) };

function makeGraph(): Graph {
  const g = new Graph('g', 'directed');
  (g.root.info as unknown as Record<string, unknown>).gvc = { textMeasurer: stubMeasurer };
  return g;
}

function addNode(g: Graph, name: string, attrs: Record<string, string> = {}): Node {
  const n = new Node(1, name, g);
  n.info = makeNodeInfo();
  for (const [k, v] of Object.entries(attrs)) n.attrs.set(k, v);
  g.nodes.set(name, n);
  return n;
}

function nodeWithXlabel(xlabel: string): { g: Graph; n: Node } {
  const g = makeGraph();
  const n = addNode(g, 'A', xlabel ? { xlabel } : {});
  commonInitNode(n, g);
  return { g, n };
}

// ---------------------------------------------------------------------------
// No xlabel — @see lib/common/utils.c:443 (N_xlabel guard)
// ---------------------------------------------------------------------------

describe('commonInitNode — xlabel absent', () => {
  it('leaves xlabel undefined', () => {
    const { n } = nodeWithXlabel('');
    expect(n.info.xlabel).toBeUndefined();
  });

  it('leaves NODE_XLABEL bit unset', () => {
    const { g } = nodeWithXlabel('');
    expect((g.info.has_labels ?? 0) & NODE_XLABEL).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Empty xlabel — C guards str[0]; @see lib/common/utils.c:443
// ---------------------------------------------------------------------------

describe('commonInitNode — xlabel empty string', () => {
  it('leaves xlabel undefined when attr is empty', () => {
    const g = makeGraph();
    const n = addNode(g, 'A', { xlabel: '' });
    commonInitNode(n, g);
    expect(n.info.xlabel).toBeUndefined();
  });

  it('leaves NODE_XLABEL bit unset when attr is empty', () => {
    const g = makeGraph();
    const n = addNode(g, 'A', { xlabel: '' });
    commonInitNode(n, g);
    expect((g.info.has_labels ?? 0) & NODE_XLABEL).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// xlabel present — @see lib/common/utils.c:444-446
// ---------------------------------------------------------------------------

describe('commonInitNode — xlabel text and dimen', () => {
  it('creates xlabel with correct text', () => {
    const { n } = nodeWithXlabel('nx');
    expect((n.info.xlabel as TextlabelT).text).toBe('nx');
  });

  it('xlabel has measured dimen from stub measurer', () => {
    const { n } = nodeWithXlabel('nx');
    const xl = n.info.xlabel as TextlabelT;
    expect(xl.dimen.x).toBe(10);
    expect(xl.dimen.y).toBe(5);
  });

  it('xlabel set=false (not yet placed by addXLabels)', () => {
    const { n } = nodeWithXlabel('nx');
    expect((n.info.xlabel as TextlabelT).set).toBe(false);
  });
});

describe('commonInitNode — xlabel font attrs', () => {
  it('uses default fontname when node has no font attr', () => {
    const { n } = nodeWithXlabel('nx');
    expect((n.info.xlabel as TextlabelT).fontname).toBe('Times,serif');
  });

  it('uses per-node fontname override', () => {
    const g = makeGraph();
    const n = addNode(g, 'A', { xlabel: 'nx', fontname: 'Helvetica' });
    commonInitNode(n, g);
    expect((n.info.xlabel as TextlabelT).fontname).toBe('Helvetica');
  });
});

describe('commonInitNode — NODE_XLABEL bit', () => {
  it('sets NODE_XLABEL on root has_labels', () => {
    const { g } = nodeWithXlabel('nx');
    expect((g.info.has_labels ?? 0) & NODE_XLABEL).toBeTruthy();
  });

  it('accumulates bit across multiple nodes', () => {
    const g = makeGraph();
    const n1 = addNode(g, 'A', { xlabel: 'nx' });
    const n2 = addNode(g, 'B', { xlabel: 'ny' });
    commonInitNode(n1, g);
    commonInitNode(n2, g);
    expect((g.info.has_labels ?? 0) & NODE_XLABEL).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// HTML xlabel — @see lib/common/utils.c:444 (aghtmlstr dispatch)
// ---------------------------------------------------------------------------

/** Build a node with an HTML xlabel attr. */
function nodeWithHtmlXlabel(): { g: Graph; n: Node } {
  const g = makeGraph();
  const n = addNode(g, 'A', { xlabel: `${HTML_STRING_MARK}<b>x</b>` });
  commonInitNode(n, g);
  return { g, n };
}

describe('commonInitNode — html xlabel html flag', () => {
  it('sets html=true', () => {
    const { n } = nodeWithHtmlXlabel();
    expect((n.info.xlabel as TextlabelT).html).toBe(true);
  });

  it('sets u.kind="html"', () => {
    const { n } = nodeWithHtmlXlabel();
    expect((n.info.xlabel as TextlabelT).u.kind).toBe('html');
  });

  it('set=false (not yet placed)', () => {
    const { n } = nodeWithHtmlXlabel();
    expect((n.info.xlabel as TextlabelT).set).toBe(false);
  });
});

describe('commonInitNode — html xlabel bits', () => {
  it('sets NODE_XLABEL bit', () => {
    const { g } = nodeWithHtmlXlabel();
    expect((g.root.info.has_labels ?? 0) & NODE_XLABEL).toBeTruthy();
  });

  it('plain-text xlabel remains html=false', () => {
    const { n } = nodeWithXlabel('plain');
    expect((n.info.xlabel as TextlabelT).html).toBe(false);
  });
});
