// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from "vitest";
import { AgBuffer } from "./agxbuf.js";
import { List } from "./list.js";
import { gvXmlEscape } from "./xml.js";
import type { XmlFlags } from "./xml.js";
import { isExactlyZero, isExactlyEqual, fcmp, d2i, d2f } from "./math.js";
import { rkNewState, rkSeed, rkRandom, rkInterval } from "./mt19937.js";

// ---------------------------------------------------------------------------
// math.ts
// ---------------------------------------------------------------------------
describe("isExactlyZero", () => {
  it("returns true for +0.0", () => {
    expect(isExactlyZero(0.0)).toBe(true);
  });

  it("returns false for -0.0 (bit-level distinction)", () => {
    expect(isExactlyZero(-0.0)).toBe(false);
  });

  it("returns false for non-zero values", () => {
    expect(isExactlyZero(1.0)).toBe(false);
    expect(isExactlyZero(-1.0)).toBe(false);
    expect(isExactlyZero(Number.EPSILON)).toBe(false);
  });
});

describe("isExactlyEqual", () => {
  it("returns false for +0.0 vs -0.0 (bit-level distinction)", () => {
    expect(isExactlyEqual(0.0, -0.0)).toBe(false);
  });

  it("returns true for identical values", () => {
    expect(isExactlyEqual(1.5, 1.5)).toBe(true);
    expect(isExactlyEqual(0.0, 0.0)).toBe(true);
    expect(isExactlyEqual(-0.0, -0.0)).toBe(true);
  });

  it("returns false for different values", () => {
    expect(isExactlyEqual(1.0, 2.0)).toBe(false);
  });
});

describe("fcmp", () => {
  it("returns -1, 0, 1 correctly", () => {
    expect(fcmp(1, 2)).toBe(-1);
    expect(fcmp(2, 2)).toBe(0);
    expect(fcmp(3, 2)).toBe(1);
  });
});

describe("d2i", () => {
  it("truncates doubles to integer", () => {
    expect(d2i(3.7)).toBe(3);
    expect(d2i(-3.7)).toBe(-3);
  });

  it("clamps to INT32 range", () => {
    expect(d2i(3e9)).toBe(2_147_483_647);
    expect(d2i(-3e9)).toBe(-2_147_483_648);
  });
});

describe("d2f", () => {
  it("reduces precision to float32", () => {
    const f32 = new Float32Array(1);
    f32[0] = 1.1;
    expect(d2f(1.1)).toBe(f32[0]);
  });

  it("clamps to FLT_MAX", () => {
    const FLT_MAX = 3.4028234663852886e+38;
    expect(d2f(1e39)).toBe(FLT_MAX);
    expect(d2f(-1e39)).toBe(-FLT_MAX);
  });
});

// ---------------------------------------------------------------------------
// agxbuf.ts — AgBuffer
// ---------------------------------------------------------------------------
describe("AgBuffer.str() reset semantics", () => {
  it("returns accumulated content and resets the buffer", () => {
    const buf = new AgBuffer();
    buf.append("hello");
    const s = buf.str();
    expect(s).toBe("hello");
    expect(buf.length()).toBe(0);
    expect(buf.str()).toBe("");
  });

  it("append after str() starts fresh", () => {
    const buf = new AgBuffer();
    buf.append("a");
    buf.str();
    buf.append("b");
    expect(buf.str()).toBe("b");
  });
});

describe("AgBuffer.trimZeros()", () => {
  function trim(s: string): string {
    const buf = new AgBuffer();
    buf.append(s);
    buf.trimZeros();
    return buf.str();
  }

  it('"42.00" → "42"', () => {
    expect(trim("42.00")).toBe("42");
  });

  it('"42.01" → "42.01" (no trailing zeros to trim)', () => {
    expect(trim("42.01")).toBe("42.01");
  });

  it('"42.10" → "42.1"', () => {
    expect(trim("42.10")).toBe("42.1");
  });

  it('"-0.0" → "0"', () => {
    expect(trim("-0.0")).toBe("0");
  });

  it("no period → unchanged", () => {
    expect(trim("42")).toBe("42");
  });
});

describe("AgBuffer other methods", () => {
  it("appendChar appends one character", () => {
    const buf = new AgBuffer();
    buf.appendChar("x");
    expect(buf.str()).toBe("x");
  });

  it("appendN appends first n chars", () => {
    const buf = new AgBuffer();
    buf.appendN("hello", 3);
    expect(buf.str()).toBe("hel");
  });

  it("pop returns last char or null if empty", () => {
    const buf = new AgBuffer();
    expect(buf.pop()).toBeNull();
    buf.append("ab");
    expect(buf.pop()).toBe("b");
    expect(buf.str()).toBe("a");
  });

  it("disown resets buffer", () => {
    const buf = new AgBuffer();
    buf.append("hi");
    const s = buf.disown();
    expect(s).toBe("hi");
    expect(buf.length()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// list.ts — List<T>
// ---------------------------------------------------------------------------
describe("List<T> push/pop/shift/unshift", () => {
  it("push / pop (back)", () => {
    const list = new List<number>();
    list.push(1);
    list.push(2);
    expect(list.pop()).toBe(2);
    expect(list.pop()).toBe(1);
    expect(list.pop()).toBeUndefined();
  });

  it("unshift / shift (front)", () => {
    const list = new List<number>();
    list.push(2);
    list.unshift(1);
    expect(list.shift()).toBe(1);
    expect(list.shift()).toBe(2);
    expect(list.shift()).toBeUndefined();
  });

  it("size reflects current count", () => {
    const list = new List<number>();
    expect(list.size).toBe(0);
    list.push(1);
    expect(list.size).toBe(1);
    list.pop();
    expect(list.size).toBe(0);
  });
});

describe("List<T> remove and iteration", () => {
  it("remove by identity", () => {
    const list = new List<string>();
    list.push("a");
    list.push("b");
    list.push("c");
    expect(list.remove("b")).toBe(true);
    expect(list.size).toBe(2);
    expect(list.remove("z")).toBe(false);
    expect([...list]).toEqual(["a", "c"]);
  });

  it("iterates in insertion order", () => {
    const list = new List<number>();
    list.push(10);
    list.push(20);
    list.push(30);
    expect([...list]).toEqual([10, 20, 30]);
  });
});

// ---------------------------------------------------------------------------
// xml.ts — gvXmlEscape
// ---------------------------------------------------------------------------
const allFalse: XmlFlags = { raw: false, dash: false, nbsp: false, utf8: false };
const rawFlags: XmlFlags = { raw: true, dash: false, nbsp: false, utf8: false };

describe("gvXmlEscape basic escaping", () => {
  it("escapes < > \" ' unconditionally", () => {
    expect(gvXmlEscape('<>"\'', allFalse)).toBe("&lt;&gt;&quot;&#39;");
  });

  it("escapes & when raw=true", () => {
    expect(gvXmlEscape("&amp;", rawFlags)).toBe("&amp;amp;");
  });

  it("does not re-escape pre-encoded &amp; when raw=false", () => {
    expect(gvXmlEscape("&amp;", allFalse)).toBe("&amp;");
  });

  it("does not re-escape &#38; when raw=false", () => {
    expect(gvXmlEscape("&#38;", allFalse)).toBe("&#38;");
  });

  it("does not re-escape &#x26; when raw=false", () => {
    expect(gvXmlEscape("&#x26;", allFalse)).toBe("&#x26;");
  });

  it("escapes bare & that is not a valid entity when raw=false", () => {
    expect(gvXmlEscape("& not entity", allFalse)).toBe("&amp; not entity");
  });
});

describe("gvXmlEscape flag: raw", () => {
  it("escapes \\n and \\r when raw=true", () => {
    expect(gvXmlEscape("a\nb\rc", rawFlags)).toBe("a&#10;b&#13;c");
  });

  it("does not escape \\n when raw=false", () => {
    expect(gvXmlEscape("a\nb", allFalse)).toBe("a\nb");
  });
});

describe("gvXmlEscape flag: dash", () => {
  it("escapes - when dash=true", () => {
    const flags: XmlFlags = { ...allFalse, dash: true };
    expect(gvXmlEscape("a-b", flags)).toBe("a&#45;b");
  });
});

describe("gvXmlEscape flag: nbsp", () => {
  it("replaces 2nd+ consecutive space with &#160;", () => {
    const flags: XmlFlags = { ...allFalse, nbsp: true };
    expect(gvXmlEscape("a  b", flags)).toBe("a &#160;b");
  });
});

// ---------------------------------------------------------------------------
// mt19937.ts — MT19937 reference output
// ---------------------------------------------------------------------------

/** Reference values for seed=0, first 10 calls to rkRandom. Computed from C. */
const SEED0_EXPECTED = [
  2357136044, 2546248239, 3071714933, 3626093760, 2588848963,
  3684848379, 2340255427, 3638918503, 1819583497, 2678185683,
];

describe("MT19937 — seed 0, first 10 values match C reference", () => {
  it("produces bit-identical output to the C implementation", () => {
    const state = rkNewState();
    rkSeed(0, state);
    for (let i = 0; i < SEED0_EXPECTED.length; i++) {
      const got = rkRandom(state);
      expect(got).toBe(SEED0_EXPECTED[i]);
    }
  });
});

describe("rkInterval", () => {
  it("result is always in [0, max] inclusive", () => {
    const state = rkNewState();
    rkSeed(42, state);
    const max = 99;
    for (let i = 0; i < 1000; i++) {
      const v = rkInterval(max, state);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(max);
    }
  });

  it("returns 0 when max is 0", () => {
    const state = rkNewState();
    rkSeed(1, state);
    expect(rkInterval(0, state)).toBe(0);
  });
});
