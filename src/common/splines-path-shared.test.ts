// SPDX-License-Identifier: EPL-2.0

/**
 * resolvePort: a dynamic (`_`) port resolves to the exposed side whose face is
 * nearest the other endpoint, then re-runs compassPort. Verified against C
 * graphviz 15.0.0 (lib/common/shapes.c:closestSide:4248, resolvePort:4322).
 *
 * @see lib/common/splines.c:resolvePort
 */

import { describe, it, expect } from 'vitest';
import { resolvePort } from './splines-path-shared.js';
import { makePort } from '../model/edgeInfo.js';
import { makeNodeInfo } from '../model/nodeInfo.js';
import { TOP, BOTTOM, LEFT, RIGHT } from './splines-constants.js';

/** A 54×36 node at (x,y), rankdir=TB. */
function node(x: number, y: number) {
  const info = Object.assign(makeNodeInfo(), {
    coord: { x, y }, lw: 27, rw: 27, ht: 36,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { info, root: { info: { rankdir: 0 } } } as any;
}

function dynaPort(side: number) {
  const p = makePort();
  p.dyna = true; p.side = side; p.bp = null;
  return p;
}

describe('resolvePort — dynamic ports', () => {
  it('picks the TOP face when the other endpoint is above', () => {
    const rv = resolvePort(node(0, 0), node(0, 100), dynaPort(TOP | BOTTOM));
    expect(rv.p).toEqual({ x: 0, y: 18 });
    expect(rv.side & TOP).toBe(TOP);
  });

  it('picks the BOTTOM face when the other endpoint is below', () => {
    const rv = resolvePort(node(0, 0), node(0, -100), dynaPort(TOP | BOTTOM));
    expect(rv.p).toEqual({ x: 0, y: -18 });
    expect(rv.side & BOTTOM).toBe(BOTTOM);
  });

  it('all sides exposed → center (null compass): port not pinned to a face', () => {
    const rv = resolvePort(node(0, 0), node(0, 100), dynaPort(TOP | BOTTOM | LEFT | RIGHT));
    expect(rv.defined).toBe(false);
  });
});

describe('resolvePort — non-dynamic passthrough', () => {
  it('returns a non-dyna port unchanged (same reference)', () => {
    const p = makePort();
    expect(resolvePort(node(0, 0), node(0, 100), p)).toBe(p);
  });
});
