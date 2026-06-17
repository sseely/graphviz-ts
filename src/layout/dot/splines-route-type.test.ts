// SPDX-License-Identifier: EPL-2.0

/**
 * Unit tests for routeRegularByType — the regular-edge type dispatch.
 *
 * routeSplines/routePolylines are mocked so the dispatch + LINE straighten
 * logic is exercised in isolation (the underlying box-corridor routing has its
 * own oracle tests). @see lib/dotgen/dotsplines.c:make_regular_edge
 */

import { it, expect, vi, beforeEach } from 'vitest';
import type { Point } from '../../model/geom.js';
import type { Path } from '../../common/types.js';

const routeSplines = vi.fn<[Path], Point[] | null>();
const routePolylines = vi.fn<[Path], Point[] | null>();

vi.mock('../../common/splines-routespl.js', () => ({
  routeSplines: (p: Path) => routeSplines(p),
  routePolylines: (p: Path) => routePolylines(p),
}));

const { routeRegularByType } = await import('./splines-route-type.js');
const { EDGETYPE_SPLINE, EDGETYPE_PLINE, EDGETYPE_LINE } = await import('./splines.js');

const P = {} as Path;
const pt = (x: number, y: number): Point => ({ x, y });

beforeEach(() => {
  routeSplines.mockReset();
  routePolylines.mockReset();
});

it('EDGETYPE_SPLINE delegates to routeSplines, never routePolylines', () => {
  const out = [pt(0, 0), pt(1, 1), pt(2, 2), pt(3, 3)];
  routeSplines.mockReturnValue(out);
  expect(routeRegularByType(P, EDGETYPE_SPLINE)).toBe(out);
  expect(routeSplines).toHaveBeenCalledTimes(1);
  expect(routePolylines).not.toHaveBeenCalled();
});

it('EDGETYPE_PLINE returns routePolylines output unchanged', () => {
  const out = [pt(0, 0), pt(1, 1), pt(2, 2), pt(3, 3), pt(4, 4), pt(5, 5), pt(6, 6)];
  routePolylines.mockReturnValue(out);
  expect(routeRegularByType(P, EDGETYPE_PLINE)).toBe(out);
  expect(routeSplines).not.toHaveBeenCalled();
});

it('EDGETYPE_LINE straightens a >4-point polyline to [p0,p0,pLast,pLast]', () => {
  const out = [pt(10, 20), pt(11, 21), pt(12, 22), pt(13, 23), pt(14, 24), pt(15, 25), pt(16, 26)];
  routePolylines.mockReturnValue(out);
  expect(routeRegularByType(P, EDGETYPE_LINE)).toEqual([
    pt(10, 20), pt(10, 20), pt(16, 26), pt(16, 26),
  ]);
});

it('EDGETYPE_LINE leaves a 4-point polyline unchanged (no straighten)', () => {
  const out = [pt(0, 0), pt(1, 1), pt(2, 2), pt(3, 3)];
  routePolylines.mockReturnValue(out);
  expect(routeRegularByType(P, EDGETYPE_LINE)).toBe(out);
});

it('propagates a null route (decline contract) for all types', () => {
  routeSplines.mockReturnValue(null);
  routePolylines.mockReturnValue(null);
  expect(routeRegularByType(P, EDGETYPE_SPLINE)).toBeNull();
  expect(routeRegularByType(P, EDGETYPE_PLINE)).toBeNull();
  expect(routeRegularByType(P, EDGETYPE_LINE)).toBeNull();
});
