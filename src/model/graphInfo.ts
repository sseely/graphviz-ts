// SPDX-License-Identifier: EPL-2.0

/**
 * TypeScript port of Agraphinfo_t from lib/common/types.h.
 * All GD_* macros in the C source are replaced by typed fields on GraphInfo.
 *
 * Supporting types (LayoutParams, RatioKind, FontnameKind, RankEntry,
 * RankTable) live in layoutParams.ts and rankEntry.ts to keep file size
 * within limits.
 *
 * @see lib/common/types.h:Agraphinfo_t
 */

import type { Box, Point } from './geom.js';
import type { Node } from './node.js';
import type { Graph } from './graph.js';
import type { LayoutParams, FontnameKind } from './layoutParams.js';
import type { RankTable } from './rankEntry.js';

// Re-export supporting types so consumers can import from this module alone.
export type { RatioKind, LayoutParams } from './layoutParams.js';
// FontnameKind is both a const object (value) and a type — a plain export
// covers both; no separate `export type` needed for the same name.
export { FontnameKind } from './layoutParams.js';
export type { RankEntry, RankTable } from './rankEntry.js';

// ---------------------------------------------------------------------------
// Forward stub — replaced when src/gvc/context.ts is written in Batch 6.
// ---------------------------------------------------------------------------

/**
 * Forward stub for GVC_t. Replaced when src/gvc/context.ts is written
 * in Batch 6.
 *
 * @see lib/gvc/gvcext.h:GVC_t
 */
export type GVContext = unknown;

// ---------------------------------------------------------------------------
// Agraphinfo_t — @see lib/common/types.h:Agraphinfo_t
// ---------------------------------------------------------------------------

/**
 * Graph-level info record, equivalent to Agraphinfo_t in the C source.
 * All GD_* accessor macros in the C source become plain typed fields here.
 *
 * Required fields (non-pointer C fields always present after graph_init):
 * - bb, rankdir, flags, charset, gui_state, has_labels, has_images
 *
 * All C pointer fields become optional (`| undefined`) because they may
 * legitimately be null/unset until the relevant layout pass runs.
 *
 * @see lib/common/types.h:Agraphinfo_t
 */
export interface GraphInfo {
  // -----------------------------------------------------------------------
  // Core rendering fields — GD_* macros that are always meaningful
  // -----------------------------------------------------------------------

  /**
   * Bounding box of the graph after layout.
   * @see lib/common/types.h:GD_bb
   */
  bb: Box;

  /**
   * Rank direction + flip flags (raw int, encode via SET_RANKDIR macro).
   * GD_rankdir(g) = rankdir & 0x3; GD_realrankdir(g) = rankdir >> 2.
   * @see lib/common/types.h:GD_rankdir2
   */
  rankdir: number;

  /**
   * Edge type and layout engine flags bitmask.
   * @see lib/common/types.h:GD_flags
   */
  flags: number;

  /**
   * Input character set constant (CHAR_UTF8, CHAR_LATIN1, CHAR_BIG5).
   * @see lib/common/types.h:GD_charset
   */
  charset: number;

  /**
   * GUI state flags bitmask (GUI_STATE_ACTIVE, _SELECTED, _VISITED, _DELETED).
   * @see lib/common/types.h:GD_gui_state
   */
  gui_state: number;

  /**
   * Bitmask of which label types are present in the graph.
   * @see lib/common/types.h:GD_has_labels
   */
  has_labels: number;

  /**
   * True if any node uses an image.
   * @see lib/common/types.h:GD_has_images
   */
  has_images: boolean;

  // -----------------------------------------------------------------------
  // Optional pointer fields — all C pointers become `| undefined`
  // -----------------------------------------------------------------------

  /**
   * Resolved layout parameters (set by the layout engine init).
   * @see lib/common/types.h:GD_drawing
   */
  drawing?: LayoutParams;

  /**
   * Cluster or graph title label. Typed fully in Batch 5b (textlabel_t).
   * @see lib/common/types.h:GD_label
   */
  label?: unknown;

  /**
   * Margin sizes for graph labels; four Points corresponding to pointf[4].
   * Indices: [0]=left, [1]=right, [2]=top, [3]=bottom per C convention.
   * @see lib/common/types.h:GD_border
   */
  border?: [Point, Point, Point, Point];

  /**
   * GVC context for cross-graph globals.
   * @see lib/common/types.h:GD_gvc
   */
  gvc?: GVContext;

  /**
   * Layout-engine cleanup function; called by graph_cleanup to free
   * engine-specific data attached to this graph.
   * @see lib/common/types.h:GD_cleanup
   */
  cleanup?: (g: Graph) => void;

  /**
   * Height below extremal ranks (dot layout).
   * @see lib/common/types.h:GD_ht1
   */
  ht1?: number;

  /**
   * Height above extremal ranks (dot layout).
   * @see lib/common/types.h:GD_ht2
   */
  ht2?: number;

  /**
   * Engine-specific algorithm state.
   * @see lib/common/types.h:GD_alg
   */
  alg?: unknown;

  // -----------------------------------------------------------------------
  // neato/fdp/sfdp-specific fields (#ifndef DOT_ONLY in C)
  // -----------------------------------------------------------------------

  /**
   * Node list for neato layout.
   * @see lib/common/types.h:GD_neato_nlist
   */
  neato_nlist?: Node[];

  /**
   * Move count for iterative neato placement.
   * @see lib/common/types.h:GD_move
   */
  move?: number;

  /**
   * All-pairs distance matrix (neato).
   * @see lib/common/types.h:GD_dist
   */
  dist?: number[][];

  /**
   * Spring constant matrix (neato).
   * @see lib/common/types.h:GD_spring
   */
  spring?: number[][];

  /**
   * Spring force sum matrix (neato).
   * @see lib/common/types.h:GD_sum_t
   */
  sum_t?: number[][];

  /**
   * Position delta tensor (neato, ndim-dimensional).
   * @see lib/common/types.h:GD_t
   */
  t?: number[][][];

  /**
   * Number of layout dimensions.
   * @see lib/common/types.h:GD_ndim
   */
  ndim?: number;

  /**
   * Original number of layout dimensions.
   * @see lib/common/types.h:GD_odim
   */
  odim?: number;

  // -----------------------------------------------------------------------
  // dot-specific fields (#ifndef NEATO_ONLY in C)
  // -----------------------------------------------------------------------

  /**
   * Number of cluster subgraphs.
   * @see lib/common/types.h:GD_n_cluster
   */
  n_cluster?: number;

  /**
   * Cluster array.
   *
   * IMPORTANT: In C this is 1-indexed — clust[1..n_cluster]. This TypeScript
   * array is 0-indexed; callers must add 1 when converting between C indices
   * and this array's indices, or subtract 1 when coming from C.
   *
   * @see lib/common/types.h:GD_clust
   */
  clust?: Graph[];

  /**
   * The root graph for dot layout purposes.
   * @see lib/common/types.h:GD_dotroot
   */
  dotroot?: Graph;

  /**
   * Linked-list head of nodes for dot layout traversal.
   * @see lib/common/types.h:GD_nlist
   */
  nlist?: Node;

  /**
   * Rank table for dot layout (array indexed by rank level).
   * @see lib/common/types.h:GD_rank
   */
  rank?: RankTable;

  /**
   * Containing cluster (not parent subgraph).
   * @see lib/common/types.h:GD_parent
   */
  parent?: Graph;

  /**
   * Cluster nesting level (not node level).
   * @see lib/common/types.h:GD_level
   */
  level?: number;

  /**
   * Set leader for minimum rank.
   * @see lib/common/types.h:GD_minrep
   */
  minrep?: Node;

  /**
   * Set leader for maximum rank.
   * @see lib/common/types.h:GD_maxrep
   */
  maxrep?: Node;

  /**
   * Fast-graph node component list.
   * @see lib/common/types.h:GD_comp (nlist_t)
   */
  comp?: Node[];

  /**
   * Set leader for minimum connected component.
   * @see lib/common/types.h:GD_minset
   */
  minset?: Node;

  /**
   * Set leader for maximum connected component.
   * @see lib/common/types.h:GD_maxset
   */
  maxset?: Node;

  /**
   * Minimum rank value in this graph.
   * @see lib/common/types.h:GD_minrank
   */
  minrank?: number;

  /**
   * Maximum rank value in this graph.
   * @see lib/common/types.h:GD_maxrank
   */
  maxrank?: number;

  /**
   * True if the graph has any flat (same-rank) edges.
   * @see lib/common/types.h:GD_has_flat_edges
   */
  has_flat_edges?: boolean;

  /**
   * Show subdivision boxes for debugging; 0 means off.
   * @see lib/common/types.h:GD_showboxes
   */
  showboxes?: number;

  /**
   * SVG font name mangling setting.
   * @see lib/common/types.h:GD_fontnames
   */
  fontnames?: FontnameKind;

  /**
   * Node separation in points.
   * @see lib/common/types.h:GD_nodesep
   */
  nodesep?: number;

  /**
   * Rank separation in points.
   * @see lib/common/types.h:GD_ranksep
   */
  ranksep?: number;

  /**
   * Left-boundary node of the bounding box.
   * @see lib/common/types.h:GD_ln
   */
  ln?: Node;

  /**
   * Right-boundary node of the bounding box.
   * @see lib/common/types.h:GD_rn
   */
  rn?: Node;

  /**
   * Cluster leader node.
   * @see lib/common/types.h:GD_leader
   */
  leader?: Node;

  /**
   * Per-rank leader node array.
   * @see lib/common/types.h:GD_rankleader
   */
  rankleader?: Node[];

  /**
   * True if the cluster has been expanded.
   * @see lib/common/types.h:GD_expanded
   */
  expanded?: boolean;

  /**
   * Installation state flag.
   * @see lib/common/types.h:GD_installed
   */
  installed?: number;

  /**
   * Set type for union-find operations.
   * @see lib/common/types.h:GD_set_type
   */
  set_type?: number;

  /**
   * Label position flag for cluster labels.
   * @see lib/common/types.h:GD_label_pos
   */
  label_pos?: number;

  /**
   * Whether exact rank separation is enforced.
   * @see lib/common/types.h:GD_exact_ranksep
   */
  exact_ranksep?: boolean;
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Creates a zero-initialized GraphInfo with all required fields set to their
 * defaults. All optional fields are left undefined (absent from the object),
 * matching a freshly allocated Agraphinfo_t after graph_init().
 *
 * @see lib/common/utils.c:graph_init
 */
export function makeGraphInfo(): GraphInfo {
  return {
    bb: { ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } },
    rankdir: 0,
    flags: 0,
    charset: 0,
    gui_state: 0,
    has_labels: 0,
    has_images: false,
  };
}
