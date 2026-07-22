// SPDX-License-Identifier: EPL-2.0

/**
 * Guard tests for unported fdp surfaces.
 *
 * fdp overlap (removeOverlapAs): reachable from public API — fdpLayoutEngine
 *   with overlap="voronoi" parses as tries=0, rest="voronoi" and calls
 *   removeOverlapAs directly (no xLayout attempt).
 *
 * fdp processClusterEdges / setClustNodes (compound): reachable from the public
 *   API when an edge endpoint names a cluster (e.g. `c -- clusterX`). fdp
 *   replaces the endpoint with an invisible cluster node sized to the cluster
 *   and deletes the original node, so it draws no node for the cluster name.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/index.js';
import { fdpLayoutEngine } from './index.js';

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
// Guard 2: fdp processClusterEdges / setClustNodes (compound cluster edges).
//
// An edge whose endpoint names a cluster (`c -- clusterX`) is replaced by an
// invisible cluster node standing in for the cluster; the original visible
// node is deleted. Only fdp does this (dot/neato draw the node). Exercised
// through the public API. @see lib/common/utils.c:processClusterEdges
// ---------------------------------------------------------------------------

describe('fdp compound cluster edges (processClusterEdges)', () => {
  const COMPOUND = `graph G {
    n0
    subgraph clusterX { a -- b }
    n0 -- clusterX
  }`;

  it('deletes the original cluster-named node and adds an invisible proxy', () => {
    const g = parse(COMPOUND);
    expect(() => fdpLayoutEngine(g)).not.toThrow();
    // The original visible node "clusterX" is gone; an invisible cluster-node
    // proxy (ND_clustnode, name "__0:clusterX") stands in its place.
    expect(g.nodes.get('clusterX')).toBeUndefined();
    const proxies = [...g.nodes.values()].filter((n) => n.info.clustnode);
    expect(proxies).toHaveLength(1);
    const proxy = proxies[0]!;
    expect(proxy.name).toBe('__0:clusterX');
    expect(proxy.attrs.get('style')).toBe('invis');
    // setClustNodes gives it a positive size (the cluster's extent).
    expect(proxy.info.width).toBeGreaterThan(0);
    expect(proxy.info.height).toBeGreaterThan(0);
    // The real nodes still lay out.
    for (const name of ['n0', 'a', 'b']) {
      expect(g.nodes.get(name)?.info.pos).toBeDefined();
    }
  });

  it('is a no-op for graphs with no cluster-named edge endpoints', () => {
    const g = parse(FDP_SIMPLE);
    expect(() => fdpLayoutEngine(g)).not.toThrow();
    expect([...g.nodes.values()].some((n) => n.info.clustnode)).toBe(false);
  });
});
