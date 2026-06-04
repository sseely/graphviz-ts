// SPDX-License-Identifier: EPL-2.0

/**
 * Shared types for the osage layout module.
 *
 * Kept in a separate file so lizard does not conflate interface field
 * names with function parameter counts in layout.ts.
 *
 * @see lib/osage/osageinit.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Box } from '../../model/geom.js';

/**
 * Parallel arrays describing the direct children of a cluster, built
 * before calling putRects.
 *
 * @see lib/osage/osageinit.c:layout (gs / children / vals lists)
 */
export interface ChildLists {
  /** Bounding boxes of all children (subclusters first, then loose nodes). */
  gs: Box[];
  /** Subcluster graphs, in the same index order as the first N entries of gs. */
  childGraphs: Graph[];
  /** Loose nodes, in the same index order as entries N+ of gs. */
  childNodes: Node[];
  /** Per-child sort values for l_array / PK_USER_VALS mode. */
  vals: number[];
}
