// SPDX-License-Identifier: EPL-2.0

/**
 * `graphviz-ts/api` — the build + inspect + geometry entry point (ADR-2).
 *
 * Pure re-export barrel for the api layer: programmatic graph construction
 * (the builder), the safe edge helper, and the computed-geometry snapshot.
 *
 * Typical flow: call {@link createGraph} to build nodes/edges/subgraphs
 * without hand-writing DOT text, hand the builder's `.graph` (or a
 * `parse()` result) to `render()` from `graphviz-ts/render` (or the root
 * package) to lay out and emit an output format, then optionally call
 * {@link getLayout} here to read back computed node/edge/cluster geometry
 * from the laid-out graph.
 *
 * The internal mutable `Graph`/`Node`/`Edge` classes are NOT re-exported as
 * values (ADR-1); only the opaque `Graph` *type* is surfaced so consumers can
 * annotate variables holding a builder's `.graph` or a `parse()` result.
 */

// --- Programmatic construction (T4) ---------------------------------------
export { createGraph } from './builder.js';
export type {
  GvGraphBuilder,
  GvNode,
  GvEdge,
  CreateGraphOptions,
} from './builder.js';

// --- Computed-geometry snapshot (T3) --------------------------------------
export { getLayout } from './geometry.js';
export type {
  LayoutSnapshot,
  NodeGeometry,
  EdgeGeometry,
  BoundsGeometry,
  ClusterGeometry,
  YAxis,
  GeometryOptions,
} from './geometry.js';

// --- Safe edge construction (T2) ------------------------------------------
export { addEdge } from './edge-ops.js';

// --- Opaque graph handle type (ADR-1: type only, no class internals) ------
export type { Graph } from '../model/graph.js';
