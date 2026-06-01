// SPDX-License-Identifier: EPL-2.0

/**
 * TypeScript port of Agedgeinfo_t from lib/common/types.h.
 *
 * All ED_* accessor macros in the C source expand to typed reads/writes into
 * this struct. In TypeScript the macro indirection is unnecessary — consumers
 * access fields directly on the EdgeInfo object attached to each Edge.
 *
 * @see lib/common/types.h:Agedgeinfo_t
 * @see lib/common/types.h:ED_* macros
 */

import type { Port, Spline } from './geom.js';
import type { Edge } from './edge.js';

/**
 * Edge layout and rendering info record; replaces the ED_* macro family.
 *
 * Required fields are always initialized when an edge is created (matching C
 * zero-init of the port struct in common_init_edge). All other fields are
 * optional; they are populated by specific phases of the layout pipeline.
 *
 * @see lib/common/types.h:Agedgeinfo_t
 * @see lib/common/utils.c:common_init_edge
 */
export interface EdgeInfo {
  /**
   * Tail-end port specification. Always initialized on edge creation.
   * @see lib/common/types.h:Agedgeinfo_t.tail_port
   * @see lib/common/types.h:ED_tail_port
   */
  tail_port: Port;

  /**
   * Head-end port specification. Always initialized on edge creation.
   * @see lib/common/types.h:Agedgeinfo_t.head_port
   * @see lib/common/types.h:ED_head_port
   */
  head_port: Port;

  /**
   * Rendered spline geometry. Undefined before the spline routing phase.
   * Set by clip_and_install() in lib/common/splines.c. Do not read before
   * the layout engine's spline pass has completed.
   *
   * @see lib/common/types.h:Agedgeinfo_t.spl
   * @see lib/common/types.h:ED_spl
   * @see lib/common/splines.c:clip_and_install
   */
  spl?: Spline;

  // -------------------------------------------------------------------------
  // Labels — typed in Batch 5b; left as unknown until TextLabel is ported.
  // -------------------------------------------------------------------------

  /**
   * Center edge label.
   * @see lib/common/types.h:Agedgeinfo_t.label
   * @see lib/common/types.h:ED_label
   */
  label?: unknown; // ED_label — textlabel_t* in C

  /**
   * Head-end label (arrowhead side).
   * @see lib/common/types.h:Agedgeinfo_t.head_label
   * @see lib/common/types.h:ED_head_label
   */
  head_label?: unknown; // ED_head_label — textlabel_t* in C

  /**
   * Tail-end label (arrowtail side).
   * @see lib/common/types.h:Agedgeinfo_t.tail_label
   * @see lib/common/types.h:ED_tail_label
   */
  tail_label?: unknown; // ED_tail_label — textlabel_t* in C

  /**
   * External label (placed outside the edge spline).
   * @see lib/common/types.h:Agedgeinfo_t.xlabel
   * @see lib/common/types.h:ED_xlabel
   */
  xlabel?: unknown; // ED_xlabel — textlabel_t* in C

  // -------------------------------------------------------------------------
  // Edge metadata
  // -------------------------------------------------------------------------

  /**
   * Whether this edge participates in rank constraints.
   * Corresponds to the `constraint` edge attribute (default: true).
   * When false, the edge does not constrain rank assignment.
   * @see lib/dotgen/class1.c:nonconstraint_edge
   */
  constraint?: boolean;

  /**
   * Edge type code: REGULAREDGE / FLATEDGE / SELFEDGE.
   * Stored as char in C; mapped to number here.
   * @see lib/common/types.h:Agedgeinfo_t.edge_type
   * @see lib/common/types.h:ED_edge_type
   */
  edge_type?: number;

  /**
   * True for compound edges (cross-cluster).
   * Stored as char in C.
   * @see lib/common/types.h:Agedgeinfo_t.compound
   * @see lib/common/types.h:ED_compound
   */
  compound?: number;

  /**
   * True for flat edges whose tail and head are adjacent in rank.
   * Stored as char in C.
   * @see lib/common/types.h:Agedgeinfo_t.adjacent
   * @see lib/common/types.h:ED_adjacent
   */
  adjacent?: number;

  /**
   * Whether the edge label is placed above (on top of) the spline.
   * Stored as char in C.
   * @see lib/common/types.h:Agedgeinfo_t.label_ontop
   * @see lib/common/types.h:ED_label_ontop
   */
  label_ontop?: number;

  /**
   * GUI state flags (bitwise OR of GUI_STATE_* constants).
   * Stored as unsigned char in C.
   * @see lib/common/types.h:Agedgeinfo_t.gui_state
   * @see lib/common/types.h:ED_gui_state
   * @see lib/common/types.h:GUI_STATE_ACTIVE / GUI_STATE_SELECTED / GUI_STATE_VISITED / GUI_STATE_DELETED
   */
  gui_state?: number;

  // -------------------------------------------------------------------------
  // Virtual edge back-pointers (dot layout)
  // -------------------------------------------------------------------------

  /**
   * Back-pointer to the original (non-virtual) edge; set on virtual edges
   * created during dot layout for long-range connections.
   * @see lib/common/types.h:Agedgeinfo_t.to_orig
   * @see lib/common/types.h:ED_to_orig
   * @see lib/common/shapes.c
   */
  to_orig?: Edge;

  /**
   * Back-pointer to the virtual edge that represents this edge in the
   * rank-spanning chain; set on real edges when a virtual chain exists.
   * @see lib/common/types.h:Agedgeinfo_t.to_virt
   * @see lib/common/types.h:ED_to_virt
   */
  to_virt?: Edge;

  // -------------------------------------------------------------------------
  // Engine scratch
  // -------------------------------------------------------------------------

  /**
   * Layout-engine algorithm scratch pointer. Engine-specific; not typed here.
   * @see lib/common/types.h:Agedgeinfo_t.alg
   * @see lib/common/types.h:ED_alg
   */
  alg?: unknown;

  // -------------------------------------------------------------------------
  // dot-specific fields (#ifndef NEATO_ONLY in C)
  // -------------------------------------------------------------------------

  /**
   * Edge weight for network simplex. Higher weight means the edge length is
   * penalized more, biasing ranks toward short edges.
   * int in C.
   * @see lib/common/types.h:Agedgeinfo_t.weight
   * @see lib/common/types.h:ED_weight
   */
  weight?: number;

  /**
   * Minimum rank separation required between tail and head nodes.
   * int in C.
   * @see lib/common/types.h:Agedgeinfo_t.minlen
   * @see lib/common/types.h:ED_minlen
   */
  minlen?: number;

  /**
   * Network-simplex cut value; used during feasible-tree construction.
   * @see lib/common/types.h:Agedgeinfo_t.cutvalue
   * @see lib/common/types.h:ED_cutvalue
   */
  cutvalue?: number;

  /**
   * Index into the network-simplex spanning tree edge list.
   * @see lib/common/types.h:Agedgeinfo_t.tree_index
   * @see lib/common/types.h:ED_tree_index
   */
  tree_index?: number;

  /**
   * Crossing penalty multiplier for this edge.
   * short in C.
   * @see lib/common/types.h:Agedgeinfo_t.xpenalty
   * @see lib/common/types.h:ED_xpenalty
   */
  xpenalty?: number;

  /**
   * Multiplicity count — number of parallel edges merged into this one
   * during concentration.
   * short in C.
   * @see lib/common/types.h:Agedgeinfo_t.count
   * @see lib/common/types.h:ED_count
   */
  count?: number;

  /**
   * Concentrated-opposite flag; set when merging parallel edges from
   * opposing directions.
   * @see lib/common/types.h:Agedgeinfo_t.conc_opp_flag
   * @see lib/common/types.h:ED_conc_opp_flag
   */
  conc_opp_flag?: boolean;

  /**
   * Debug: render intermediate routing boxes.
   * unsigned char in C.
   * @see lib/common/types.h:Agedgeinfo_t.showboxes
   * @see lib/common/types.h:ED_showboxes
   */
  showboxes?: number;

  // -------------------------------------------------------------------------
  // neato/fdp-specific fields (#ifndef DOT_ONLY in C)
  // -------------------------------------------------------------------------

  /**
   * Spring factor (ideal edge length multiplier) for spring-model layout.
   * double in C.
   * @see lib/common/types.h:Agedgeinfo_t.factor
   * @see lib/common/types.h:ED_factor
   */
  factor?: number;

  /**
   * Ideal edge length for neato/fdp stress-model layout.
   * double in C.
   * @see lib/common/types.h:Agedgeinfo_t.dist
   * @see lib/common/types.h:ED_dist
   */
  dist?: number;

  /**
   * Path used during spline routing (Ppolyline_t in C).
   * Typed in Batch 4 when pathplan types are ported.
   * @see lib/common/types.h:Agedgeinfo_t.path
   * @see lib/common/types.h:ED_path
   */
  path?: unknown; // ED_path — Ppolyline_t in C


  // -------------------------------------------------------------------------
  // samehead / sametail — group id for port merging (sameport.c)
  // -------------------------------------------------------------------------

  /**
   * Group id for samehead port merging. Edges sharing this value at the same
   * head node will be merged onto a single port by dot_sameports().
   * Corresponds to agxget(e, E_samehead) in the C source.
   * @see lib/dotgen/sameport.c:dot_sameports
   */
  samehead?: string;

  /**
   * Group id for sametail port merging. Edges sharing this value at the same
   * tail node will be merged onto a single port by dot_sameports().
   * Corresponds to agxget(e, E_sametail) in the C source.
   * @see lib/dotgen/sameport.c:dot_sameports
   */
  sametail?: string;

  // -------------------------------------------------------------------------
  // Compound edge cluster clipping (dot layout)
  // -------------------------------------------------------------------------

  /**
   * Name of the cluster subgraph to clip the head of this edge against.
   * When set, the spline endpoint at the head is clipped to the cluster's
   * bounding box by dot_compoundEdges(). Corresponds to agget(e, "lhead").
   * @see lib/dotgen/compound.c:makeCompoundEdge
   */
  lhead?: string;

  /**
   * Name of the cluster subgraph to clip the tail of this edge against.
   * When set, the spline start at the tail is clipped to the cluster's
   * bounding box by dot_compoundEdges(). Corresponds to agget(e, "ltail").
   * @see lib/dotgen/compound.c:makeCompoundEdge
   */
  ltail?: string;

  // -------------------------------------------------------------------------
  // dot layout tracking (TypeScript-only, no C equivalent field)
  // -------------------------------------------------------------------------

  /**
   * True if this edge was reversed by acyclic() during cycle-breaking.
   * Set by reverseEdge() in src/layout/dot/fastgr.ts. Used by dot_splines
   * to swap bezier control-point order back to tail→head orientation.
   *
   * There is no corresponding C field; C detects reversal via rank comparison
   * in swap_ends_p() (lib/dotgen/dotsplines.c). The TypeScript port adds this
   * field for explicit tracking.
   *
   * @see lib/dotgen/dotsplines.c:swap_ends_p
   */
  reversed?: boolean;
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/**
 * Returns a zero-initialized Port matching C's zero-init of the port struct
 * in common_init_edge.
 *
 * @see lib/common/types.h:struct port
 * @see lib/common/utils.c:common_init_edge
 */
export function makePort(): Port {
  return {
    p: { x: 0, y: 0 },
    theta: 0,
    bp: null,
    defined: false,
    constrained: false,
    clip: false,
    dyna: false,
    order: 0,
    side: 0,
    name: null,
  };
}

/**
 * Constructs a minimal EdgeInfo with required port fields initialized.
 *
 * Both ports are required — tail_port and head_port are always initialized
 * when an edge is created (never null in the C model).
 *
 * @see lib/common/types.h:Agedgeinfo_t
 * @see lib/common/utils.c:common_init_edge
 */
export function makeEdgeInfo(tailPort: Port, headPort: Port): EdgeInfo {
  return { tail_port: tailPort, head_port: headPort };
}
