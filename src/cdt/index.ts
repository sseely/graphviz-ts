// SPDX-License-Identifier: EPL-2.0
/**
 * lib/cdt — Container Data Types public API.
 *
 * Exports DtSplay (DT_OSET), DtHash (DT_SET), and dtStrHash.
 *
 * @see lib/cdt/cdt.h
 * @see lib/cdt/dttree.c
 * @see lib/cdt/dthash.c
 * @see lib/cdt/dtstrhash.c
 */

export type { Comparator, KeyOf } from "./types.js";
export { DtSplay } from "./splay.js";
export { DtBag }   from "./bag.js";
export { DtHash }  from "./hash.js";
export { dtStrHash } from "./strhash.js";
