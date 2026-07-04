// SPDX-License-Identifier: EPL-2.0

/**
 * Star shape vertices. C's star_gen fills 10 vertices alternating an outer
 * radius `r` (even indices) and an inner radius `r0` (odd indices); the port
 * previously rendered `shape=star` as a plain regular decagon.
 *
 * @see lib/common/shapes.c:star_vertices
 */

import { describe, it, expect } from 'vitest';
import { starVertices } from './poly-vertices.js';

describe('starVertices', () => {
  it('produces 10 vertices', () => {
    expect(starVertices(100, 100)).toHaveLength(10);
  });

  it('alternates an outer ring (even) fully outside the inner ring (odd)', () => {
    const v = starVertices(100, 100);
    const dist = (i: number): number => Math.hypot(v[i]!.x, v[i]!.y);
    const outer = [0, 2, 4, 6, 8].map(dist);
    const inner = [1, 3, 5, 7, 9].map(dist);
    // A star: the closest outer point is still farther than the farthest inner
    // point (a regular decagon would have all ten equidistant).
    expect(Math.min(...outer)).toBeGreaterThan(Math.max(...inner));
  });
});
