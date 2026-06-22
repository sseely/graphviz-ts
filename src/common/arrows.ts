// SPDX-License-Identifier: EPL-2.0
/**
 * Arrow type definitions, compound arrow parsing, and rendering stubs.
 * Ported from lib/common/arrows.c and lib/common/arrows.h.
 *
 * @see lib/common/arrows.c
 * @see lib/common/arrows.h
 */

import type { Point } from '../model/geom.js';
import type { ResolvedArrow } from './arrows-types.js';
import {
  ARROW_NAMES_TABLE, ARROW_SYNONYMS, ARROW_MODS,
  ARR_MOD_OPEN, ARR_MOD_INV, ARR_MOD_LEFT, ARR_MOD_RIGHT,
  ARR_TYPE_NORM, ARR_TYPE_CROW, ARR_TYPE_TEE, ARR_TYPE_BOX,
  ARR_TYPE_DIAMOND, ARR_TYPE_DOT, ARR_TYPE_CURVE, ARR_TYPE_GAP,
  ARR_TYPE_MASK, ARR_LENFACT_BY_TYPE,
} from './arrows-constants.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** One component in a parsed compound arrow string. */
export interface ArrowComponent {
  name: string;   // user-visible base name (e.g. 'normal', 'dot', 'open')
  open: boolean;  // 'o' / 'e' modifier
  left: boolean;  // 'l' / 'half' modifier
  right: boolean; // 'r' modifier
}

/** Stub edge type; replaced by real EdgeInfo in T24+. */
export interface ArrowEdgeStub { attr?: Record<string, string> }

/** Stub port type; replaced by real Port in T24+. */
export interface ArrowPortStub { x: number; y: number }

/** Stub render job; replaced by real RenderJob in T24+. */
export interface ArrowJobStub {}

/** Bundled clip arguments — keeps arrowEndClip/arrowStartClip under 5 params. */
export interface ArrowClipArgs {
  e: ArrowEdgeStub;
  psflag: number;
  eflag: number;
  sp: ArrowPortStub;
  ep: ArrowPortStub;
}

// ---------------------------------------------------------------------------
// ARROW_NAMES — user-visible names from Arrownames[] + Arrowsynonyms[]
// Counts: 13 from Arrownames (kludge names resolved) + 1 synonym = 14 total.
// @see lib/common/arrows.c:Arrownames, Arrowsynonyms
// ---------------------------------------------------------------------------

/** All valid user-facing arrow type names from arrows.c. */
export const ARROW_NAMES: readonly string[] = [
  'normal', 'crow', 'tee', 'box', 'diamond', 'dot', 'none',
  'inv', 'vee', 'open', 'empty', 'curve', 'icurve', 'invempty',
];

// ---------------------------------------------------------------------------
// Parsing helpers (mirrors arrow_match_name_frag / arrow_match_name in C)
// ---------------------------------------------------------------------------

/** Try synonym table first. @see lib/common/arrows.c:Arrowsynonyms */
const matchSynonym = (s: string): { flag: number; rest: string } | null => {
  for (const syn of ARROW_SYNONYMS) {
    if (s.startsWith(syn.name)) return { flag: syn.type, rest: s.slice(syn.name.length) };
  }
  return null;
};

/** Greedily consume modifier prefixes. @see lib/common/arrows.c:Arrowmods */
const matchMods = (s: string): { flag: number; rest: string } => {
  let flag = 0; let rest = s; let matched = true;
  while (matched) {
    matched = false;
    for (const mod of ARROW_MODS) {
      if (rest.startsWith(mod.name)) {
        flag |= mod.type; rest = rest.slice(mod.name.length); matched = true; break;
      }
    }
  }
  return { flag, rest };
};

/** Match one base name from Arrownames[]. @see lib/common/arrows.c:Arrownames */
const matchBase = (s: string): { flag: number; baseName: string; rest: string } | null => {
  for (const entry of ARROW_NAMES_TABLE) {
    if (s.startsWith(entry.name))
      return { flag: entry.type, baseName: entry.name, rest: s.slice(entry.name.length) };
  }
  return null;
};

/** Resolve internal kludge names to user-visible names. */
const resolveBaseName = (n: string): string =>
  n === 'pen' ? 'open' : n === 'mpty' ? 'empty' : n;

/** Parse one arrow component from the front of s. */
const parseOne = (s: string): { comp: ArrowComponent; rest: string } | null => {
  const syn = matchSynonym(s);
  if (syn) {
    const f = syn.flag;
    return { comp: { name: 'invempty', open: !!(f & ARR_MOD_OPEN), left: !!(f & ARR_MOD_LEFT), right: !!(f & ARR_MOD_RIGHT) }, rest: syn.rest };
  }
  const { flag: mf, rest: mr } = matchMods(s);
  const base = matchBase(mr);
  if (!base) return null;
  const f = mf | base.flag;
  return { comp: { name: resolveBaseName(base.baseName), open: !!(f & ARR_MOD_OPEN), left: !!(f & ARR_MOD_LEFT), right: !!(f & ARR_MOD_RIGHT) }, rest: base.rest };
};

// ---------------------------------------------------------------------------
// parseArrow  (@see lib/common/arrows.c:arrow_type)
// ---------------------------------------------------------------------------

/**
 * Parse a compound arrow type string into its components.
 * E.g. "odot" → [{name:'dot', open:true, left:false, right:false}]
 *
 * @see lib/common/arrows.c:arrow_type
 */
export function parseArrow(str: string): ArrowComponent[] {
  const result: ArrowComponent[] = [];
  let s = str;
  while (s.length > 0) {
    const m = parseOne(s);
    if (!m) break;
    result.push(m.comp);
    s = m.rest;
  }
  if (result.length === 0) result.push({ name: 'normal', open: false, left: false, right: false });
  return result;
}

// ---------------------------------------------------------------------------
// resolveArrowType — parsed component → dispatch info
// @see lib/common/arrows.c:Arrownames, Arrowsynonyms, Arrowtypes
// ---------------------------------------------------------------------------

/**
 * User-visible base name → full type flag (type code + ARR_MOD_INV where the
 * name implies inversion). Mirrors Arrownames[]/Arrowsynonyms[], but keyed by
 * the resolved user-facing names produced by {@link parseArrow} (e.g. 'open',
 * 'empty', 'invempty') rather than the internal kludge fragments ('pen',
 * 'mpty'). Open/left/right modifiers are tracked on the component itself, so
 * only the type code and INV bit are encoded here.
 *
 * @see lib/common/arrows.c:Arrownames
 */
const NAME_TO_FLAG: ReadonlyMap<string, number> = new Map([
  ['normal', ARR_TYPE_NORM],
  ['crow', ARR_TYPE_CROW],
  ['tee', ARR_TYPE_TEE],
  ['box', ARR_TYPE_BOX],
  ['diamond', ARR_TYPE_DIAMOND],
  ['dot', ARR_TYPE_DOT],
  ['none', ARR_TYPE_GAP],
  ['inv', ARR_TYPE_NORM | ARR_MOD_INV],
  ['vee', ARR_TYPE_CROW | ARR_MOD_INV],
  ['open', ARR_TYPE_CROW | ARR_MOD_INV], // "pen" kludge: open == vee
  ['empty', ARR_TYPE_NORM],              // "mpty" kludge: empty == open normal
  ['curve', ARR_TYPE_CURVE],
  ['icurve', ARR_TYPE_CURVE | ARR_MOD_INV],
  ['invempty', ARR_TYPE_NORM | ARR_MOD_INV], // synonym (OPEN tracked on comp)
]);

/**
 * Resolve a parsed arrow component to its dispatch info: ARR_TYPE_* code (with
 * ARR_MOD_INV OR'd in for inv/vee/icurve), the open/side modifiers, and the
 * type's length factor. An unknown name resolves to ARR_TYPE_NORM, matching the
 * C default when no name fragment matches.
 *
 * @see lib/common/arrows.c:Arrowtypes (lenfact column)
 */
export function resolveArrowType(comp: ArrowComponent): ResolvedArrow {
  const flag = NAME_TO_FLAG.get(comp.name) ?? ARR_TYPE_NORM;
  const typeCode = flag & ARR_TYPE_MASK;
  const inv = (flag & ARR_MOD_INV) !== 0;
  return {
    type: typeCode | (inv ? ARR_MOD_INV : 0),
    open: comp.open,
    left: comp.left,
    right: comp.right,
    lenfact: ARR_LENFACT_BY_TYPE[typeCode] ?? ARR_LENFACT_BY_TYPE[ARR_TYPE_NORM],
  };
}

// ---------------------------------------------------------------------------
// Clip stubs (geometry implemented in T24 when RenderJob is available)
// ---------------------------------------------------------------------------

/**
 * Clip edge spline at arrowhead end and emit drawing calls.
 * Stub implementation; fully ported in T24.
 *
 * @see lib/common/arrows.c:arrowEndClip
 */
export function arrowEndClip(_args: ArrowClipArgs, _ps: Point[], _job: ArrowJobStub): void {}

/**
 * Clip edge spline at arrowtail start and emit drawing calls.
 * Stub implementation; fully ported in T24.
 *
 * @see lib/common/arrows.c:arrowStartClip
 */
export function arrowStartClip(_args: ArrowClipArgs, _ps: Point[], _job: ArrowJobStub): void {}
