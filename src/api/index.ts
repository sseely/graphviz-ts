// SPDX-License-Identifier: EPL-2.0

/**
 * `graphviz-ts/api` — the build + inspect + geometry entry point (ADR-2).
 *
 * Pure re-export barrel for the api layer: programmatic graph construction
 * (the builder), the safe edge helper, and the computed-geometry snapshot.
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
  YAxis,
  GeometryOptions,
} from './geometry.js';

// --- Safe edge construction (T2) ------------------------------------------
export { addEdge } from './edge-ops.js';

// --- Opaque graph handle type (ADR-1: type only, no class internals) ------
export type { Graph } from '../model/graph.js';
