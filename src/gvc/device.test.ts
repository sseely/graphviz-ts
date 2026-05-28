// SPDX-License-Identifier: EPL-2.0

/**
 * Acceptance tests for the device render loop and coordinate transform (T27).
 *
 * AC1: transformPoint applies devscale to Y when GVRENDER_Y_GOES_DOWN
 * AC2: transformPoint returns point unchanged when GVRENDER_DOES_TRANSFORM set
 * AC3: renderGraph calls beginGraph before node callbacks and endGraph after edge callbacks
 * AC4: renderGraph calls beginGraph and endGraph exactly once on an empty graph
 */

import { describe, it, expect } from 'vitest';
import { transformPoint, renderGraph } from './device.js';
import { RenderJob, GVRENDER_DOES_TRANSFORM } from './job.js';
import type { RendererPlugin } from './context.js';
import type { TextMeasurer } from '../common/textmeasure.js';
import type { Graph } from '../model/graph.js';
import { Graph as GraphClass } from '../model/graph.js';
import { Node } from '../model/node.js';
import { Edge } from '../model/edge.js';
import { makeNodeInfo } from '../model/nodeInfo.js';
import { makePort, makeEdgeInfo } from '../model/edgeInfo.js';

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
