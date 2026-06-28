// SPDX-License-Identifier: EPL-2.0

/**
 * Unit tests for graph-label.ts — doGraphLabel plain and HTML label creation.
 *
 * @see lib/common/input.c:do_graph_label
 * @see lib/common/input.c:850 — make_label(sg, str, aghtmlstr(str), false, ...)
 */

import { describe, it, expect } from 'vitest';
import type { TextMeasurer } from '../../common/textmeasure.js';
import type { TextlabelT } from '../../common/types.js';
import { Graph } from '../../model/graph.js';
import { HTML_STRING_MARK } from '../../common/html-string.js';
import { GRAPH_LABEL, doGraphLabel } from './graph-label.js';

const stubMeasurer: TextMeasurer = { measure: () => ({ w: 8, h: 4 }) };

function makeGraph(attrs: Record<string, string> = {}): Graph {
  const g = new Graph('g', 'directed');
  for (const [k, v] of Object.entries(attrs)) g.attrs.set(k, v);
  return g;
}

// ---------------------------------------------------------------------------
// no-op paths
// ---------------------------------------------------------------------------

describe('doGraphLabel — no label attr', () => {
  it('leaves sg.info.label undefined when label absent', () => {
    const g = makeGraph();
    doGraphLabel(g, stubMeasurer);
    expect(g.info.label).toBeUndefined();
  });

  it('no-ops when measurer is undefined', () => {
    const g = makeGraph({ label: 'hi' });
    doGraphLabel(g, undefined);
    expect(g.info.label).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// plain-text label
// ---------------------------------------------------------------------------

describe('doGraphLabel — plain label', () => {
  it('creates sg.info.label with html=false', () => {
    const g = makeGraph({ label: 'G' });
    doGraphLabel(g, stubMeasurer);
    expect((g.info.label as TextlabelT).html).toBe(false);
  });

  it('sets GRAPH_LABEL bit on root has_labels', () => {
    const g = makeGraph({ label: 'G' });
    doGraphLabel(g, stubMeasurer);
    expect((g.root.info.has_labels ?? 0) & GRAPH_LABEL).toBeTruthy();
  });

  it('set=false (not yet placed)', () => {
    const g = makeGraph({ label: 'G' });
    doGraphLabel(g, stubMeasurer);
    expect((g.info.label as TextlabelT).set).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// HTML label — @see lib/common/input.c:850 (aghtmlstr dispatch)
// ---------------------------------------------------------------------------

describe('doGraphLabel — html label', () => {
  it('html=true when label is HTML value', () => {
    const g = makeGraph({ label: `${HTML_STRING_MARK}<b>G</b>` });
    doGraphLabel(g, stubMeasurer);
    expect((g.info.label as TextlabelT).html).toBe(true);
  });

  it('u.kind="html" for html label', () => {
    const g = makeGraph({ label: `${HTML_STRING_MARK}<b>G</b>` });
    doGraphLabel(g, stubMeasurer);
    expect((g.info.label as TextlabelT).u.kind).toBe('html');
  });

  it('set=false for html label', () => {
    const g = makeGraph({ label: `${HTML_STRING_MARK}<b>G</b>` });
    doGraphLabel(g, stubMeasurer);
    expect((g.info.label as TextlabelT).set).toBe(false);
  });

  it('sets GRAPH_LABEL bit for html label', () => {
    const g = makeGraph({ label: `${HTML_STRING_MARK}<b>G</b>` });
    doGraphLabel(g, stubMeasurer);
    expect((g.root.info.has_labels ?? 0) & GRAPH_LABEL).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Font inheritance — a cluster (subgraph) with no fontname of its own inherits
// the ancestor's fontname/fontsize/fontcolor, mirroring C's agxget in
// do_graph_label (late_nnstring(sg, agfindgraphattr(sg, "fontname"), ...)).
// Pre-fix the cluster label fell back to the Times,serif default.
// ---------------------------------------------------------------------------

/** A cluster subgraph parented to (and rooted at) `root`. Captures the parent's
 *  effective graph-attr defaults into graphDefaultsSnapshot, mirroring the
 *  parser's parse-time snapshot that order-correct inheritance now reads. */
function makeCluster(root: Graph, attrs: Record<string, string> = {}): Graph {
  const sg = new Graph('cluster_0', 'directed');
  sg.parent = root;
  sg.root = root;
  const snap = new Map<string, string>();
  for (let g: Graph | null = root; g !== null; g = g.parent) {
    for (const [k, v] of g.attrs) if (!snap.has(k)) snap.set(k, v);
  }
  sg.graphDefaultsSnapshot = snap;
  for (const [k, v] of Object.entries(attrs)) sg.attrs.set(k, v);
  return sg;
}

describe('doGraphLabel — font inheritance', () => {
  it('cluster inherits root fontname/fontsize/fontcolor when it sets none', () => {
    const root = makeGraph({ fontname: 'Helvetica', fontsize: '20', fontcolor: 'blue' });
    const sg = makeCluster(root, { label: 'C' });
    doGraphLabel(sg, stubMeasurer);
    const lab = sg.info.label as TextlabelT;
    expect(lab.fontname).toBe('Helvetica');
    expect(lab.fontsize).toBe(20);
    expect(lab.fontcolor).toBe('blue');
  });

  it('cluster fontname overrides the inherited ancestor value', () => {
    const root = makeGraph({ fontname: 'Helvetica' });
    const sg = makeCluster(root, { label: 'C', fontname: 'Courier' });
    doGraphLabel(sg, stubMeasurer);
    expect((sg.info.label as TextlabelT).fontname).toBe('Courier');
  });

  it('root label with no fontname keeps the Times,serif default', () => {
    const g = makeGraph({ label: 'G' });
    doGraphLabel(g, stubMeasurer);
    expect((g.info.label as TextlabelT).fontname).toBe('Times,serif');
  });
});

// ---------------------------------------------------------------------------
// Label inheritance — a cluster (subgraph) with no label of its own inherits
// the nearest ancestor's label, mirroring C's agget(sg, "label"): the value is
// seeded at subgraph creation from the parent dict default (agmakeattrs). This
// is graphviz #1323, where nested cluster_mount1/cluster_mount2 (label
// commented out) inherit the enclosing cluster_vfsmount's "struct vfsmount".
// @see lib/common/input.c:844 do_graph_label
// @see lib/cgraph/attr.c:165 agmakeattrs
// ---------------------------------------------------------------------------

describe('doGraphLabel — label inheritance', () => {
  it('cluster inherits a parent cluster label when it sets none', () => {
    const root = makeGraph();
    const parent = makeCluster(root, { label: 'struct vfsmount' });
    const nested = makeCluster(parent);
    nested.parent = parent;
    doGraphLabel(nested, stubMeasurer);
    expect(nested.info.label).toBeDefined();
    expect((nested.info.label as TextlabelT).text).toBe('struct vfsmount');
  });

  it('inherited cluster label text matches the ancestor', () => {
    const root = makeGraph();
    const parent = makeCluster(root, { label: 'OUTER' });
    const nested = makeCluster(parent);
    nested.parent = parent;
    doGraphLabel(nested, stubMeasurer);
    const lab = nested.info.label as TextlabelT;
    expect(lab.text).toBe('OUTER');
  });

  it('cluster inherits the root graph label', () => {
    const root = makeGraph({ label: 'ROOTLABEL' });
    const sg = makeCluster(root);
    doGraphLabel(sg, stubMeasurer);
    expect((sg.info.label as TextlabelT).text).toBe('ROOTLABEL');
  });

  it('own label overrides an inherited ancestor label', () => {
    const root = makeGraph();
    const parent = makeCluster(root, { label: 'OUTER' });
    const nested = makeCluster(parent, { label: 'INNER' });
    nested.parent = parent;
    doGraphLabel(nested, stubMeasurer);
    expect((nested.info.label as TextlabelT).text).toBe('INNER');
  });

  it('no ancestor label leaves the cluster label undefined', () => {
    const root = makeGraph();
    const sg = makeCluster(root);
    doGraphLabel(sg, stubMeasurer);
    expect(sg.info.label).toBeUndefined();
  });
});
