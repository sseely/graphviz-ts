// SPDX-License-Identifier: EPL-2.0

/**
 * Shared test helpers for pack module tests.
 * Isolated in their own file so Lizard counts each function independently.
 */

import { expect } from 'vitest';
import type { Box, Point } from '../../model/geom.js';
import { type PackInfo, PackMode } from './types.js';

export function box(llx: number, lly: number, urx: number, ury: number): Box {
  return { ll: { x: llx, y: lly }, ur: { x: urx, y: ury } };
}

export function defaultPackInfo(overrides?: Partial<PackInfo>): PackInfo {
  return {
    aspect: 1, sz: 0, margin: 0, doSplines: false,
    mode: PackMode.Graph, fixed: null, vals: null, flags: 0,
    ...overrides,
  };
}

export function applyPlaces(bbs: Box[], places: Point[]): Box[] {
  return bbs.map((bb, i) => {
    const p = places[i] ?? { x: 0, y: 0 };
    return box(bb.ll.x + p.x, bb.ll.y + p.y, bb.ur.x + p.x, bb.ur.y + p.y);
  });
}

function overlaps(a: Box, b: Box): boolean {
  return a.ur.x > b.ll.x && b.ur.x > a.ll.x &&
    a.ur.y > b.ll.y && b.ur.y > a.ll.y;
}

export function assertNoOverlap(placed: Box[]): void {
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i];
      const b = placed[j];
      if (a !== undefined && b !== undefined) {
        expect(overlaps(a, b), `boxes ${i} and ${j} overlap`).toBe(false);
      }
    }
  }
}
