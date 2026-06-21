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
import { renderSvg } from '../index.js';
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

// ---------------------------------------------------------------------------
// AC-RC: style=rounded clusters draw a rounded bezier <path>, not a sharp
// <polygon> (mission rounded-clusters-mrecord, AC1/AC2/AC4). The bb here is
// ll=(10,10) ur=(90,70): rbconst=12, t=12/80 on the 80-wide bottom edge, so
// the path opens at B[1]=(22,10) → device M22,-10. @see emit.c:3877 round_corners
// ---------------------------------------------------------------------------

describe('AC-RC: rounded cluster boundary', () => {
  it('style=rounded → bezier <path> boundary (no sharp polygon), fill=none', () => {
    const svg = renderClusterSvg(makeGraphWithCluster({ style: 'rounded' }));
    expect(svg).toContain('<path');
    expect(svg).not.toContain('<polygon');
    expect(svg).toContain('d="M22,-10C');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="black"');
  });

  it('style="rounded,filled" fillcolor=grey95 → one filled rounded <path>', () => {
    const svg = renderClusterSvg(
      makeGraphWithCluster({ style: 'rounded,filled', fillcolor: 'grey95' }),
    );
    expect(svg).toContain('<path');
    expect(svg).not.toContain('<polygon');
    expect(svg).toContain('fill="#f2f2f2"'); // grey95
    expect(svg).toContain('stroke="black"');
  });

  it('plain cluster (no style) stays a sharp <polygon>, no <path>', () => {
    const svg = renderClusterSvg(makeGraphWithCluster({}));
    expect(svg).toContain('<polygon');
    expect(svg).not.toContain('<path');
  });
});

// A cluster with no style of its own inherits a graph-level graph[style=...]
// (agxget), matching the oracle: style=bold/dashed/rounded set on the root
// apply to the cluster boundary. @see lib/common/emit.c:emit_clusters
describe('cluster style inheritance from the graph', () => {
  it('graph style=bold → cluster boundary stroke-width="2"', () => {
    const svg = renderSvg('digraph{style=bold;subgraph cluster_0{a}}', 'dot');
    expect(svg).toContain('stroke-width="2"');
  });

  it('graph style=rounded → cluster boundary is a bezier <path>', () => {
    const svg = renderSvg('digraph{style=rounded;subgraph cluster_0{a}}', 'dot');
    expect(svg).toContain('<path');
  });

  it('graph style=dashed → cluster boundary stroke-dasharray="5,2"', () => {
    const svg = renderSvg('digraph{style=dashed;subgraph cluster_0{a}}', 'dot');
    expect(svg).toContain('stroke-dasharray="5,2"');
  });

  it('cluster overrides the inherited graph style', () => {
    const svg = renderSvg(
      'digraph{style=bold;subgraph cluster_0{style=dashed;a}}', 'dot');
    expect(svg).toContain('stroke-dasharray="5,2"');
  });
});

// Every cluster graph-attribute inherits from an ancestor (agxget), not just
// style: bgcolor/color/pencolor/fillcolor/penwidth set on the root reach the
// cluster boundary. Oracle-verified (dot 15.1.0). @see lib/common/emit.c
describe('cluster color/pen inheritance from the graph', () => {
  /** The cluster boundary polygon line (skips the stroke="none" page bg). */
  function clusterPoly(svg: string): string {
    return svg.split('\n').find(
      (l) => l.includes('<polygon') && !l.includes('stroke="none"')) ?? '';
  }

  it('graph bgcolor=blue → cluster fills blue (backward-compat bgcolor)', () => {
    const p = clusterPoly(renderSvg('digraph{bgcolor=blue;subgraph cluster_0{a}}', 'dot'));
    expect(p).toContain('fill="blue"');
  });

  it('graph color=red → cluster boundary stroke="red"', () => {
    const p = clusterPoly(renderSvg('digraph{color=red;subgraph cluster_0{a}}', 'dot'));
    expect(p).toContain('stroke="red"');
  });

  it('graph fillcolor + style=filled → cluster fills with the inherited color', () => {
    const p = clusterPoly(
      renderSvg('digraph{fillcolor=yellow;style=filled;subgraph cluster_0{a}}', 'dot'));
    expect(p).toContain('fill="yellow"');
  });

  it('graph penwidth=4 → cluster boundary stroke-width="4"', () => {
    const p = clusterPoly(renderSvg('digraph{penwidth=4;subgraph cluster_0{a}}', 'dot'));
    expect(p).toContain('stroke-width="4"');
  });
});
