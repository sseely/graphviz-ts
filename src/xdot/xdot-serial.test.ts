// SPDX-License-Identifier: EPL-2.0
/**
 * Serialization and round-trip tests for lib/xdot.
 * Expected values derived from ~/git/graphviz/lib/xdot/xdot.c.
 * Do NOT change assertions to match code output; fix the code instead.
 */

import { describe, it, expect } from "vitest";
import { parseXDot, sprintXDot, jsonXDot } from "./index.js";

// Helper: parse → sprint → parse; returns both parsed objects.
function roundTrip(s: string) {
  const x1 = parseXDot(s);
  expect(x1).not.toBeNull();
  const wire = sprintXDot(x1!);
  const x2 = parseXDot(wire);
  expect(x2).not.toBeNull();
  return { x1: x1!, x2: x2! };
}

// ---------------------------------------------------------------------------
// Acceptance criterion 3 — round-trip per op kind (shapes)
// ---------------------------------------------------------------------------
describe("AC3 round-trip — ellipse and polygon", () => {
  it("filled_ellipse", () => {
    const { x1, x2 } = roundTrip("E 10 20 5 3");
    if (x1.ops[0].kind !== "filled_ellipse" || x2.ops[0].kind !== "filled_ellipse") throw new Error("kind");
    expect(x2.ops[0].ellipse).toEqual(x1.ops[0].ellipse);
  });

  it("unfilled_ellipse", () => {
    const { x1, x2 } = roundTrip("e 100 200 50 30");
    if (x1.ops[0].kind !== "unfilled_ellipse" || x2.ops[0].kind !== "unfilled_ellipse") throw new Error("kind");
    expect(x2.ops[0].ellipse).toEqual(x1.ops[0].ellipse);
  });

  it("filled_polygon", () => {
    const { x1, x2 } = roundTrip("P 3 0 0 10 0 5 10");
    if (x1.ops[0].kind !== "filled_polygon" || x2.ops[0].kind !== "filled_polygon") throw new Error("kind");
    expect(x2.ops[0].polygon.pts).toEqual(x1.ops[0].polygon.pts);
  });

  it("unfilled_polygon", () => {
    const { x1, x2 } = roundTrip("p 4 0 0 10 0 10 10 0 10");
    if (x1.ops[0].kind !== "unfilled_polygon" || x2.ops[0].kind !== "unfilled_polygon") throw new Error("kind");
    expect(x2.ops[0].polygon.pts).toEqual(x1.ops[0].polygon.pts);
  });
});

describe("AC3 round-trip — bezier and polyline", () => {
  it("filled_bezier", () => {
    const { x1, x2 } = roundTrip("b 4 0 0 5 10 15 10 20 0");
    if (x1.ops[0].kind !== "filled_bezier" || x2.ops[0].kind !== "filled_bezier") throw new Error("kind");
    expect(x2.ops[0].bezier.pts).toEqual(x1.ops[0].bezier.pts);
  });

  it("unfilled_bezier", () => {
    const { x1, x2 } = roundTrip("B 4 0 0 5 10 15 10 20 0");
    if (x1.ops[0].kind !== "unfilled_bezier" || x2.ops[0].kind !== "unfilled_bezier") throw new Error("kind");
    expect(x2.ops[0].bezier.pts).toEqual(x1.ops[0].bezier.pts);
  });

  it("polyline", () => {
    const { x1, x2 } = roundTrip("L 2 0 0 10 20");
    if (x1.ops[0].kind !== "polyline" || x2.ops[0].kind !== "polyline") throw new Error("kind");
    expect(x2.ops[0].polyline.pts).toEqual(x1.ops[0].polyline.pts);
  });
});

describe("AC3 round-trip — text and colors", () => {
  it("text preserves all fields", () => {
    const { x1, x2 } = roundTrip("T 10 20 0 50 5-hello");
    if (x1.ops[0].kind !== "text" || x2.ops[0].kind !== "text") throw new Error("kind");
    const t1 = x1.ops[0].text; const t2 = x2.ops[0].text;
    expect(t2.x).toBe(t1.x);
    expect(t2.y).toBe(t1.y);
    expect(t2.align).toBe(t1.align);
    expect(t2.width).toBe(t1.width);
    expect(t2.text).toBe(t1.text);
  });

  it("fill_color", () => {
    const { x1, x2 } = roundTrip("C 7-#ff0000");
    if (x1.ops[0].kind !== "fill_color" || x2.ops[0].kind !== "fill_color") throw new Error("kind");
    expect(x2.ops[0].color).toBe(x1.ops[0].color);
  });

  it("pen_color", () => {
    const { x1, x2 } = roundTrip("c 5-black");
    if (x1.ops[0].kind !== "pen_color" || x2.ops[0].kind !== "pen_color") throw new Error("kind");
    expect(x2.ops[0].color).toBe(x1.ops[0].color);
  });
});

describe("AC3 round-trip — font, style, image, fontchar", () => {
  it("font", () => {
    const { x1, x2 } = roundTrip("F 14 5-Times");
    if (x1.ops[0].kind !== "font" || x2.ops[0].kind !== "font") throw new Error("kind");
    expect(x2.ops[0].font.size).toBe(x1.ops[0].font.size);
    expect(x2.ops[0].font.name).toBe(x1.ops[0].font.name);
  });

  it("style", () => {
    const { x1, x2 } = roundTrip("S 6-dashed");
    if (x1.ops[0].kind !== "style" || x2.ops[0].kind !== "style") throw new Error("kind");
    expect(x2.ops[0].style).toBe(x1.ops[0].style);
  });

  it("image", () => {
    const { x1, x2 } = roundTrip("I 0 0 100 50 8-img.png");
    if (x1.ops[0].kind !== "image" || x2.ops[0].kind !== "image") throw new Error("kind");
    expect(x2.ops[0].image.name).toBe(x1.ops[0].image.name);
    expect(x2.ops[0].image.pos).toEqual(x1.ops[0].image.pos);
  });

  it("fontchar", () => {
    const { x1, x2 } = roundTrip("t 4");
    if (x1.ops[0].kind !== "fontchar" || x2.ops[0].kind !== "fontchar") throw new Error("kind");
    expect(x2.ops[0].fontchar).toBe(x1.ops[0].fontchar);
  });
});

describe("AC3 round-trip — gradients", () => {
  it("grad_fill_color (linear): stops preserved", () => {
    const { x1, x2 } = roundTrip("C 28-[0 0 1 1 2 0 3-red 1 4-blue]");
    if (x1.ops[0].kind !== "grad_fill_color" || x2.ops[0].kind !== "grad_fill_color") throw new Error("kind");
    if (x1.ops[0].gradColor.type !== "linear" || x2.ops[0].gradColor.type !== "linear") throw new Error("type");
    const g1 = x1.ops[0].gradColor.ling; const g2 = x2.ops[0].gradColor.ling;
    expect(g2.x0).toBe(g1.x0); expect(g2.y0).toBe(g1.y0);
    expect(g2.x1).toBe(g1.x1); expect(g2.y1).toBe(g1.y1);
    expect(g2.stops[0]).toEqual({ frac: 0, color: "red" });
    expect(g2.stops[1]).toEqual({ frac: 1, color: "blue" });
  });

  it("grad_pen_color (radial): stops preserved", () => {
    const { x1, x2 } = roundTrip("c 28-(0 0 5 10 10 20 1 0 5-black)");
    if (x1.ops[0].kind !== "grad_pen_color" || x2.ops[0].kind !== "grad_pen_color") throw new Error("kind");
    if (x1.ops[0].gradColor.type !== "radial" || x2.ops[0].gradColor.type !== "radial") throw new Error("type");
    const g1 = x1.ops[0].gradColor.ring; const g2 = x2.ops[0].gradColor.ring;
    expect(g2.r0).toBe(g1.r0); expect(g2.r1).toBe(g1.r1);
    expect(g2.stops[0].color).toBe("black");
  });
});

// ---------------------------------------------------------------------------
// sprintXDot — number formatting (C: %.02f with trim_zeros)
// ---------------------------------------------------------------------------
describe("sprintXDot — number formatting", () => {
  it("integers: no decimal point (100.00 → 100)", () => {
    // C: agxbuf_trim_zeros strips trailing zeros and decimal point
    expect(sprintXDot(parseXDot("E 100 200 50 30")!)).toBe("E 100 200 50 30");
  });

  it("non-integers: keep needed decimal places (10.50 → 10.5)", () => {
    expect(sprintXDot(parseXDot("E 10.5 20.75 5 3")!)).toBe("E 10.5 20.75 5 3");
  });

  it("trailing space between ops; no trailing space after last", () => {
    // C: more=1 appends space; more=0 does not
    expect(sprintXDot(parseXDot("E 10 20 5 3 e 30 40 7 2")!))
      .toBe("E 10 20 5 3 e 30 40 7 2");
  });
});

describe("sprintXDot — op-specific formatting", () => {
  it("text: T x y align width len -text (%.f for x/y, integer align)", () => {
    // C: print(info, "T %.f %.f", x, y) then printAlign (-1/0/1) then " %.f" width
    // printString: " %zu -%s" → " 5 -hello"
    expect(sprintXDot(parseXDot("T 10 20 0 50 5-hello")!)).toBe("T 10 20 0 50 5 -hello");
  });

  it("fontchar: 't <uint>'", () => {
    expect(sprintXDot(parseXDot("t 4")!)).toBe("t 4");
  });

  it("solid fill_color: 'C len -color'", () => {
    // printString uses strlen(p) and format " %zu -%s"
    expect(sprintXDot(parseXDot("C 3-red")!)).toBe("C 3 -red");
  });

  it("linear gradient serializes to bracket format and round-trips", () => {
    const x = parseXDot("C 28-[0 0 1 1 2 0 3-red 1 4-blue]")!;
    const s = sprintXDot(x);
    expect(s).toContain("C");
    expect(parseXDot(s)!.ops[0].kind).toBe("grad_fill_color");
  });
});

// ---------------------------------------------------------------------------
// jsonXDot — output format (C: wraps in [\n...\n], each op {"X": ...}\n)
// ---------------------------------------------------------------------------
describe("jsonXDot — output format", () => {
  it("wraps output in a JSON array", () => {
    const s = jsonXDot(parseXDot("E 10 20 5 3")!);
    expect(s.trimStart()).toMatch(/^\[/);
    expect(s.trimEnd()).toMatch(/\][\n]?$/);
  });

  it("ellipse renders as {\"E\": [x,y,w,h]} with 6 decimal places", () => {
    const s = jsonXDot(parseXDot("E 10 20 5 3")!);
    expect(s).toContain('"E"');
    expect(s).toContain("10.000000");
  });

  it("pen_color renders as {\"c\": \"<name>\"}", () => {
    const s = jsonXDot(parseXDot("c 3-red")!);
    expect(s).toContain('"c"');
    expect(s).toContain('"red"');
  });
});
