// SPDX-License-Identifier: EPL-2.0
/**
 * Exhaustive iteration-order and completeness tests for DtSplay (DT_OSET)
 * and DtHash (DT_SET).
 *
 * @see lib/cdt/dttree.c
 * @see lib/cdt/dthash.c
 */

import { describe, it, expect } from "vitest";
import { DtSplay, DtHash } from "./index.js";
import { rkNewState, rkSeed, rkInterval } from "../util/mt19937.js";

// ─── Walk interfaces ────────────────────────────────────────────────────────

interface Walkable<T> {
  first(): T | undefined;
  next(obj: T): T | undefined;
}

/** Drain a Walkable into an array via first()/next(). */
function drain<T>(dt: Walkable<T>): T[] {
  const out: T[] = [];
  let cur = dt.first();
  while (cur !== undefined) { out.push(cur); cur = dt.next(cur); }
  return out;
}

// ─── Integer DtSplay factory ────────────────────────────────────────────────

const intCmp = (a: number, b: number): number => a < b ? -1 : a > b ? 1 : 0;

function makeSplay(): DtSplay<number, number> {
  return new DtSplay<number, number>((n) => n, intCmp);
}

// ─── Integer DtHash factory ─────────────────────────────────────────────────

function intHash(n: number): number {
  return Math.imul(n >>> 0, 0x9e3779b9) >>> 0;
}

function makeHash(): DtHash<number, number> {
  return new DtHash<number, number>((n) => n, intHash, intCmp);
}

// ─── Shuffle and assertion helpers ──────────────────────────────────────────

/** Fisher-Yates shuffle using MT19937 with the given seed. */
function shuffled(arr: number[], seed: number): number[] {
  const a = arr.slice();
  const state = rkNewState();
  rkSeed(seed, state);
  for (let i = a.length - 1; i >= 1; i--) {
    const j = rkInterval(i, state);
    const tmp = a[i]; a[i] = a[j]!; a[j] = tmp!;
  }
  return a;
}

/** Assert every element of `actual` is present in `expected`. */
function assertAllPresent(actual: number[], expected: Set<number>): void {
  for (const k of actual) expect(expected.has(k)).toBe(true);
}

// ─── String DtSplay (Test 4) ─────────────────────────────────────────────────

const strCmp = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

function makeStrSplay(words: string[]): DtSplay<string, string> {
  const dt = new DtSplay<string, string>((s) => s, strCmp);
  for (const w of words) dt.insert(w);
  return dt;
}

// ─── Object DtSplay (Test 5) ─────────────────────────────────────────────────

type Obj = { id: number; name: string };
const objCmp = (a: number, b: number): number => a < b ? -1 : a > b ? 1 : 0;

function makeObjSplay(): DtSplay<Obj, number> {
  return new DtSplay<Obj, number>((o) => o.id, objCmp);
}

// ─── DtSplay: forward and reverse order ────────────────────────────────────

describe("DtSplay forward iteration order", () => {

  it("Test 1: 100-key random insertion yields ascending sequence [0..99]", () => {
    const dt = makeSplay();
    const keys = Array.from({ length: 100 }, (_, i) => i);
    for (const k of shuffled(keys, 42)) dt.insert(k);
    expect(drain(dt)).toEqual(keys);
  });

  it("Test 2: delete-and-reinsert preserves full sort order [0..19]", () => {
    const dt = makeSplay();
    for (let i = 19; i >= 0; i--) dt.insert(i);
    dt.delete(5); dt.delete(10); dt.delete(15);
    dt.insert(5); dt.insert(10); dt.insert(15);
    expect(drain(dt)).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it("Test 3: reverse iteration via prev() yields descending sequence [19..0]", () => {
    const dt = makeSplay();
    for (let i = 0; i < 20; i++) dt.insert(i);
    const result: number[] = [];
    let cur = dt.last();
    while (cur !== undefined) { result.push(cur); cur = dt.prev(cur); }
    expect(result).toEqual(Array.from({ length: 20 }, (_, i) => 19 - i));
  });

});

// ─── DtSplay: comparators and duplicates ───────────────────────────────────

describe("DtSplay comparator and duplicate key", () => {

  it("Test 4: string comparator yields lexicographic order", () => {
    const dt = makeStrSplay(["banana", "apple", "cherry", "date", "apricot"]);
    expect(drain(dt)).toEqual(["apple", "apricot", "banana", "cherry", "date"]);
  });

  it("Test 5: duplicate key insert returns existing object; size stays 1", () => {
    const dt = makeObjSplay();
    const first  = { id: 1, name: "first" };
    const second = { id: 1, name: "second" };
    const r1 = dt.insert(first);
    const r2 = dt.insert(second);
    expect(r1).toBe(first);
    expect(r2).toBe(first);
    expect(r2).not.toBe(second);
    expect(dt.size()).toBe(1);
  });

});

// ─── DtSplay: walk safety ───────────────────────────────────────────────────

describe("DtSplay walk safety", () => {

  it("Test 6: abandoned walk does not corrupt subsequent full walk", () => {
    const dt = makeSplay();
    for (let i = 0; i < 10; i++) dt.insert(i);
    const abandoned = dt.first();
    expect(abandoned).toBe(0);
    dt.next(abandoned!);
    expect(drain(dt)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

});

// ─── DtHash completeness ───────────────────────────────────────────────────

describe("DtHash completeness", () => {

  it("Test 7: 200-key walk returns all 200 distinct integers", () => {
    const dt = makeHash();
    for (let i = 0; i < 200; i++) dt.insert(i);
    const result = drain(dt);
    expect(result.length).toBe(200);
    expect(new Set(result).size).toBe(200);
    assertAllPresent(result, new Set(Array.from({ length: 200 }, (_, i) => i)));
  });

  it("Test 8: insert during incomplete walk; second walk contains all 51 keys", () => {
    const dt = makeHash();
    for (let i = 0; i < 50; i++) dt.insert(i);
    dt.first();
    for (let step = 0; step < 4; step++) dt.next(0);
    dt.insert(9999);
    const result = drain(dt);
    expect(result.length).toBe(51);
    expect(new Set(result).size).toBe(51);
    const expected = new Set([...Array.from({ length: 50 }, (_, i) => i), 9999]);
    assertAllPresent(result, expected);
  });

});
