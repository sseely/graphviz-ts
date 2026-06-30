// SPDX-License-Identifier: EPL-2.0

/**
 * Byte-match tests for the faithful cnt>=2 non-adjacent flat multi-edge router.
 *
 * Oracle = native graphviz `dot` (version 15.1.0~dev.20260610.0127), captured
 * fresh during execution of mission nonadjacent-flat-multi (AD-5). The expected
 * `d=` path strings below are that oracle's edge splines verbatim. C nests the
 * splines via `(i+1)*Multisep/(cnt+1)`; the port previously routed each edge
 * independently at `nodesep/2`, so cnt>=2 edges overlapped identically.
 *
 * These tests drive `routeFlatEdgeGroupFaithful` directly (the T3 dispatch is a
 * separate task): lay out the graph, reset the port-bearing flat splines, route
 * the group, then render and compare. The SVG path coordinates are raw internal
 * coords (x, -y) — bb-independent — so a stale bb does not affect the numbers.
 *
 * @see lib/dotgen/dotsplines.c:make_flat_edge, make_flat_bottom_edges
 */

import { describe, it, expect } from 'vitest';
import type { Edge } from '../../model/edge.js';
import { parse } from '../../parser/index.js';
import { GvcContext } from '../../gvc/context.js';
import { createMeasurer } from '../../common/textmeasure-factory.js';
import { DOT_LAYOUT_ENGINE } from './index.js';
import { createSvgRenderer } from '../../render/svg.js';
import { render } from '../../gvc/device.js';
import {
  collectNonAdjacentFlatGroup, routeFlatEdgeGroupFaithful,
} from './splines-flat-multi.js';

const NODESEP = 'nodesep=0.25; {rank=same; a;b;c} a->b->c[style=invis];';
const SRC_TOP2 = `digraph { ${NODESEP} a:ne->c:nw; a:ne->c:nw; }`;
const SRC_TOP3 = `digraph { ${NODESEP} a:ne->c:nw; a:ne->c:nw; a:ne->c:nw; }`;
const SRC_BOT2 = `digraph { ${NODESEP} a:se->c:sw; a:se->c:sw; }`;
const SRC_TOP1 = `digraph { ${NODESEP} a:ne->c:nw; }`;

const TITLE_TOP = 'a:ne&#45;&gt;c:nw';
const TITLE_BOT = 'a:se&#45;&gt;c:sw';

/** Native-dot oracle splines (see file header). */
const ORACLE_TOP2 = [
  'M42.02,-34.02C51.57,-43.57 55.88,-44.8 69,-48 103.18,-56.33 123.81,-60.75 147.72,-41.49',
  'M42.02,-34.02C55.21,-47.21 57.37,-53.89 75,-60 95.16,-66.99 102.84,-66.99 123,-60 136.5,-55.32 140.93,-50.31 148.18,-42.3',
];
const ORACLE_TOP3 = [
  'M42.02,-34.02C50.74,-42.74 55.42,-42.51 67.5,-45 102.37,-52.19 123.39,-60.21 147.62,-41.45',
  'M42.02,-34.02C75.03,-67.03 113.59,-69.61 147.48,-41.76',
  'M42.02,-34.02C56.17,-48.17 57.69,-56.14 76.5,-63 95.29,-69.85 102.71,-69.85 121.5,-63 136.2,-57.64 140.34,-51.61 148.19,-42.47',
];
const ORACLE_BOT2 = [
  'M42.02,-2.69C45.78,1.08 49.76,0.53 54,-2.69 71.9,-16.3 50.87,-38.87 70,-50.69 91.93,-64.24 106.07,-64.24 128,-50.69 146.9,-39.01 124.67,-16.59 142,-2.69 142.91,-1.96 143.81,-1.35 144.71,-0.87',
  'M42.02,-2.69C45.78,1.08 49.76,0.53 54,-2.69 67.22,-12.74 58.04,-23.19 64,-38.69 68.28,-49.82 65.86,-56.42 76,-62.69 93.39,-73.44 104.61,-73.44 122,-62.69 132.14,-56.42 130.01,-49.93 134,-38.69 139.48,-23.24 129.21,-12.94 142,-2.69 142.91,-1.96 143.81,-1.35 144.71,-0.87',
];
const ORACLE_TOP1 = ['M42.02,-34.02C75.03,-67.03 113.59,-69.61 147.48,-41.76'];

/** Lay out the graph, reset the port-bearing flats, route the group, render. */
function renderGroupSplines(src: string, encTitle: string): string[] {
  const g = parse(src);
  const ctx = new GvcContext(createMeasurer());
  ctx.register(DOT_LAYOUT_ENGINE);
  ctx.register(createSvgRenderer());
  ctx.layout(g, 'dot');
  const flats = g.edges.filter((e: Edge) =>
    e.tail.info.rank === e.head.info.rank
    && (e.info.tail_port.defined || e.info.head_port.defined));
  flats.forEach((e: Edge) => { e.info.spl = undefined; });
  const group = collectNonAdjacentFlatGroup(flats[0], g);
  expect(routeFlatEdgeGroupFaithful(g, group, group.length)).toBe(true);
  return edgePaths(render(ctx, g, 'svg'), encTitle);
}

/** Extract the spline `d=` of every edge whose SVG title equals encTitle. */
function edgePaths(svg: string, encTitle: string): string[] {
  return svg.split('<g id="')
    .filter(b => b.includes(`<title>${encTitle}</title>`))
    .map(b => b.match(/ d="(M[^"]+)"/)?.[1] ?? '')
    .filter(Boolean);
}

describe('routeFlatEdgeGroupFaithful — cnt>=2 non-adjacent flats (conformant with native dot)', () => {
  it('top cnt=2: two DISTINCT nested splines conformant with the oracle', () => {
    const paths = renderGroupSplines(SRC_TOP2, TITLE_TOP);
    expect(paths).toEqual(ORACLE_TOP2);
    expect(paths[0]).not.toEqual(paths[1]); // not overlapping (the bug)
  });

  it('top cnt=3: three nested splines conformant with the oracle', () => {
    expect(renderGroupSplines(SRC_TOP3, TITLE_TOP)).toEqual(ORACLE_TOP3);
  });

  it('bottom cnt=2 (:se->:sw): both splines conformant with the oracle', () => {
    const paths = renderGroupSplines(SRC_BOT2, TITLE_BOT);
    expect(paths).toEqual(ORACLE_BOT2);
    expect(paths[0]).not.toEqual(paths[1]);
  });

  it('cnt=1 reduces to the single-route spline (AD-1, conformant)', () => {
    expect(renderGroupSplines(SRC_TOP1, TITLE_TOP)).toEqual(ORACLE_TOP1);
  });
});
