// SPDX-License-Identifier: EPL-2.0
/**
 * Translation-equivariance of routeSplines (the shared box-channel spline
 * fitter). A shortest-path funnel + bezier fit is translation-invariant, so a
 * faithful port MUST be translation-EQUIVARIANT: feeding routeSplines a box
 * channel and the same channel shifted by a constant must yield outputs that
 * differ only by that constant.
 *
 * The #241_0 non-adjacent flat edge `5:ne->8:nw` exposed a violation: its box
 * channel is geometrically symmetric about its mid-x, so the bezier fitter's
 * max-deviation split (routeSpline -> findMaxDev) hits an EXACT geometric tie
 * between the two interior points. C resolves the tie deterministically (strict
 * `>` keeps the first/tail), but the port's absolute-coordinate deviation eval
 * carries ~1e-14 catastrophic-cancellation noise whose sign depends on absolute
 * x, so the knot mirrors to the head side at this edge's actual frame.
 *
 * The fix (T2) makes the findMaxDev tie-break tolerant so a true tie always
 * resolves to the first index, matching C and restoring equivariance.
 *
 * Channel + ports below were captured from `routeSplines` during a native dot
 * render of tests/241_0.dot (see plans/nonadjacent-flat-5ne8nw/
 * findings-mirror-mechanism.md). C ground truth: knot lands TAIL-side
 * (internal x=405 in C frame = 432 in the port frame, which is +27).
 *
 * @see lib/common/routespl.c:routesplines
 * @see lib/pathplan/route.c:reallyroutespline (the max-deviation tie-break)
 */

import { describe, it, expect } from 'vitest';
import { makePort } from '../model/edgeInfo.js';
import type { Box } from '../model/geom.js';
import type { Path } from './types.js';
import { routeSplines } from './splines-routespl.js';

// The captured `5:ne->8:nw` channel (port frame). [ll.x, ll.y, ur.x, ur.y].
const CHANNEL: ReadonlyArray<readonly [number, number, number, number]> = [
  [351, 0, 423, 36], [351, 36, 432, 54], [351, 54, 639, 72],
  [558, 36, 639, 54], [567, 0, 639, 36],
];
const START = { x: 402.0169372558594, y: 34.016937255859375, theta: Math.PI / 4 };
const END = { x: 587.9830627441406, y: 34.016937255859375, theta: (3 * Math.PI) / 4 };

/** Build the captured channel as a Path, shifted by dx in x. */
function channelPath(dx: number): Path {
  const boxes: Box[] = CHANNEL.map(b => ({
    ll: { x: b[0] + dx, y: b[1] }, ur: { x: b[2] + dx, y: b[3] },
  }));
  const start = makePort();
  start.p = { x: START.x + dx, y: START.y };
  start.theta = START.theta;
  start.constrained = true;
  const end = makePort();
  end.p = { x: END.x + dx, y: END.y };
  end.theta = END.theta;
  end.constrained = true;
  return { start, end, nbox: boxes.length, boxes, data: null };
}

// Midpoint of the (symmetric) endpoints in the port frame.
const MID_X = (START.x + END.x) / 2; // ~495
const SHIFT = 27;

describe('routeSplines translation-equivariance (#241_0 5:ne->8:nw)', () => {
  // Green since T2: the tolerant findMaxDev tie-break restores equivariance.
  it('is translation-equivariant: routeSplines(channel+27) === routeSplines(channel)+27', () => {
    const psA = routeSplines(channelPath(0));
    const psB = routeSplines(channelPath(SHIFT));
    expect(psA).not.toBeNull();
    expect(psB).not.toBeNull();
    expect(psB!.length).toBe(psA!.length);
    for (let i = 0; i < psA!.length; i++) {
      expect(psB![i].x - SHIFT).toBeCloseTo(psA![i].x, 9);
      expect(psB![i].y).toBeCloseTo(psA![i].y, 9);
    }
  });

  it('places the two-bezier knot on the TAIL side (matching native dot)', () => {
    const ps = routeSplines(channelPath(0));
    expect(ps).not.toBeNull();
    // 7 control points = two cubic beziers; ps[3] is the join (knot).
    expect(ps!.length).toBe(7);
    // C frame knot x=405 (tail) -> port frame 432; bug value was 558 (head).
    expect(ps![3].x).toBeCloseTo(432, 3);
    expect(ps![3].x).toBeLessThan(MID_X);
  });
});
