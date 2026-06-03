// SPDX-License-Identifier: EPL-2.0

/**
 * Shared types for the pack module.
 *
 * @see lib/pack/pack.h
 */

/**
 * Granularity and method for packing.
 *
 * @see lib/pack/pack.h:pack_mode
 */
export const enum PackMode {
  Undef = 0,
  Cluster = 1,
  Node = 2,
  Graph = 3,
  Array = 4,
  Aspect = 5,
}

/** @see lib/pack/pack.h:PK_COL_MAJOR */
export const PK_COL_MAJOR = 1 << 0;
/** @see lib/pack/pack.h:PK_USER_VALS */
export const PK_USER_VALS = 1 << 1;
/** @see lib/pack/pack.h:PK_LEFT_ALIGN */
export const PK_LEFT_ALIGN = 1 << 2;
/** @see lib/pack/pack.h:PK_RIGHT_ALIGN */
export const PK_RIGHT_ALIGN = 1 << 3;
/** @see lib/pack/pack.h:PK_TOP_ALIGN */
export const PK_TOP_ALIGN = 1 << 4;
/** @see lib/pack/pack.h:PK_BOT_ALIGN */
export const PK_BOT_ALIGN = 1 << 5;
/** @see lib/pack/pack.h:PK_INPUT_ORDER */
export const PK_INPUT_ORDER = 1 << 6;

/**
 * Packing parameters.
 *
 * @see lib/pack/pack.h:pack_info
 */
export interface PackInfo {
  /** Desired aspect ratio. @see lib/pack/pack.h:pack_info.aspect */
  aspect: number;
  /** Row/column size. @see lib/pack/pack.h:pack_info.sz */
  sz: number;
  /** Margin around objects in points. @see lib/pack/pack.h:pack_info.margin */
  margin: number;
  /** Use splines when constructing graph shape. @see lib/pack/pack.h:pack_info.doSplines */
  doSplines: boolean;
  /** Granularity and method. @see lib/pack/pack.h:pack_info.mode */
  mode: PackMode;
  /** fixed[i] == true means graph i should not be moved. @see lib/pack/pack.h:pack_info.fixed */
  fixed: boolean[] | null;
  /** Sort values for array mode. @see lib/pack/pack.h:pack_info.vals */
  vals: number[] | null;
  /** Alignment/order flags. @see lib/pack/pack.h:pack_info.flags */
  flags: number;
}

/**
 * Conversion factor: points to inches.
 *
 * @see lib/common/geom.h:PS2INCH
 */
export const PS2INCH = 1 / 72;

/**
 * Convert points to inches.
 *
 * @see lib/common/geom.h:PS2INCH
 */
export function ps2inch(pts: number): number {
  return pts * PS2INCH;
}

/**
 * Convert inches to points.
 *
 * @see lib/common/geom.h:PS2INCH (inverse)
 */
export function inch2ps(inches: number): number {
  return inches / PS2INCH;
}
