// SPDX-License-Identifier: EPL-2.0

/**
 * Arrow type and modifier constants, name/type tables ported from
 * lib/common/arrows.c internal definitions.
 *
 * @see lib/common/arrows.c
 */

// ---------------------------------------------------------------------------
// Numeric constants
// ---------------------------------------------------------------------------

/** @see lib/common/arrows.c:#define EPSILON */
export const EPSILON = 0.0001;

/** Standard arrow length in points. @see lib/common/arrows.c:#define ARROW_LENGTH */
export const ARROW_LENGTH = 10.0;

/** Number of arrow heads per flag word. @see lib/common/arrows.c:#define NUMB_OF_ARROW_HEADS */
export const NUMB_OF_ARROW_HEADS = 4;

/** Bits per arrow slot in the flag word. @see lib/common/arrows.c:#define BITS_PER_ARROW */
export const BITS_PER_ARROW = 8;

/** Bits used for the arrow type portion. @see lib/common/arrows.c:#define BITS_PER_ARROW_TYPE */
export const BITS_PER_ARROW_TYPE = 4;

// ---------------------------------------------------------------------------
// Arrow type codes (low BITS_PER_ARROW_TYPE bits of each arrow slot)
// ---------------------------------------------------------------------------

/** @see lib/common/arrows.c:#define ARR_TYPE_NONE */
export const ARR_TYPE_NONE = 0;
/** @see lib/common/arrows.c:#define ARR_TYPE_NORM */
export const ARR_TYPE_NORM = 1;
/** @see lib/common/arrows.c:#define ARR_TYPE_CROW */
export const ARR_TYPE_CROW = 2;
/** @see lib/common/arrows.c:#define ARR_TYPE_TEE */
export const ARR_TYPE_TEE = 3;
/** @see lib/common/arrows.c:#define ARR_TYPE_BOX */
export const ARR_TYPE_BOX = 4;
/** @see lib/common/arrows.c:#define ARR_TYPE_DIAMOND */
export const ARR_TYPE_DIAMOND = 5;
/** @see lib/common/arrows.c:#define ARR_TYPE_DOT */
export const ARR_TYPE_DOT = 6;
/** @see lib/common/arrows.c:#define ARR_TYPE_CURVE */
export const ARR_TYPE_CURVE = 7;
/** @see lib/common/arrows.c:#define ARR_TYPE_GAP */
export const ARR_TYPE_GAP = 8;

// ---------------------------------------------------------------------------
// Per-type length factors (ratio of this arrow type's length to the standard
// ARROW_LENGTH). @see lib/common/arrows.c:Arrowtypes (lenfact column)
// ---------------------------------------------------------------------------

/** @see lib/common/arrows.c:Arrowtypes ARR_TYPE_NORM lenfact */
export const ARR_LENFACT_NORM = 1.0;
/** @see lib/common/arrows.c:Arrowtypes ARR_TYPE_CROW lenfact */
export const ARR_LENFACT_CROW = 1.0;
/** @see lib/common/arrows.c:Arrowtypes ARR_TYPE_TEE lenfact */
export const ARR_LENFACT_TEE = 0.5;
/** @see lib/common/arrows.c:Arrowtypes ARR_TYPE_BOX lenfact */
export const ARR_LENFACT_BOX = 1.0;
/** @see lib/common/arrows.c:Arrowtypes ARR_TYPE_DIAMOND lenfact */
export const ARR_LENFACT_DIAMOND = 1.2;
/** @see lib/common/arrows.c:Arrowtypes ARR_TYPE_DOT lenfact */
export const ARR_LENFACT_DOT = 0.8;
/** @see lib/common/arrows.c:Arrowtypes ARR_TYPE_CURVE lenfact */
export const ARR_LENFACT_CURVE = 1.0;
/** @see lib/common/arrows.c:Arrowtypes ARR_TYPE_GAP lenfact */
export const ARR_LENFACT_GAP = 0.5;

/**
 * Length factor indexed by ARR_TYPE_* code. ARR_TYPE_NONE (0) has no shape;
 * it maps to 0 so a none-arrow contributes no clip length.
 * @see lib/common/arrows.c:Arrowtypes
 */
export const ARR_LENFACT_BY_TYPE: readonly number[] = (() => {
  const t: number[] = [];
  t[ARR_TYPE_NONE] = 0;
  t[ARR_TYPE_NORM] = ARR_LENFACT_NORM;
  t[ARR_TYPE_CROW] = ARR_LENFACT_CROW;
  t[ARR_TYPE_TEE] = ARR_LENFACT_TEE;
  t[ARR_TYPE_BOX] = ARR_LENFACT_BOX;
  t[ARR_TYPE_DIAMOND] = ARR_LENFACT_DIAMOND;
  t[ARR_TYPE_DOT] = ARR_LENFACT_DOT;
  t[ARR_TYPE_CURVE] = ARR_LENFACT_CURVE;
  t[ARR_TYPE_GAP] = ARR_LENFACT_GAP;
  return t;
})();

/** Mask selecting the type-code portion (low BITS_PER_ARROW_TYPE bits). */
export const ARR_TYPE_MASK = (1 << BITS_PER_ARROW_TYPE) - 1;

// ---------------------------------------------------------------------------
// Arrow modifier flags (upper 4 bits of each arrow slot)
// ---------------------------------------------------------------------------

/** Open/outline only. @see lib/common/arrows.c:#define ARR_MOD_OPEN */
export const ARR_MOD_OPEN = 1 << (BITS_PER_ARROW_TYPE + 0);
/** Inverted direction. @see lib/common/arrows.c:#define ARR_MOD_INV */
export const ARR_MOD_INV = 1 << (BITS_PER_ARROW_TYPE + 1);
/** Left half only. @see lib/common/arrows.c:#define ARR_MOD_LEFT */
export const ARR_MOD_LEFT = 1 << (BITS_PER_ARROW_TYPE + 2);
/** Right half only. @see lib/common/arrows.c:#define ARR_MOD_RIGHT */
export const ARR_MOD_RIGHT = 1 << (BITS_PER_ARROW_TYPE + 3);

// ---------------------------------------------------------------------------
// Named tables (name → flag mapping)
// ---------------------------------------------------------------------------

/** One entry in an arrow name/flag table. @see lib/common/arrows.c:arrowname_t */
export interface ArrowNameEntry {
  readonly name: string;
  readonly type: number;
}

/**
 * Backward-compatibility synonyms for deprecated arrow names.
 * Evaluated before Arrownames so "invempty" resolves correctly.
 * @see lib/common/arrows.c:Arrowsynonyms
 */
export const ARROW_SYNONYMS: readonly ArrowNameEntry[] = [
  { name: 'invempty', type: ARR_TYPE_NORM | ARR_MOD_INV | ARR_MOD_OPEN },
];

/**
 * Modifier prefix tokens.
 * @see lib/common/arrows.c:Arrowmods
 */
export const ARROW_MODS: readonly ArrowNameEntry[] = [
  { name: 'o',    type: ARR_MOD_OPEN },
  { name: 'r',    type: ARR_MOD_RIGHT },
  { name: 'l',    type: ARR_MOD_LEFT },
  { name: 'e',    type: ARR_MOD_OPEN },   // deprecated alias for 'o'
  { name: 'half', type: ARR_MOD_LEFT },   // deprecated alias for 'l'
];

/**
 * Primary arrow shape names.
 * @see lib/common/arrows.c:Arrownames
 */
export const ARROW_NAMES_TABLE: readonly ArrowNameEntry[] = [
  { name: 'normal',  type: ARR_TYPE_NORM },
  { name: 'crow',    type: ARR_TYPE_CROW },
  { name: 'tee',     type: ARR_TYPE_TEE },
  { name: 'box',     type: ARR_TYPE_BOX },
  { name: 'diamond', type: ARR_TYPE_DIAMOND },
  { name: 'dot',     type: ARR_TYPE_DOT },
  { name: 'none',    type: ARR_TYPE_GAP },
  { name: 'inv',     type: ARR_TYPE_NORM | ARR_MOD_INV },
  { name: 'vee',     type: ARR_TYPE_CROW | ARR_MOD_INV },
  // kludge: "open" → "pen" (prefix "o" already consumed as ARR_MOD_OPEN)
  { name: 'pen',     type: ARR_TYPE_CROW | ARR_MOD_INV },
  // kludge: "empty" → "mpty" (prefix "e" already consumed as ARR_MOD_OPEN)
  { name: 'mpty',    type: ARR_TYPE_NORM },
  { name: 'curve',   type: ARR_TYPE_CURVE },
  { name: 'icurve',  type: ARR_TYPE_CURVE | ARR_MOD_INV },
];

/**
 * Direction strings and their corresponding start/end flag values.
 * @see lib/common/arrows.c:Arrowdirs
 */
export const ARROW_DIRS: readonly {
  dir: string;
  sflag: number;
  eflag: number;
}[] = [
  { dir: 'forward', sflag: ARR_TYPE_NONE, eflag: ARR_TYPE_NORM },
  { dir: 'back',    sflag: ARR_TYPE_NORM, eflag: ARR_TYPE_NONE },
  { dir: 'both',    sflag: ARR_TYPE_NORM, eflag: ARR_TYPE_NORM },
  { dir: 'none',    sflag: ARR_TYPE_NONE, eflag: ARR_TYPE_NONE },
];
