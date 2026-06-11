// SPDX-License-Identifier: EPL-2.0

/**
 * Guard tests for unported fdp surfaces.
 *
 * fdp overlap (removeOverlapAs): reachable from public API — fdpLayoutEngine
 *   with overlap="voronoi" parses as tries=0, rest="voronoi" and calls
 *   removeOverlapAs directly (no xLayout attempt).
 *
 * fdp setClustNodes (compound): NOT reachable from public API — n.info.clustnode
 *   is only set in the dot engine's rank pass (dotgen/rank.ts), never by any
 *   path through fdpLayoutEngine.  Tested via direct call.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/index.js';
import { fdpLayoutEngine } from './index.js';
import { setClustNodes } from './layout.js';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';

/** Inline copy of test/golden/inputs/fdp-simple.dot */
const FDP_SIMPLE = `graph G {
  A -- B;
  A -- C;
  B -- D;
  C -- D;
  D -- E;
  E -- F;
  F -- A;
}`;

// ---------------------------------------------------------------------------
// Guard 1: fdp removeOverlapAs  (public API — via fdpLayoutEngine)
//
// Setting overlap="voronoi" produces tries=0, rest="voronoi" in
// parseOverlapTries.  With tries=0 the xLayout step is skipped entirely,
// so removeOverlapAs("voronoi") is reached immediately and throws.
// ---------------------------------------------------------------------------

describe('fdp removeOverlapAs guard', () => {
  it('throws when overlap="voronoi" is set on the graph', () => {
    const g = parse(FDP_SIMPLE);
    g.attrs.set('overlap', 'voronoi');
    expect(() => fdpLayoutEngine(g)).toThrow(
      'fdp: removeOverlapAs mode "voronoi" reached',
    );
  });

  it('throws when overlap="compress" is set on the graph', () => {
    // Another unported mode — same guard, different message token
    const g = parse(FDP_SIMPLE);
    g.attrs.set('overlap', 'compress');
    expect(() => fdpLayoutEngine(g)).toThrow(
      'fdp: removeOverlapAs mode "compress" reached',
    );
  });

  it('does not throw with default attrs (no overlap attribute)', () => {
    const g = parse(FDP_SIMPLE);
    expect(() => fdpLayoutEngine(g)).not.toThrow();
  });

  it('does not throw with overlap="true" (keep-overlaps no-op)', () => {
    const g = parse(FDP_SIMPLE);
    g.attrs.set('overlap', 'true');
    expect(() => fdpLayoutEngine(g)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Guard 2: fdp setClustNodes / compound  (direct-call test — not reachable
// via public API).
//
// n.info.clustnode is only set in the dot engine's rank.ts pass.  No path
// through fdpLayoutEngine or fdpInitGraph sets this flag, so there is no
// graph attribute or DOT source that triggers the guard from the public API.
// The guard exists as a safety net for the unported processClusterEdges path.
// ---------------------------------------------------------------------------

describe('fdp setClustNodes compound guard (direct call)', () => {
  it('throws when a node carries clustnode=true', () => {
    const g = new Graph('test', 'undirected');
    const n = new Node(0, 'n0', g);
    n.info.clustnode = true;
    g.nodes.set('n0', n);
    expect(() => setClustNodes(g)).toThrow(
      'fdp setClustNodes: cluster-endpoint edges (compound) are not ported',
    );
  });

  it('does not throw when no nodes carry clustnode=true', () => {
    const g = new Graph('test', 'undirected');
    const n = new Node(0, 'n0', g);
    // clustnode defaults to false (makeNodeInfo initialises it false)
    g.nodes.set('n0', n);
    expect(() => setClustNodes(g)).not.toThrow();
  });
});
