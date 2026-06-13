// SPDX-License-Identifier: EPL-2.0
/**
 * Shared type definitions for lib/cdt.
 * Kept in a leaf module to avoid circular imports.
 *
 * @see lib/cdt/cdt.h
 */

/** Key comparator: returns negative, zero, or positive. @see Dtcompar_f */
export type Comparator<K> = (a: K, b: K) => number;

/** Extract the key from an object. @see Dtdisc_t */
export type KeyOf<T, K> = (obj: T) => K;
