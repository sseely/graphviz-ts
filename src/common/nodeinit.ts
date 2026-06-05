// SPDX-License-Identifier: EPL-2.0
/**
 * Common node geometry initialisation shared by all layout engines.
 * Ports common_init_node / gv_nodesize from lib/common/utils.c.
 *
 * @see lib/common/utils.c:common_init_node
 * @see lib/common/utils.c:gv_nodesize
 */

import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';

/** Default node half-width in points. C: DEFAULT_NODEWIDTH=0.75in/2 * 72 = 27 */
export const DEFAULT_NODE_LW = 27;
/** Default node full-height in points. C: DEFAULT_NODEHEIGHT=0.5in * 72 = 36 */
export const DEFAULT_NODE_HT = 36;

/**
 * Initialise per-node geometry with defaults from common_init_node + gv_nodesize.
 * Sets lw, rw, ht if not already set. Reads width/height attrs to override.
 * @see lib/common/utils.c:common_init_node
 * @see lib/common/utils.c:gv_nodesize
 */
export function commonInitNode(n: Node, g: Graph): void {
  // Read width/height attrs (in inches), default to 0.75/0.5
  const widthAttr = n.attrs.get('width');
  const heightAttr = n.attrs.get('height');
  const widthIn = widthAttr !== undefined ? parseFloat(widthAttr) : 0.75;
  const heightIn = heightAttr !== undefined ? parseFloat(heightAttr) : 0.5;

  // Convert to points and compute half-widths (matching gv_nodesize)
  const flip = g.info.flip === true;
  if (!flip) {
    if (!n.info.lw) n.info.lw = Math.max((widthIn * 72) / 2, DEFAULT_NODE_LW);
    if (!n.info.rw) n.info.rw = Math.max((widthIn * 72) / 2, DEFAULT_NODE_LW);
    if (!n.info.ht) n.info.ht = Math.max(heightIn * 72, DEFAULT_NODE_HT);
  } else {
    // flip=true: width and height are swapped (rankdir=LR/RL)
    if (!n.info.lw) n.info.lw = Math.max((heightIn * 72) / 2, DEFAULT_NODE_LW);
    if (!n.info.rw) n.info.rw = Math.max((heightIn * 72) / 2, DEFAULT_NODE_LW);
    if (!n.info.ht) n.info.ht = Math.max(widthIn * 72, DEFAULT_NODE_HT);
  }
}

/** Call commonInitNode for every node in the graph. */
export function commonInitNodeEdge(g: Graph): void {
  for (const n of g.nodes.values()) commonInitNode(n, g);
}
