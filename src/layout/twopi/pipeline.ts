// SPDX-License-Identifier: EPL-2.0

/**
 * Internal pipeline helpers for the twopi layout engine.
 * Isolated from index.ts so lizard can parse each function boundary cleanly.
 *
 * @see lib/twopigen/twopiinit.c:twopi_layout
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { PackInfo } from '../pack/index.js';
import {
  twopiCleanup,
  findRootNode,
  adjustNodes,
  finaliseCoords,
} from './init.js';
import { circleLayout } from './circle.js';
import { packSubgraphs, getPackInfo, PackMode } from '../pack/index.js';
import { splineEdgesShifted } from '../neato/splines.js';

/** Margin constant matching C CL_OFFSET. @see lib/pack/pack.h:CL_OFFSET */
export const CL_OFFSET = 8;

/** circleLayout return type; Node | null. */
export type Center = Node | null;

/** Add only edges whose both endpoints belong to sg. */
export function induceEdges(g: Graph, sg: Graph): void {
  sg.edges = g.edges.filter(
    e => sg.nodes.has(e.tail.name) && sg.nodes.has(e.head.name),
  );
}

/** Prefer globalRoot if it is in sg; otherwise scan for root attribute. */
export function resolveCenter(sg: Graph, globalRoot: Center): Center {
  if (globalRoot !== null && sg.nodes.has(globalRoot.name)) return globalRoot;
  return findRootNode(sg);
}

/** Lay out one component; return the chosen center node. */
export function layoutComponent(g: Graph, sg: Graph, globalRoot: Center): Center {
  induceEdges(g, sg);
  const lctr = resolveCenter(sg, globalRoot);
  const center = circleLayout(sg, lctr);
  adjustNodes(sg);
  return center;
}

/**
 * Build a PackInfo for multi-component packing.
 *
 * @see lib/twopigen/twopiinit.c:twopi_layout (getPackInfo call with l_node)
 */
export function buildPackInfo(g: Graph): PackInfo {
  const pinfo: PackInfo = {
    aspect: 1, sz: 0, margin: CL_OFFSET, doSplines: false,
    mode: PackMode.Node, fixed: null, vals: null, flags: 0,
  };
  // C: getPackInfo(g, l_node, CL_OFFSET) — polyomino node-mode packing.
  getPackInfo(g, PackMode.Node, CL_OFFSET, pinfo);
  pinfo.doSplines = false;
  return pinfo;
}

/** Single-component pipeline: layout → cleanup → splines → coords. */
export function layoutSingle(g: Graph, comps: Graph[], globalRoot: Center, setRoot: boolean): void {
  const sg = comps[0]!;
  const center = layoutComponent(g, sg, globalRoot);
  if (setRoot && globalRoot === null && center !== null) {
    g.attrs.set('root', center.name);
  }
  twopiCleanup(g); // ORDERING: before spline routing
  // C: spline_edges(g) — shifts pos to the origin, syncs coord, routes.
  splineEdgesShifted(g);
  finaliseCoords(g);
}

/**
 * Multi-component pipeline: per-component layout + coords, then cleanup,
 * pack, re-sync coords, splines.
 *
 * finaliseCoords per component runs BEFORE packSubgraphs so that
 * computeSubgraphBB reads real point-coords for bounding-box calculation.
 * After packing shifts pos (inches), finaliseCoords re-syncs coord.
 */
export function layoutMulti(g: Graph, comps: Graph[], globalRoot: Center, pinfo: PackInfo): void {
  for (const sg of comps) {
    layoutComponent(g, sg, globalRoot);
    finaliseCoords(sg);
  }
  twopiCleanup(g); // ORDERING: before spline routing
  packSubgraphs(comps.length, comps, g, pinfo);
  // C: spline_edges(g) — shifts pos to the origin, syncs coord, routes.
  splineEdgesShifted(g);
  finaliseCoords(g);
}
