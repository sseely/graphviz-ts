// SPDX-License-Identifier: EPL-2.0
/**
 * sfdp graph initialization.
 * @see lib/sfdpgen/sfdpinit.c
 */

import type { Graph } from '../../model/graph.js';
import type { SpringElectricalControl } from './spring-types.js';

/**
 * Read graph-level attributes and tune the control struct.
 * @see lib/sfdpgen/sfdpinit.c:sfdp_init_graph
 */
export function tuneControl(g: Graph, ctrl: SpringElectricalControl): void {
  if (g.info.nodesep !== undefined) ctrl.K = g.info.nodesep;
  const overlapAttr = g.attrs.get('overlap');
  if (overlapAttr !== undefined) {
    ctrl.overlap = overlapAttr === 'false' ? 0 : 1;
  }
}

/**
 * Initialize per-node layout data and tune control from graph attributes.
 * @see lib/sfdpgen/sfdpinit.c:sfdp_init_graph
 */
export function sfdpInitGraph(g: Graph, ctrl: SpringElectricalControl): void {
  tuneControl(g, ctrl);
  for (const n of g.nodes.values()) {
    if (n.info.pos === undefined) n.info.pos = [0, 0];
    n.info.width = n.info.width !== 0 ? n.info.width : 0.75;
    n.info.height = n.info.height !== 0 ? n.info.height : 0.5;
  }
}

/**
 * Release per-node sfdp layout data.
 * @see lib/sfdpgen/sfdpinit.c:sfdp_cleanup_graph
 */
export function sfdpCleanup(g: Graph): void {
  for (const n of g.nodes.values()) {
    n.info.pos = undefined;
  }
}
