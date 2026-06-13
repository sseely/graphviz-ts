// SPDX-License-Identifier: EPL-2.0
/**
 * Public re-exports for src/util.
 */
export { AgBuffer } from "./agxbuf.js";
export { List } from "./list.js";
export { gvXmlEscape } from "./xml.js";
export type { XmlFlags } from "./xml.js";
export {
  isExactlyZero,
  isExactlyEqual,
  fcmp,
  imax,
  imin,
  d2i,
  d2f,
  gvStrtod,
} from "./math.js";
export {
  rkNewState,
  rkSeed,
  rkRandom,
  rkInterval,
} from "./mt19937.js";
export type { RkState } from "./mt19937.js";
