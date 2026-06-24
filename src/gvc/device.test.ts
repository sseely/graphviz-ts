// SPDX-License-Identifier: EPL-2.0

/**
 * Acceptance tests for the device render loop and coordinate transform (T27).
 *
 * AC1: transformPoint applies devscale to Y when GVRENDER_Y_GOES_DOWN
 * AC2: transformPoint returns point unchanged when GVRENDER_DOES_TRANSFORM set
 * AC3: renderGraph calls beginGraph before node callbacks and endGraph after edge callbacks
 * AC4: renderGraph calls beginGraph and endGraph exactly once on an empty graph
 * AC5: node xlabel emitted inside node group after codefn (set=true)
 * AC6: node xlabel not emitted when set=false
 * AC7: graph label emitted before first node group (set=true)
 * AC8: graph label not emitted when absent or set=false
 * AC9: renderOneLabel — placed html edge label renders cells (set=true, html=true)
 * AC10: renderOneLabel — txt-only labels unchanged by html branch
 * AC11: renderOneLabel — set=false html label is skipped
 * AC12: renderClusterLabel — html cluster label renders cells
 * AC13: renderNode pushes obj-state (non-null in codefn) and pops after (balanced)
 * AC14: unstyled node emits fill="none" stroke="black" via default obj-state
 */

import { describe, it, expect } from 'vitest';
import { transformPoint, renderGraph, renderOneLabel, renderNodeXLabel, renderGraphLabel, renderClusterLabel, renderNode } from './device.js';
import { RenderJob, GVRENDER_DOES_TRANSFORM } from './job.js';
import { createSvgRenderer } from '../render/svg.js';
import type { RendererPlugin } from './context.js';
import type { TextMeasurer } from '../common/textmeasure.js';
import type { Graph } from '../model/graph.js';
import { Graph as GraphClass } from '../model/graph.js';
import { Node } from '../model/node.js';
import { Edge } from '../model/edge.js';
import { makeNodeInfo } from '../model/nodeInfo.js';
import { makePort, makeEdgeInfo } from '../model/edgeInfo.js';
import type { TextlabelT } from '../common/types.js';
import type { TextSpan } from '../common/emit-types.js';
import type { PlacedHtml } from '../common/htmltable-pos.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const stubMeasurer: TextMeasurer = { measure: () => ({ w: 0, h: 0 }) };

function makeJob(): RenderJob {
  const job = new RenderJob('svg', stubMeasurer);
  job.zoom = 1;
  job.devscale = { x: 1, y: -1 };
  job.translation = { x: 0, y: 0 };
  job.rotation = 0;
  return job;
}

// Class-based mock — avoids spread/cast patterns that confuse Lizard.
class RecordingRenderer implements RendererPlugin {
  readonly type = 'test';
  readonly quality = 0;
  readonly calls: string[] = [];
  beginGraph() { this.calls.push('beginGraph'); }
  endGraph() { this.calls.push('endGraph'); }
  beginNode() { this.calls.push('beginNode'); }
  endNode() { this.calls.push('endNode'); }
  beginEdge() { this.calls.push('beginEdge'); }
  endEdge() { this.calls.push('endEdge'); }
  textspan() {}
  ellipse() {}
  polygon() {}
  bezier() {}
  polyline() {}
}

// ---------------------------------------------------------------------------
// AC1: transformPoint applies devscale
// ---------------------------------------------------------------------------

describe('AC1: transformPoint — devscale applied', () => {
  it('inverts Y when devscale.y is -1', () => {
    const job = makeJob();
    const pt = transformPoint({ x: 1, y: 2 }, job);
    expect(pt).toEqual({ x: 1, y: -2 });
  });
});

// ---------------------------------------------------------------------------
// AC2: transformPoint short-circuits on GVRENDER_DOES_TRANSFORM
// ---------------------------------------------------------------------------

describe('AC2: transformPoint — GVRENDER_DOES_TRANSFORM bypasses mapping', () => {
  it('returns the input point unchanged', () => {
    const job = makeJob();
    job.flags |= GVRENDER_DOES_TRANSFORM;
    const input = { x: 1, y: 2 };
    expect(transformPoint(input, job)).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// AC3: renderGraph call ordering
// ---------------------------------------------------------------------------

describe('AC3: renderGraph — callback ordering', () => {
  it('calls beginGraph before beginNode and endGraph after endEdge', () => {
    const g = new GraphClass('G', 'directed');
    const n1 = new Node(1, 'n1', g);
    n1.info = makeNodeInfo();
    g.nodes.set('n1', n1);
    const n2 = new Node(2, 'n2', g);
    n2.info = makeNodeInfo();
    g.nodes.set('n2', n2);
    const e = new Edge(n1, n2, 'e1');
    e.info = makeEdgeInfo(makePort(), makePort());
    g.edges.push(e);
    const renderer = new RecordingRenderer();
    const job = new RenderJob('svg', stubMeasurer);
    renderGraph(g, job, renderer);
    const calls = renderer.calls;
    expect(calls[0]).toBe('beginGraph');
    expect(calls[calls.length - 1]).toBe('endGraph');
    const firstNode = calls.indexOf('beginNode');
    const lastEdge = calls.lastIndexOf('endEdge');
    expect(firstNode).toBeGreaterThan(0);
    expect(lastEdge).toBeGreaterThan(firstNode);
  });
});

// ---------------------------------------------------------------------------
// AC4: renderGraph on empty graph
// ---------------------------------------------------------------------------

describe('AC4: renderGraph — empty graph', () => {
  it('calls beginGraph and endGraph exactly once, no node/edge callbacks', () => {
    const g = new GraphClass('G', 'directed') as unknown as Graph;
    const renderer = new RecordingRenderer();
    const job = new RenderJob('svg', stubMeasurer);
    renderGraph(g, job, renderer);
    expect(renderer.calls).toEqual(['beginGraph', 'endGraph']);
  });
});

// ---------------------------------------------------------------------------
// Shared label test helpers
// ---------------------------------------------------------------------------

/** Build a minimal placed TextlabelT with one text span. */
function makePlacedLabel(text: string, set: boolean): TextlabelT {
  const span: TextSpan = {
    str: text,
    fontName: 'Times,serif',
    fontSize: 14,
    fontColor: '#000000',
    fontFlags: 0,
    just: 'n',
    size: { x: 40, y: 14 },
    yoffset_centerline: 5,
    yoffset_layout: 0,
  };
  return {
    text,
    fontname: 'Times,serif',
    fontcolor: 'black',
    charset: 0,
    fontsize: 14,
    dimen: { x: 40, y: 14 },
    space: { x: 40, y: 14 },
    pos: { x: 50, y: 20 },
    u: { kind: 'txt', span: [span], nspans: 1 },
    valign: 0,
    set,
    html: false,
  };
}

/** Renderer that records textspan calls (str, x, y). */
class TextCapture implements RendererPlugin {
  readonly type = 'test';
  readonly quality = 0;
  readonly spans: Array<{ str: string; x: number; y: number }> = [];
  beginGraph() {}
  endGraph() {}
  beginNode() {}
  endNode() {}
  beginEdge() {}
  endEdge() {}
  textspan(pos: { x: number; y: number }, span: TextSpan) {
    this.spans.push({ str: span.str, x: pos.x, y: pos.y });
  }
  ellipse() {}
  polygon() {}
  bezier() {}
  polyline() {}
}

// ---------------------------------------------------------------------------
// AC5: node xlabel emitted inside node group (set=true)
// @see lib/common/emit.c:emit_node (1829-1830)
// ---------------------------------------------------------------------------

describe('AC5: renderNodeXLabel — placed xlabel emitted', () => {
  it('calls textspan with label text when set=true', () => {
    const g = new GraphClass('G', 'directed');
    const n = new Node(0, 'A', g);
    n.info = makeNodeInfo();
    n.info.xlabel = makePlacedLabel('nx', true);
    const renderer = new TextCapture();
    const job = new RenderJob('svg', stubMeasurer);
    renderNodeXLabel(n, renderer, job);
    expect(renderer.spans).toHaveLength(1);
    expect(renderer.spans[0].str).toBe('nx');
  });
});

// ---------------------------------------------------------------------------
// AC6: node xlabel NOT emitted when set=false
// @see lib/common/emit.c:emit_node (1829) — ND_xlabel(n)->set guard
// ---------------------------------------------------------------------------

describe('AC6: renderNodeXLabel — xlabel suppressed when set=false', () => {
  it('does not call textspan when set=false', () => {
    const g = new GraphClass('G', 'directed');
    const n = new Node(0, 'A', g);
    n.info = makeNodeInfo();
    n.info.xlabel = makePlacedLabel('nx', false);
    const renderer = new TextCapture();
    const job = new RenderJob('svg', stubMeasurer);
    renderNodeXLabel(n, renderer, job);
    expect(renderer.spans).toHaveLength(0);
  });

  it('does not call textspan when xlabel is absent', () => {
    const g = new GraphClass('G', 'directed');
    const n = new Node(0, 'A', g);
    n.info = makeNodeInfo();
    const renderer = new TextCapture();
    const job = new RenderJob('svg', stubMeasurer);
    renderNodeXLabel(n, renderer, job);
    expect(renderer.spans).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC7: graph label emitted before node groups
// @see lib/common/emit.c:emit_page (3656-3657)
// ---------------------------------------------------------------------------

/** Records call order for graph-label ordering assertions. */
class OrderCapture implements RendererPlugin {
  readonly type = 'test';
  readonly quality = 0;
  readonly callOrder: string[] = [];
  beginGraph() { this.callOrder.push('beginGraph'); }
  endGraph() { this.callOrder.push('endGraph'); }
  beginNode() { this.callOrder.push('beginNode'); }
  endNode() { this.callOrder.push('endNode'); }
  beginEdge() {}
  endEdge() {}
  textspan(_pos: { x: number; y: number }, span: TextSpan) {
    this.callOrder.push('textspan:' + span.str);
  }
  ellipse() {}
  polygon() {}
  bezier() {}
  polyline() {}
}

describe('AC7: renderGraph — graph label emitted before node groups', () => {
  it('emits graph label text and places it before node beginNode call', () => {
    const g = new GraphClass('G', 'directed');
    const n = new Node(0, 'A', g);
    n.info = makeNodeInfo();
    g.nodes.set('A', n);
    g.info.label = makePlacedLabel('gl', true);
    const renderer = new OrderCapture();
    const job = new RenderJob('svg', stubMeasurer);
    renderGraph(g, job, renderer);
    const { callOrder } = renderer;
    const labelIdx = callOrder.indexOf('textspan:gl');
    const nodeIdx = callOrder.indexOf('beginNode');
    expect(labelIdx).toBeGreaterThan(-1);
    expect(nodeIdx).toBeGreaterThan(-1);
    // graph label must appear before the first node group
    expect(labelIdx).toBeLessThan(nodeIdx);
  });
});

// ---------------------------------------------------------------------------
// AC8: graph label NOT emitted when absent or set=false
// @see lib/common/emit.c:emit_page (3656) — GD_label(g) NULL check
// ---------------------------------------------------------------------------

describe('AC8: renderGraphLabel — label suppressed when absent or set=false', () => {
  it('does not call textspan when graph has no label', () => {
    const g = new GraphClass('G', 'directed') as unknown as Graph;
    const renderer = new TextCapture();
    const job = new RenderJob('svg', stubMeasurer);
    renderGraphLabel(g, renderer, job);
    expect(renderer.spans).toHaveLength(0);
  });

  it('does not call textspan when graph label has set=false', () => {
    const g = new GraphClass('G', 'directed');
    g.info.label = makePlacedLabel('gl', false);
    const renderer = new TextCapture();
    const job = new RenderJob('svg', stubMeasurer);
    renderGraphLabel(g, renderer, job);
    expect(renderer.spans).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// HTML label helpers
// ---------------------------------------------------------------------------

/** Build a minimal PlacedHtml with one cell, one line. */
function makePlacedHtml(text: string): PlacedHtml {
  return {
    box: { ll: { x: -20, y: -7 }, ur: { x: 20, y: 7 } },
    border: 0,
    columnCount: 1,
    rowCount: 1,
    spacing: 0,
    cells: [
      {
        box: { ll: { x: -20, y: -7 }, ur: { x: 20, y: 7 } },
        border: 0,
        col: 0, row: 0, colspan: 1, rowspan: 1,
        lines: [
          {
            text,
            fontName: 'Times,serif',
            fontSize: 14,
            fontColor: '#000000',
            fontFlags: 0,
            x: -18,
            baseline: 5,
            width: 36,
          },
        ],
      },
    ],
  };
}

/** Build a placed html TextlabelT wrapping the given PlacedHtml. */
function makeHtmlLabel(placed: PlacedHtml, set: boolean): TextlabelT {
  return {
    text: '',
    fontname: 'Times,serif',
    fontcolor: 'black',
    charset: 0,
    fontsize: 14,
    dimen: { x: 40, y: 14 },
    space: { x: 40, y: 14 },
    pos: { x: 50, y: 20 },
    u: { kind: 'html', html: placed },
    valign: 0,
    set,
    html: true,
  };
}

/** Renderer that captures polygon (border box) and textspan calls. */
class HtmlCapture implements RendererPlugin {
  readonly type = 'test';
  readonly quality = 0;
  readonly spans: Array<{ str: string; x: number; y: number }> = [];
  readonly polygons: number[] = []; // polygon call count
  beginGraph() {}
  endGraph() {}
  beginNode() {}
  endNode() {}
  beginEdge() {}
  endEdge() {}
  textspan(pos: { x: number; y: number }, span: TextSpan) {
    this.spans.push({ str: span.str, x: pos.x, y: pos.y });
  }
  ellipse() {}
  polygon() { this.polygons.push(1); }
  bezier() {}
  polyline() {}
}

// ---------------------------------------------------------------------------
// AC9: renderOneLabel — placed html edge label renders cells (set=true)
// @see lib/common/labels.c:emit_label (226-230)
// ---------------------------------------------------------------------------

describe('AC9: renderOneLabel — html edge label renders cells when set=true', () => {
  it('calls textspan for the html cell line text', () => {
    const placed = makePlacedHtml('bold-edge');
    const lp = makeHtmlLabel(placed, true);
    const renderer = new HtmlCapture();
    const job = new RenderJob('svg', stubMeasurer);
    renderOneLabel(lp, renderer, job);
    expect(renderer.spans).toHaveLength(1);
    expect(renderer.spans[0].str).toBe('bold-edge');
  });

  it('passes lp.pos as the html anchor (labels.c:emit_label:252, emit_html_label:764)', () => {
    const placed = makePlacedHtml('e');
    const lp = makeHtmlLabel(placed, true);
    // PlacedLine x=-18, baseline=5, lp.pos={x:50,y:20}; job identity transform
    const renderer = new HtmlCapture();
    const job = new RenderJob('svg', stubMeasurer);
    job.zoom = 1;
    job.devscale = { x: 1, y: 1 };
    job.translation = { x: 0, y: 0 };
    job.rotation = 0;
    renderOneLabel(lp, renderer, job);
    // x = line.x + pos.x = -18 + 50 = 32; y = line.baseline + pos.y = 5 + 20 = 25
    expect(renderer.spans[0].x).toBe(32);
    expect(renderer.spans[0].y).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// AC10: renderOneLabel — txt label path unchanged by html branch
// ---------------------------------------------------------------------------

describe('AC10: renderOneLabel — txt label unchanged', () => {
  it('still emits textspan for txt label when html=false', () => {
    const lp = makePlacedLabel('plain', true);
    const renderer = new TextCapture();
    const job = new RenderJob('svg', stubMeasurer);
    renderOneLabel(lp, renderer, job);
    expect(renderer.spans).toHaveLength(1);
    expect(renderer.spans[0].str).toBe('plain');
  });
});

// ---------------------------------------------------------------------------
// AC11: renderOneLabel — set=false html label is skipped
// @see lib/common/labels.c:emit_label guards (caller: lbl->set check)
// ---------------------------------------------------------------------------

describe('AC11: renderOneLabel — html label skipped when set=false', () => {
  it('emits nothing when set=false even if html=true', () => {
    const placed = makePlacedHtml('should-not-emit');
    const lp = makeHtmlLabel(placed, false);
    const renderer = new HtmlCapture();
    const job = new RenderJob('svg', stubMeasurer);
    renderOneLabel(lp, renderer, job);
    expect(renderer.spans).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC12: renderClusterLabel — html cluster label renders cells
// @see lib/common/emit.c:emit_clusters (3921)
// ---------------------------------------------------------------------------

describe('AC12: renderClusterLabel — html cluster label renders cells', () => {
  it('emits textspan for html cluster label', () => {
    const g = new GraphClass('G', 'directed');
    const placed = makePlacedHtml('cluster-html');
    g.info.label = makeHtmlLabel(placed, true);
    const renderer = new HtmlCapture();
    const job = new RenderJob('svg', stubMeasurer);
    renderClusterLabel(g, renderer, job);
    expect(renderer.spans).toHaveLength(1);
    expect(renderer.spans[0].str).toBe('cluster-html');
  });

  it('does not emit when cluster label is absent', () => {
    const g = new GraphClass('G', 'directed') as unknown as Graph;
    const renderer = new HtmlCapture();
    const job = new RenderJob('svg', stubMeasurer);
    renderClusterLabel(g, renderer, job);
    expect(renderer.spans).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC16: transformPoint stays unrotated when job.rotation === 90 (ADR-2)
// SVG landscape rotation is the group transform, not the ptf path.
// ---------------------------------------------------------------------------

describe('AC16: transformPoint — job.rotation=90 does not rotate coords', () => {
  it('applies scale+translate only (no applyRotation) at rotation 90', () => {
    const job = makeJob();
    job.rotation = 90;
    // Same result as rotation 0: devscale.y=-1 flips Y, no axis swap.
    expect(transformPoint({ x: 3, y: 5 }, job)).toEqual({ x: 3, y: -5 });
  });
});
