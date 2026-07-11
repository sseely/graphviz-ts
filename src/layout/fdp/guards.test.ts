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
// Guard 1: fdp removeOverlapAs dispatch  (public API — via fdpLayoutEngine)
//
// Setting a bare mode (e.g. overlap="voronoi") produces tries=0 in
// parseOverlapTries, so xLayout is skipped and removeOverlapAs(mode) runs
// immediately. Ported modes render; genuinely-unported adjust algorithms
// (voronoi/oscale/vpsc/ortho/ipsep) still throw rather than silently leave
// overlaps. On the GTS reference build overlap="false" resolves to AM_PRISM.
// @see lib/neatogen/adjust.c:removeOverlapWith / getAdjustMode
// ---------------------------------------------------------------------------

describe('fdp removeOverlapAs dispatch', () => {
  it('throws when overlap="voronoi" is set (unported algorithm)', () => {
    const g = parse(FDP_SIMPLE);
    g.attrs.set('overlap', 'voronoi');
    expect(() => fdpLayoutEngine(g)).toThrow(
      'fdp: removeOverlapAs mode "voronoi" reached',
    );
  });

  for (const mode of ['false', 'scale', 'scalexy', 'compress']) {
    it(`renders (no throw) with overlap="${mode}"`, () => {
      const g = parse(FDP_SIMPLE);
      g.attrs.set('overlap', mode);
      expect(() => fdpLayoutEngine(g)).not.toThrow();
      for (const n of g.nodes.values()) expect(n.info.pos).toBeDefined();
    });
  }

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
