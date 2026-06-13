// SPDX-License-Identifier: EPL-2.0

/**
 * Device-walk styling integration tests: obj-state lifecycle, node/cluster
 * gradient fills, and multi-color parallel edges. Split out of
 * device.test.ts to keep each test module under the 500-line cap
 * (hook-forced split; mission multicolor-paint).
 *
 * @see lib/common/emit.c:emit_begin_node / emit_clusters / emit_edge_graphics
 */

import { describe, it, expect } from 'vitest';
import { renderNode } from './device.js';
import { RenderJob } from './job.js';
import { createSvgRenderer } from '../render/svg.js';
import { renderSvg } from '../index.js';
import type { RendererPlugin } from './context.js';
import type { TextMeasurer } from '../common/textmeasure.js';
import { Graph as GraphClass } from '../model/graph.js';
import { Node } from '../model/node.js';
import { makeNodeInfo } from '../model/nodeInfo.js';

const stubMeasurer: TextMeasurer = { measure: () => ({ w: 0, h: 0 }) };

/** Build a 1-node directed graph whose shape codefn is `fn`. */
function nodeWithCodefn(fn: (job: RenderJob, n: Node) => void): Node {
  const g = new GraphClass('G', 'directed');
  const n = new Node(0, 'A', g);
  n.info = makeNodeInfo();
  (n.info.shape as { fns?: { codefn?: (job: RenderJob, n: Node) => void } }) = {
    fns: { codefn: fn },
  };
  return n;
}

// Class-based mock — avoids spread/cast patterns that confuse Lizard.
class RecordingRenderer implements RendererPlugin {
  readonly type = 'test';
  readonly quality = 0;
  beginGraph() {}
  endGraph() {}
  beginNode() {}
  endNode() {}
  beginEdge() {}
  endEdge() {}
  textspan() {}
  ellipse() {}
  polygon() {}
  bezier() {}
  polyline() {}
}

// ---------------------------------------------------------------------------
// AC13: renderNode pushes obj-state before codefn; stack balanced after
// @see lib/common/emit.c:emit_begin_node:1654 / emit_end_node:1794
// ---------------------------------------------------------------------------

describe('AC13: renderNode — obj-state push/pop lifecycle', () => {
  it('job.obj is non-null inside codefn and null after renderNode', () => {
    let objDuringCodefn: boolean | null = null;
    const n = nodeWithCodefn((job) => { objDuringCodefn = job.obj !== null; });
    const job = new RenderJob('svg', stubMeasurer);
    renderNode(n, new RecordingRenderer(), job, new Set<Node>());
    expect(objDuringCodefn).toBe(true);
    expect(job.obj).toBeNull();
  });

  it('job.obj is null after renderNode even if codefn throws', () => {
    const n = nodeWithCodefn(() => { throw new Error('test-error'); });
    const job = new RenderJob('svg', stubMeasurer);
    const run = () => renderNode(n, new RecordingRenderer(), job, new Set<Node>());
    expect(run).toThrow('test-error');
    expect(job.obj).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC14: unstyled node emits fill="none" stroke="black" via default obj-state
// ---------------------------------------------------------------------------

describe('AC14: unstyled node SVG fill/stroke from default obj-state', () => {
  it('emits fill="none" stroke="black" for a plain ellipse node', () => {
    const g = new GraphClass('G', 'directed');
    g.info.bb = { ll: { x: 0, y: 0 }, ur: { x: 100, y: 100 } };
    const n = new Node(0, 'A', g);
    n.info = makeNodeInfo();
    n.info.shape = {
      name: 'ellipse',
      fns: {
        codefn: (job: RenderJob) => {
          const r = job.renderer!;
          r.ellipse({ x: 0, y: 0 }, 20, 15, false, job);
        },
      },
    } as unknown as typeof n.info.shape;
    const svgRenderer = createSvgRenderer();
    const job = new RenderJob('svg', stubMeasurer);
    job.bb = { ll: { x: 0, y: 0 }, ur: { x: 100, y: 100 } };
    job.zoom = 1;
    job.devscale = { x: 1, y: -1 };
    job.translation = { x: 0, y: 0 };
    job.rotation = 0;
    job.renderer = svgRenderer;
    const done = new Set<Node>();
    renderNode(n, svgRenderer, job, done);
    const svg = job.output.join('');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="black"');
  });
});

// ---------------------------------------------------------------------------
// G3: cluster gradient fill — oracle-verified against dot -Tsvg (15.0.0)
// ---------------------------------------------------------------------------

describe('G3: cluster linear gradient — style=filled fillcolor="red:blue"', () => {
  it('emits <linearGradient id="clust1_l_0"> referenced by the polygon', () => {
    const svg = renderSvg(
      'digraph { subgraph cluster_0 { style=filled; fillcolor="red:blue"; a } }',
      'dot',
    );
    expect(svg).toContain('<linearGradient id="clust1_l_0"');
    expect(svg).toContain('fill="url(#clust1_l_0)"');
  });

  it('cluster solid fill unchanged (no gradient defs)', () => {
    const svg = renderSvg(
      'digraph { subgraph cluster_0 { style=filled; fillcolor=lightblue; a } }',
      'dot',
    );
    expect(svg).not.toContain('<linearGradient');
    expect(svg).toContain('fill="lightblue"');
  });
});

// ---------------------------------------------------------------------------
// M1: multi-color parallel-bezier edge — end-to-end integration
// (emitParallelEdgePaths is unit-tested in svg-multicolor-edge.test.ts)
// @see lib/common/emit.c:2442-2528 (else if numc branch)
// ---------------------------------------------------------------------------

describe('M1: multi-color edge — parallel beziers + head arrow first color', () => {
  it('color="red:blue" renders 2 paths, red before blue', () => {
    const svg = renderSvg('digraph{a->b[color="red:blue"]}', 'dot');
    const paths = svg.match(/<path fill="none"/g);
    expect((paths ?? []).length).toBeGreaterThanOrEqual(2);
    const redIdx = svg.indexOf('stroke="red"');
    const blueIdx = svg.indexOf('stroke="blue"');
    expect(redIdx).toBeGreaterThan(-1);
    expect(blueIdx).toBeGreaterThan(-1);
    expect(redIdx).toBeLessThan(blueIdx);
  });

  it('head arrow polygon is red (first color)', () => {
    const svg = renderSvg('digraph{a->b[color="red:blue"]}', 'dot');
    expect(svg).toContain('<polygon fill="red" stroke="red"');
  });

  it('three-color edge renders 3 parallel paths', () => {
    const svg = renderSvg('digraph{a->b[color="red:green:blue"]}', 'dot');
    const paths = svg.match(/<path fill="none"/g);
    expect((paths ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('single-color edge is byte-stable (no second color)', () => {
    const svg = renderSvg('digraph{a->b[color="red"]}', 'dot');
    const paths = svg.match(/<path fill="none"/g);
    expect((paths ?? []).length).toBe(1);
    expect(svg).toContain('stroke="red"');
    expect(svg).not.toContain('stroke="blue"');
  });
});
