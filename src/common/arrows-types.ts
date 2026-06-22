// SPDX-License-Identifier: EPL-2.0

/**
 * Typed arrow draw-op union and the resolved-arrow descriptor.
 *
 * graphviz C emits arrowheads at render time as a sequence of primitive draw
 * calls (`gvrender_polygon` / `gvrender_ellipse` / `gvrender_polyline`). A
 * single `Point[]` cannot represent an `<ellipse>` (dot/odot) nor a compound
 * arrow that stacks several primitives, so this port models each emitted
 * primitive as a discriminated-union op (ADR-1).
 *
 * @see lib/common/arrows.c:arrow_gen / arrow_gencode (emit sequence)
 * @see plans/arrowhead-geometry/decisions.md ADR-1
 */

import type { Point } from '../model/geom.js';

/**
 * One primitive draw operation produced for an arrowhead. Geometry is in
 * graphviz (y-up) space; the SVG y-flip happens later in the renderer.
 */
export type ArrowDrawOp =
  | { readonly kind: 'polygon'; readonly points: Point[]; readonly filled: boolean }
  | {
      readonly kind: 'ellipse';
      readonly center: Point;
      readonly rx: number;
      readonly ry: number;
      readonly filled: boolean;
    }
  | { readonly kind: 'polyline'; readonly points: Point[] }
  // Cubic Bézier path (control points: 1 + 3n). Emitted by the `curve`/`icurve`
  // arrow types via gvrender_beziercurve. @see lib/common/arrows.c:arrow_type_curve
  | { readonly kind: 'bezier'; readonly points: Point[] };

/**
 * A single parsed arrow component resolved to its dispatch info: the
 * `ARR_TYPE_*` code (with `ARR_MOD_INV` OR'd in for inv/vee/icurve), the
 * open/side modifiers, and the type's length factor.
 *
 * `type` carries the type code in its low `BITS_PER_ARROW_TYPE` bits plus the
 * `ARR_MOD_INV` bit when the name implies inversion; `open`/`left`/`right`
 * mirror the user-supplied `o`/`l`/`r` prefix modifiers from the parsed
 * component.
 *
 * @see lib/common/arrows.c:Arrowtypes
 */
export interface ResolvedArrow {
  /** ARR_TYPE_* code, optionally OR'd with ARR_MOD_INV. */
  readonly type: number;
  /** Open/outline-only (`o`/`e` prefix, or `empty`/`invempty`). */
  readonly open: boolean;
  /** Left half only (`l`/`half` prefix). */
  readonly left: boolean;
  /** Right half only (`r` prefix). */
  readonly right: boolean;
  /** Ratio of this type's length to the standard ARROW_LENGTH. */
  readonly lenfact: number;
}
