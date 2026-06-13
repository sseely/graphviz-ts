// SPDX-License-Identifier: EPL-2.0

/**
 * Cluster fill render tests — acceptance tests for T5.
 *
 * Each test verifies that the SVG polygon for a cluster boundary has the
 * correct fill/stroke attrs, oracle-verified against dot 15.0.0 -Tsvg.
 *
 * AC-CF1: unfilled cluster → fill="none" stroke="black" (byte-gate)
 * AC-CF2: style=filled, no color → fill="lightgrey" stroke="black"
 * AC-CF3: style=filled, color=lightgrey → fill="lightgrey" stroke="lightgrey"
 * AC-CF4: bgcolor=lightpink (no style=filled) → fill="lightpink" stroke="black"
 * AC-CF5: penwidth=3, color=blue → stroke-width="3" stroke="blue"
 *
 * @see lib/common/emit.c:emit_clusters:3777
 */

import { describe, it, expect } from 'vitest';
import { Graph as GraphClass } from '../model/graph.js';
import { Node } from '../model/node.js';
import { makeNodeInfo } from '../model/nodeInfo.js';
import { RenderJob } from '../gvc/job.js';
import type { TextMeasurer } from '../common/textmeasure.js';
import { createSvgRenderer } from './svg.js';
import { renderClusters } from '../gvc/device.js';
import { createObjState, ObjType, EmitState } from '../gvc/job.js';

const stubMeasurer: TextMeasurer = { measure: () => ({ w: 0, h: 0 }) };

/** Build a job with the standard SVG devscale and a bounding box. */
function makeJob(): RenderJob {
  const job = new RenderJob('svg', stubMeasurer);
  job.zoom = 1;
  job.devscale = { x: 1, y: -1 };
  job.translation = { x: 0, y: 0 };
  job.rotation = 0;
  job.bb = { ll: { x: 0, y: 0 }, ur: { x: 200, y: 150 } };
  job.renderer = createSvgRenderer();
  return job;
}

/**
 * Build a root graph with one cluster subgraph.
 * The cluster has a fixed bounding box and the given attrs.
 */
function makeGraphWithCluster(clusterAttrs: Record<string, string>): GraphClass {
  const g = new GraphClass('G', 'directed');
  g.info.bb = { ll: { x: 0, y: 0 }, ur: { x: 200, y: 150 } };

  const n = new Node(0, 'a', g);
  n.info = makeNodeInfo();
  g.nodes.set('a', n);

  const sg = new GraphClass('cluster_0', 'undirected');
  sg.info.bb = { ll: { x: 10, y: 10 }, ur: { x: 90, y: 70 } };
  for (const [k, v] of Object.entries(clusterAttrs)) {
    sg.attrs.set(k, v);
  }
  g.info.clust = [sg];
  g.info.n_cluster = 1;
  return g;
}

/**
 * Render clusters of the given graph and return the full SVG output.
 * Pushes a root obj-state to mimic renderGraph's push before renderClusters.
 */
function renderClusterSvg(g: GraphClass): string {
  const job = makeJob();
  // Push a root graph obj-state (mirrors renderGraph) so job.obj is non-null.
  const rootObj = createObjState(ObjType.RootGraph);
  rootObj.emitState = EmitState.GDraw;
  job.pushObj(rootObj);
  renderClusters(g, createSvgRenderer(), job);
  job.popObj();
  return job.output.join('');
}

// ---------------------------------------------------------------------------
// AC-CF1: unfilled cluster → fill="none" stroke="black" (byte-gate)
// Oracle: dot 15.0.0: digraph{subgraph cluster_0{a}} → fill="none" stroke="black"
// ---------------------------------------------------------------------------

describe('AC-CF1: unfilled cluster byte-gate', () => {
  it('no cluster attrs → fill="none" stroke="black"', () => {
    const g = makeGraphWithCluster({});
    const svg = renderClusterSvg(g);
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="black"');
    expect(svg).not.toContain('fill="lightgrey"');
  });

  it('style=dashed → fill="none" stroke="black"', () => {
    const g = makeGraphWithCluster({ style: 'dashed' });
    const svg = renderClusterSvg(g);
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="black"');
  });
});

// ---------------------------------------------------------------------------
// AC-CF2: style=filled, no color → fill="lightgrey" stroke="black"
// Oracle: dot 15.0.0: subgraph cluster_0{style=filled;a}
// ---------------------------------------------------------------------------

describe('AC-CF2: style=filled default colors', () => {
  it('style=filled with no color attrs → fill="lightgrey" stroke="black"', () => {
    const g = makeGraphWithCluster({ style: 'filled' });
    const svg = renderClusterSvg(g);
    expect(svg).toContain('fill="lightgrey"');
    expect(svg).toContain('stroke="black"');
  });
});

// ---------------------------------------------------------------------------
// AC-CF3: style=filled, color=lightgrey → fill="lightgrey" stroke="lightgrey"
// Oracle: dot 15.0.0: subgraph cluster_0{style=filled;color=lightgrey;a}
// ---------------------------------------------------------------------------

describe('AC-CF3: color attr sets both fill and pen', () => {
  it('style=filled, color=lightgrey → fill and stroke both lightgrey', () => {
    const g = makeGraphWithCluster({ style: 'filled', color: 'lightgrey' });
    const svg = renderClusterSvg(g);
    expect(svg).toContain('fill="lightgrey"');
    expect(svg).toContain('stroke="lightgrey"');
  });
});

// ---------------------------------------------------------------------------
// AC-CF4: bgcolor=lightpink (no style=filled) → fill="lightpink" stroke="black"
// Oracle: dot 15.0.0: subgraph cluster_0{bgcolor=lightpink;a}
// ---------------------------------------------------------------------------

describe('AC-CF4: bgcolor backward-compat fills unfilled cluster', () => {
  it('bgcolor=lightpink with no style=filled → fill="lightpink" stroke="black"', () => {
    const g = makeGraphWithCluster({ bgcolor: 'lightpink' });
    const svg = renderClusterSvg(g);
    expect(svg).toContain('fill="lightpink"');
    expect(svg).toContain('stroke="black"');
  });
});

// ---------------------------------------------------------------------------
// AC-CF5: penwidth=3, color=blue → stroke-width="3" and stroke="blue"
// Oracle: dot 15.0.0: subgraph cluster_0{penwidth=3;color=blue;a}
// ---------------------------------------------------------------------------

describe('AC-CF5: penwidth and color independently', () => {
  it('penwidth=3, color=blue (unfilled) → stroke="blue" stroke-width="3"', () => {
    const g = makeGraphWithCluster({ penwidth: '3', color: 'blue' });
    const svg = renderClusterSvg(g);
    expect(svg).toContain('stroke="blue"');
    expect(svg).toContain('stroke-width="3"');
  });
});
