// SPDX-License-Identifier: EPL-2.0

/**
 * Discriminated union of structured records emitted by the debug subsystem.
 * Add a new member here when a new diagnostic category is introduced.
 */
export type DebugRecord =
  | { kind: 'rank';   nodeId: string; rank: number }
  | { kind: 'rank-alias-start'; nodeId: string; rankValue: number }
  | { kind: 'rank-alias-end';   nodeId: string; xCoord: number; rankRestored: number }
  | { kind: 'spline'; edgeId: string; points: readonly [number, number][] }
  | { kind: 'coord-space'; phase: string; nodeId: string;
      x: number; y: number; unit: 'pt' | 'in' }
  | { kind: 'prng';   seed: number; value: number; index: number };

/**
 * Flags controlling diagnostic output. All fields are optional; omitting a
 * flag is equivalent to false. Pass via GvcContext constructor options.
 *
 * All flags are no-ops when undefined — guarded by `if (debug?.flag)` so
 * the JIT can eliminate dead branches. They do not affect algorithm output.
 */
export interface DebugOptions {
  /** Log rank assignments and ND_rank dual-use transitions (AD-8). */
  rankAssignment?: boolean;
  /** Log spline control points per edge after pathplan routing. */
  splineRouting?: boolean;
  /** Log every PS2INCH / INCH2PS coordinate conversion. */
  coordinateSpaces?: boolean;
  /** Log MT19937 seed and generated values (SGD / neato overlap removal). */
  prngState?: boolean;
  /**
   * Receive structured records as they are emitted.
   * Called synchronously; do not mutate the record.
   * If omitted, enabled flags write to console.debug.
   */
  emit?: (record: DebugRecord) => void;
}
