// SPDX-License-Identifier: EPL-2.0

/**
 * twopi radial layout engine — public entry point.
 *
 * @see lib/twopigen/twopiinit.c:twopi_layout
 */

import type { Graph } from '../../model/graph.js';
import type { LayoutEngine } from '../../gvc/context.js';
import { twopiInitGraph, twopiCleanup } from './init.js';
import { ccomps } from '../pack/index.js';
import { layoutSingle, layoutMulti, buildPackInfo } from './pipeline.js';

export {
  twopiInitGraph,
  twopiCleanup,
  findRootNode,
  adjustNodes,
  finaliseCoords,
} from './init.js';
export { circleLayout, isLeaf, initLayout } from './circle.js';
export { THETA_UNSET } from '../../model/nodeInfo.js';

/**
 * Full twopi layout pipeline for a graph.
 *
 * @see lib/twopigen/twopiinit.c:twopi_layout
 */
export function twopiLayout(g: Graph): void {
  if (g.nodes.size === 0) return;
  twopiInitGraph(g);
  const rootAttr = g.attrs.get('root');
  const setRoot = rootAttr !== undefined;
  const globalRoot = setRoot && rootAttr !== ''
    ? (g.nodes.get(rootAttr!) ?? null)
    : null;
  const comps = ccomps(g, '_twopi');
  if (comps.length === 1) {
    layoutSingle(g, comps, globalRoot, setRoot);
  } else {
    layoutMulti(g, comps, globalRoot, buildPackInfo(g));
  }
}

/**
 * LayoutEngine descriptor for registration with GvcContext.
 *
 * @see lib/gvc/gvcext.h:gvlayout_engine_s
 * @see lib/twopigen/twopiinit.c (plugin wiring)
 */
export const TWOPI_LAYOUT_ENGINE: LayoutEngine = {
  type: 'twopi',
  layout: twopiLayout,
  cleanup: twopiCleanup,
};
