// SPDX-License-Identifier: EPL-2.0

/**
 * RankEntry and RankTable — one rank in a dot-layout ranked graph.
 * Ported from lib/common/types.h:rank_t.
 *
 * @see lib/common/types.h:rank_t
 */

import type { Node } from './node.js';

// ---------------------------------------------------------------------------
// rank_t — @see lib/common/types.h:rank_t
// ---------------------------------------------------------------------------

/**
 * One rank in a dot-layout ranked graph.
 *
 * @see lib/common/types.h:rank_t
 */
export interface RankEntry {
  /** Number of nodes in this rank. @see lib/common/types.h:rank_t.n */
  n: number;
  /** Ordered list of nodes in rank. @see lib/common/types.h:rank_t.v */
  v: Node[];
  /**
   * Globally allocated number of nodes.
   * @see lib/common/types.h:rank_t.an
   */
  an: number;
  /** Allocated list of nodes in rank. @see lib/common/types.h:rank_t.av */
  av: Node[];
  /** Height below centerline. @see lib/common/types.h:rank_t.ht1 */
  ht1: number;
  /** Height above centerline. @see lib/common/types.h:rank_t.ht2 */
  ht2: number;
  /**
   * Height below centerline (primitive nodes only).
   * @see lib/common/types.h:rank_t.pht1
   */
  pht1: number;
  /**
   * Height above centerline (primitive nodes only).
   * @see lib/common/types.h:rank_t.pht2
   */
  pht2: number;
  /** For transpose(). @see lib/common/types.h:rank_t.candidate */
  candidate: boolean;
  /** Whether rank is valid. @see lib/common/types.h:rank_t.valid */
  valid: boolean;
  /**
   * Cached crossing count.
   * C type is int64_t; JS number is safe up to 2^53.
   * @see lib/common/types.h:rank_t.cache_nc
   */
  cache_nc: number;
}

/**
 * Array of rank entries for a ranked (dot) graph layout.
 *
 * @see lib/common/types.h:rank_t
 */
export type RankTable = RankEntry[];
