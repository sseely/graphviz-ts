// SPDX-License-Identifier: EPL-2.0
/**
 * Parsing tests for lib/xdot.
 * Expected values derived from ~/git/graphviz/lib/xdot/xdot.c.
 * Do NOT change assertions to match code output; fix the code instead.
 */

import { describe, it, expect } from "vitest";
import {
  parseXDot,
  parseXDotF,
  parseXDotFOn,
  parseXDotColor,
  XDOT_PARSE_ERROR,
} from "./index.js";
import type { Xdot, OpFunctions } from "./index.js";

// ---------------------------------------------------------------------------
// Acceptance criterion 1:
// parseXDot('e 100 200 50 30') → single unfilled_ellipse op
// y=200 in PS coords (NOT flipped)
// ---------------------------------------------------------------------------
describe("AC1: unfilled_ellipse parse", () => {
  it("'e 100 200 50 30' → unfilled_ellipse, y=200 (PS coords, not flipped)", () => {
    const x = parseXDot("e 100 200 50 30");
    expect(x).not.toBeNull();
    expect(x!.ops).toHaveLength(1);
    const op = x!.ops[0];
    expect(op.kind).toBe("unfilled_ellipse");
    if (op.kind !== "unfilled_ellipse") throw new Error("wrong kind");
    expect(op.ellipse.x).toBe(100);
    expect(op.ellipse.y).toBe(200);
    expect(op.ellipse.w).toBe(50);
    expect(op.ellipse.h).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 2 — coordinate field presence
// Split into shape-type groups to keep each describe block small.
// ---------------------------------------------------------------------------
describe("AC2: coord fields — ellipse and polyline", () => {
  it("XdotRect (ellipse) exposes x,y,w,h as numbers", () => {
    const op = parseXDot("E 10 20 5 3")!.ops[0];
    if (op.kind !== "filled_ellipse") throw new Error("wrong kind");
    expect(typeof op.ellipse.x).toBe("number");
    expect(typeof op.ellipse.y).toBe("number");
    expect(typeof op.ellipse.w).toBe("number");
    expect(typeof op.ellipse.h).toBe("number");
  });

  it("XdotPolyline pts expose x,y,z as numbers", () => {
    const op = parseXDot("L 2 0 0 10 20")!.ops[0];
    if (op.kind !== "polyline") throw new Error("wrong kind");
    const pt = op.polyline.pts[0];
    expect(typeof pt.x).toBe("number");
    expect(typeof pt.y).toBe("number");
    expect(typeof pt.z).toBe("number");
  });

  it("XdotText exposes x,y,width as numbers", () => {
    const op = parseXDot("T 10 20 0 50 5-hello")!.ops[0];
    if (op.kind !== "text") throw new Error("wrong kind");
    expect(typeof op.text.x).toBe("number");
    expect(typeof op.text.y).toBe("number");
    expect(typeof op.text.width).toBe("number");
  });
});

describe("AC2: coord fields — gradients", () => {
  it("XdotLinearGrad exposes x0,y0,x1,y1 as numbers", () => {
    const op = parseXDot("C 28-[0 0 1 1 2 0 3-red 1 4-blue]")!.ops[0];
    if (op.kind !== "grad_fill_color") throw new Error("wrong kind");
    if (op.gradColor.type !== "linear") throw new Error("wrong grad type");
    expect(typeof op.gradColor.ling.x0).toBe("number");
    expect(typeof op.gradColor.ling.y0).toBe("number");
    expect(typeof op.gradColor.ling.x1).toBe("number");
    expect(typeof op.gradColor.ling.y1).toBe("number");
  });

  it("XdotRadialGrad exposes x0,y0,r0,x1,y1,r1 as numbers", () => {
    // "(0 0 5 10 10 20 1 0 5-black)" = 28 chars
    const op = parseXDot("c 28-(0 0 5 10 10 20 1 0 5-black)")!.ops[0];
    if (op.kind !== "grad_pen_color") throw new Error("wrong kind");
    if (op.gradColor.type !== "radial") throw new Error("wrong grad type");
    expect(typeof op.gradColor.ring.x0).toBe("number");
    expect(typeof op.gradColor.ring.y0).toBe("number");
    expect(typeof op.gradColor.ring.r0).toBe("number");
    expect(typeof op.gradColor.ring.x1).toBe("number");
    expect(typeof op.gradColor.ring.y1).toBe("number");
    expect(typeof op.gradColor.ring.r1).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 4 — gradient promotion
// ---------------------------------------------------------------------------
describe("AC4: gradient promotion", () => {
  it("C + '[...' → grad_fill_color (not fill_color)", () => {
    // "[0 0 1 1 2 0 3-red 1 4-blue]" = 28 chars (C-derived)
    expect(parseXDot("C 28-[0 0 1 1 2 0 3-red 1 4-blue]")!.ops[0].kind)
      .toBe("grad_fill_color");
  });

  it("c + '[...' → grad_pen_color", () => {
    expect(parseXDot("c 28-[0 0 1 1 2 0 3-red 1 4-blue]")!.ops[0].kind)
      .toBe("grad_pen_color");
  });

  it("c + '(...' → grad_pen_color", () => {
    expect(parseXDot("c 28-(0 0 5 10 10 20 1 0 5-black)")!.ops[0].kind)
      .toBe("grad_pen_color");
  });

  it("C + solid color → fill_color (no promotion)", () => {
    expect(parseXDot("C 3-red")!.ops[0].kind).toBe("fill_color");
  });
});

// ---------------------------------------------------------------------------
// parseXDot — primitives
// ---------------------------------------------------------------------------
describe("parseXDot — ellipse and polygon", () => {
  it("empty string → null (cnt=0)", () => {
    expect(parseXDot("")).toBeNull();
  });

  it("E parses float coordinates", () => {
    const op = parseXDot("E 10.5 20.75 5 3")!.ops[0];
    if (op.kind !== "filled_ellipse") throw new Error("wrong kind");
    expect(op.ellipse.x).toBeCloseTo(10.5);
    expect(op.ellipse.y).toBeCloseTo(20.75);
  });

  it("P parses polygon points; z=0", () => {
    const op = parseXDot("P 3 0 0 10 0 5 10")!.ops[0];
    if (op.kind !== "filled_polygon") throw new Error("wrong kind");
    expect(op.polygon.pts).toHaveLength(3);
    expect(op.polygon.pts[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(op.polygon.pts[2]).toEqual({ x: 5, y: 10, z: 0 });
  });
});

describe("parseXDot — bezier and multi-op", () => {
  it("b = filled_bezier, B = unfilled_bezier (reversed convention)", () => {
    expect(parseXDot("b 4 0 0 5 10 15 10 20 0")!.ops[0].kind).toBe("filled_bezier");
    expect(parseXDot("B 4 0 0 5 10 15 10 20 0")!.ops[0].kind).toBe("unfilled_bezier");
  });

  it("multiple ops in one string", () => {
    const x = parseXDot("E 10 20 5 3 e 30 40 7 2");
    expect(x!.ops).toHaveLength(2);
    expect(x!.ops[0].kind).toBe("filled_ellipse");
    expect(x!.ops[1].kind).toBe("unfilled_ellipse");
  });
});

// ---------------------------------------------------------------------------
// parseXDot — text, color, font, style, image, fontchar
// ---------------------------------------------------------------------------
describe("parseXDot — text and color ops", () => {
  it("T: align -1=left 0=center 1=right", () => {
    const l = parseXDot("T 0 0 -1 100 5-hello")!.ops[0];
    const c = parseXDot("T 0 0 0 100 5-hello")!.ops[0];
    const r = parseXDot("T 0 0 1 100 5-hello")!.ops[0];
    if (l.kind !== "text" || c.kind !== "text" || r.kind !== "text") throw new Error("wrong kind");
    expect(l.text.align).toBe("left");
    expect(c.text.align).toBe("center");
    expect(r.text.align).toBe("right");
  });

  it("C: solid hex fill color", () => {
    const op = parseXDot("C 7-#ff0000")!.ops[0];
    if (op.kind !== "fill_color") throw new Error("wrong kind");
    expect(op.color).toBe("#ff0000");
  });

  it("c: solid named pen color", () => {
    const op = parseXDot("c 5-black")!.ops[0];
    if (op.kind !== "pen_color") throw new Error("wrong kind");
    expect(op.color).toBe("black");
  });
});

describe("parseXDot — font, style, image, fontchar", () => {
  it("F: font size and name", () => {
    const op = parseXDot("F 12 10-Helvetica")!.ops[0];
    if (op.kind !== "font") throw new Error("wrong kind");
    expect(op.font.size).toBe(12);
    expect(op.font.name).toBe("Helvetica");
  });

  it("S: style string", () => {
    const op = parseXDot("S 6-dashed")!.ops[0];
    if (op.kind !== "style") throw new Error("wrong kind");
    expect(op.style).toBe("dashed");
  });

  it("I: image rect and name", () => {
    const op = parseXDot("I 10 20 100 50 7-foo.png")!.ops[0];
    if (op.kind !== "image") throw new Error("wrong kind");
    expect(op.image.pos).toEqual({ x: 10, y: 20, w: 100, h: 50 });
    expect(op.image.name).toBe("foo.png");
  });

  it("t: fontchar unsigned int", () => {
    const op = parseXDot("t 7")!.ops[0];
    if (op.kind !== "fontchar") throw new Error("wrong kind");
    expect(op.fontchar).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// parseXDot — gradient ops
// ---------------------------------------------------------------------------
describe("parseXDot — gradient ops", () => {
  it("linear gradient fill: coords and stops", () => {
    const op = parseXDot("C 28-[0 0 1 1 2 0 3-red 1 4-blue]")!.ops[0];
    if (op.kind !== "grad_fill_color") throw new Error("wrong kind");
    if (op.gradColor.type !== "linear") throw new Error("wrong type");
    const g = op.gradColor.ling;
    expect(g.x0).toBe(0); expect(g.y0).toBe(0);
    expect(g.x1).toBe(1); expect(g.y1).toBe(1);
    expect(g.stops).toHaveLength(2);
    expect(g.stops[0]).toEqual({ frac: 0, color: "red" });
    expect(g.stops[1]).toEqual({ frac: 1, color: "blue" });
  });

  it("radial gradient pen: coords and stops", () => {
    // "(0 0 5 10 10 20 1 0 5-black)" = 28 chars
    const op = parseXDot("c 28-(0 0 5 10 10 20 1 0 5-black)")!.ops[0];
    if (op.kind !== "grad_pen_color") throw new Error("wrong kind");
    if (op.gradColor.type !== "radial") throw new Error("wrong type");
    const g = op.gradColor.ring;
    expect(g.x0).toBe(0); expect(g.y0).toBe(0); expect(g.r0).toBe(5);
    expect(g.x1).toBe(10); expect(g.y1).toBe(10); expect(g.r1).toBe(20);
    expect(g.stops).toHaveLength(1);
    expect(g.stops[0]).toEqual({ frac: 0, color: "black" });
  });
});

// ---------------------------------------------------------------------------
// parseXDot — error handling
// ---------------------------------------------------------------------------
describe("parseXDot — error handling", () => {
  it("unknown op char after valid op: sets XDOT_PARSE_ERROR, keeps prefix", () => {
    const x = parseXDot("E 10 20 5 3 ?");
    expect(x).not.toBeNull();
    expect(x!.flags & XDOT_PARSE_ERROR).toBe(XDOT_PARSE_ERROR);
    expect(x!.ops).toHaveLength(1);
  });

  it("error-only input (cnt=0) returns null", () => {
    expect(parseXDot("?")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseXDotColor — standalone
// ---------------------------------------------------------------------------
describe("parseXDotColor — solid colors", () => {
  it("hex color → type=none, clr=#rrggbb", () => {
    const c = parseXDotColor("#ff0000");
    expect(c).not.toBeNull();
    if (c!.type !== "none") throw new Error("wrong type");
    expect(c!.clr).toBe("#ff0000");
  });

  it("named color → type=none", () => {
    const c = parseXDotColor("red");
    expect(c).not.toBeNull();
    if (c!.type !== "none") throw new Error("wrong type");
    expect(c!.clr).toBe("red");
  });

  it("slash-separated Brewer color → type=none", () => {
    const c = parseXDotColor("/blues9/1");
    expect(c).not.toBeNull();
    expect(c!.type).toBe("none");
  });

  it("invalid first char → null", () => {
    expect(parseXDotColor("!invalid")).toBeNull();
  });
});

describe("parseXDotColor — gradient colors", () => {
  it("'[...]' → type=linear with coords", () => {
    const c = parseXDotColor("[0 0 1 1 2 0 3-red 1 4-blue]");
    expect(c).not.toBeNull();
    expect(c!.type).toBe("linear");
    if (c!.type !== "linear") throw new Error("wrong type");
    expect(c!.ling.x0).toBe(0);
    expect(c!.ling.x1).toBe(1);
    expect(c!.ling.stops).toHaveLength(2);
  });

  it("'(...)' → type=radial with r0/r1", () => {
    const c = parseXDotColor("(0 0 5 10 10 20 1 0 5-black)");
    expect(c).not.toBeNull();
    expect(c!.type).toBe("radial");
    if (c!.type !== "radial") throw new Error("wrong type");
    expect(c!.ring.r0).toBe(5);
    expect(c!.ring.r1).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// parseXDotFOn — append to existing Xdot
// ---------------------------------------------------------------------------
describe("parseXDotFOn", () => {
  it("appends ops to existing xdot", () => {
    const x1 = parseXDot("E 10 20 5 3")!;
    const x2 = parseXDotFOn("e 1 2 3 4", {}, 0, x1);
    expect(x2!.ops).toHaveLength(2);
    expect(x2!.ops[0].kind).toBe("filled_ellipse");
    expect(x2!.ops[1].kind).toBe("unfilled_ellipse");
  });

  it("creates new xdot when passed null", () => {
    const x = parseXDotFOn("E 10 20 5 3", {}, 0, null as unknown as Xdot);
    expect(x!.ops).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// parseXDotF — opFns callbacks
// ---------------------------------------------------------------------------
describe("parseXDotF — opFns", () => {
  it("invokes ellipse callback for filled_ellipse", () => {
    let called = false;
    const opFns: Partial<OpFunctions> = {
      ellipse: (_op, _more) => { called = true; },
    };
    parseXDotF("E 10 20 5 3", opFns, 0);
    expect(called).toBe(true);
  });
});
