// SPDX-License-Identifier: EPL-2.0
/**
 * Misc tests for lib/xdot: statXDot, freeXDot, freeXDotColor, constants.
 * Expected values derived from ~/git/graphviz/lib/xdot/xdot.c.
 * Do NOT change assertions to match code output; fix the code instead.
 */

import { describe, it, expect } from "vitest";
import {
  parseXDot,
  parseXDotColor,
  freeXDot,
  freeXDotColor,
  statXDot,
  XDOT_PARSE_ERROR,
} from "./index.js";
import type { Xdot, XdotStats } from "./index.js";

function makeStats(): XdotStats {
  return {
    cnt: 0, nEllipse: 0, nPolygon: 0, nPolygonPts: 0,
    nPolyline: 0, nPolylinePts: 0, nBezier: 0, nBezierPts: 0,
    nText: 0, nFont: 0, nStyle: 0, nColor: 0, nImage: 0,
    nGradcolor: 0, nFontchar: 0,
  };
}

// ---------------------------------------------------------------------------
// XDOT_PARSE_ERROR constant (C: #define XDOT_PARSE_ERROR 1)
// ---------------------------------------------------------------------------
describe("XDOT_PARSE_ERROR constant", () => {
  it("equals 0x1", () => {
    expect(XDOT_PARSE_ERROR).toBe(0x1);
  });
});

// ---------------------------------------------------------------------------
// statXDot (C: returns 0 on success, 1 on null args)
// ---------------------------------------------------------------------------
describe("statXDot — shape counts", () => {
  it("counts filled + unfilled ellipses together in nEllipse", () => {
    const x = parseXDot("E 1 2 3 4 e 5 6 7 8")!;
    const sp = makeStats();
    expect(statXDot(x, sp)).toBe(true);
    expect(sp.cnt).toBe(2);
    expect(sp.nEllipse).toBe(2);
  });

  it("counts polygon ops and accumulates nPolygonPts", () => {
    const sp = makeStats();
    statXDot(parseXDot("P 3 0 0 10 0 5 10")!, sp);
    expect(sp.nPolygon).toBe(1);
    expect(sp.nPolygonPts).toBe(3);
  });

  it("counts bezier ops and accumulates nBezierPts", () => {
    const sp = makeStats();
    statXDot(parseXDot("b 4 0 0 5 10 15 10 20 0")!, sp);
    expect(sp.nBezier).toBe(1);
    expect(sp.nBezierPts).toBe(4);
  });
});

describe("statXDot — color and misc counts", () => {
  it("solid fill+pen colors counted in nColor (not nGradcolor)", () => {
    const sp = makeStats();
    statXDot(parseXDot("C 3-red c 5-black")!, sp);
    expect(sp.nColor).toBe(2);
    expect(sp.nGradcolor).toBe(0);
  });

  it("gradient color counted in nGradcolor (not nColor)", () => {
    const sp = makeStats();
    statXDot(parseXDot("C 28-[0 0 1 1 2 0 3-red 1 4-blue]")!, sp);
    expect(sp.nGradcolor).toBe(1);
    expect(sp.nColor).toBe(0);
  });

  it("returns false when x is null (C returns 1)", () => {
    expect(statXDot(null as unknown as Xdot, makeStats())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// freeXDot / freeXDotColor — smoke tests
// ---------------------------------------------------------------------------
describe("freeXDot", () => {
  it("does not throw on valid xdot with multiple op types", () => {
    const x = parseXDot("E 10 20 5 3 P 3 0 0 10 0 5 10")!;
    expect(() => freeXDot(x)).not.toThrow();
  });

  it("is a no-op on null (C: if(!x) return)", () => {
    expect(() => freeXDot(null as unknown as Xdot)).not.toThrow();
  });
});

describe("freeXDotColor", () => {
  it("does not throw for solid color (nothing to free)", () => {
    const c = parseXDotColor("red")!;
    expect(() => freeXDotColor(c)).not.toThrow();
  });

  it("does not throw for linear gradient", () => {
    const c = parseXDotColor("[0 0 1 1 2 0 3-red 1 4-blue]")!;
    expect(() => freeXDotColor(c)).not.toThrow();
  });

  it("does not throw for radial gradient", () => {
    const c = parseXDotColor("(0 0 5 10 10 20 1 0 5-black)")!;
    expect(() => freeXDotColor(c)).not.toThrow();
  });
});
