// SPDX-License-Identifier: EPL-2.0
/// <reference types="vitest/importMeta" />
//
// Semantic JSON comparator (mission: json-conformance, T-json-2).
//
// `dot -Tjson` (plugin/core/gvrender_core_json.c) serializes the SAME xdot draw
// model the xdot track already validates, but nested inside a JSON tree: a top
// graph object carrying `directed`/`strict`/`_subgraph_cnt` plus every graph
// attribute (including `_draw_`/`_ldraw_`/... as an ARRAY of typed op objects,
// not a draw string — write_xdot() re-serializes each parsed xdot op as
// `{"op":"E", "rect":[...]}` etc.), a flat `"objects"` array holding every
// subgraph object AND every node object (subgraphs first, cross-referenced by
// integer `_gvid`), and a flat `"edges"` array of edge objects referencing
// `tail`/`head` by `_gvid`.
//
// AD (json-conformance): the port's `render(g,'json')` (src/render/json.ts)
// structurally matches `-Tjson` (FORMAT_JSON, `doXDot=true`) rather than
// `-Tjson0` — it always emits an `"_draw_": []` key on every node/edge (json0
// never emits `_draw_` at all; a smoke A/B on `digraph G { a -> b; }` confirms
// this: `-Tjson0` output for node `a` has no `_draw_` key whatsoever, `-Tjson`
// has a `_draw_` array of 2 ops, the port has `_draw_: []`). So the oracle for
// this track is `dot -Tjson`, and the track is named "dot (json)" — see
// json-walk.ts / PARITY-JSON.md.
//
// Comparison philosophy mirrors compare-xdot.ts (AD-1, ±0.01 tolerance,
// canonicalized colors/fonts via the SAME exported canonColor/canonFont): keys
// objects by identity (graph / node name / edge tail->head#occurrence /
// subgraph name), compares draw-op ARRAYS op-by-op (opcode letter sequence
// exactly, numeric payload at tolerance, canonicalized scalar payload
// exactly), and compares positional string attrs (`pos`, `bb`, `width`,
// `height`, `lp`, `lwidth`, `lheight`) by extracting embedded numbers and
// comparing at tolerance. All other generic attrs (label, style, shape, ...)
// are JSON strings (stoj always double-quotes) compared exactly, except
// `*color` attrs (canonColor) and `fontname` (canonFont).
//
// Known simplification (documented, not a bug): subgraph member lists
// (`nodes`/`edges`/`subgraphs` — integer _gvid arrays) are NOT deep-compared
// element-by-element. Since the port currently emits zero subgraphs (AD
// above), any real graph with subgraphs already surfaces as a `cluster:<name>`
// missing-object diff on the port side, which is the correct triage signal;
// deep member-set diffing is deferred until the port has subgraph support to
// validate.
//
// Node-only dev/test infra — never imported by src/index.ts.

import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { canonColor, canonFont } from './compare-xdot.js';

// ---------------------------------------------------------------------------
// Loosely-typed JSON tree helpers
// ---------------------------------------------------------------------------

type JVal = string | number | boolean | null | JVal[] | JObj;
export interface JObj { [k: string]: JVal | undefined; }

function isObj(v: JVal | undefined): v is JObj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isArr(v: JVal | undefined): v is JVal[] {
  return Array.isArray(v);
}

function asStr(v: JVal | undefined): string | undefined {
  return typeof v === 'string' ? v : v === undefined ? undefined : String(v);
}

function asNumArr(v: JVal | undefined): number[] {
  if (!Array.isArray(v)) return [];
  const out: number[] = [];
  for (const x of v) {
    if (typeof x === 'number') out.push(x);
    else if (Array.isArray(x)) out.push(...asNumArr(x));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export const JSON_TOLERANCE = 0.01;

/** Classification of a single JSON divergence. */
export type JsonDiffKind = 'structural' | 'numeric' | 'value' | 'parse';

/** One semantic difference between the port's json and the oracle's. */
export interface JsonDiff {
  /** Object identity: `[graph]`, `node:a`, `edge:a->b#0`, `cluster:cluster_0`. */
  object: string;
  /** The attribute/op the diff is in: `_draw_`, `pos`, `bb`, `color`, ... */
  attr: string;
  /** Stable dot-path key of the divergence — the dashboard buckets on this. */
  path: string;
  actual: string;
  expected: string;
  /** Magnitude for numeric diffs (|actual − expected|). */
  delta?: number;
  kind: JsonDiffKind;
}

export interface JsonCompareResult {
  pass: boolean;
  diffs: JsonDiff[];
}

// ---------------------------------------------------------------------------
// Reserved / structural keys — never compared as generic attrs
// ---------------------------------------------------------------------------

const RESERVED_TOP = new Set([
  'name', 'directed', 'strict', '_subgraph_cnt', '_gvid',
  'objects', 'edges', 'subgraphs', 'nodes', 'tail', 'head',
]);

/** Attrs whose string value is a space/comma-separated list of numbers. */
const POSITIONAL_ATTRS = new Set(['pos', 'bb', 'width', 'height', 'lp', 'lwidth', 'lheight']);

/** True for any xdot draw attribute: `_draw_`, `_ldraw_`, `_hdraw_`, ... */
function isDrawAttr(name: string): boolean {
  return /^_[a-z]*draw_$/.test(name);
}

// ---------------------------------------------------------------------------
// Numeric helpers (shared philosophy with compare-xdot.ts extractNumbers)
// ---------------------------------------------------------------------------

function extractNumbers(s: string): number[] {
  const nums: number[] = [];
  const re = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const n = parseFloat(m[0]);
    if (!isNaN(n)) nums.push(n);
  }
  return nums;
}

// ---------------------------------------------------------------------------
// Draw-op array comparison (JSON-native — ops are already typed objects, no
// draw-string re-parse needed, unlike compare-xdot.ts)
// ---------------------------------------------------------------------------

/** Numeric payload of one op object, fixed order, for tolerance comparison. */
function opNumbers(op: JObj): number[] {
  switch (op.op) {
    case 'E':
    case 'e':
      return asNumArr(op.rect);
    case 'P':
    case 'p':
    case 'B':
    case 'b':
    case 'L':
      return asNumArr(op.points);
    case 'T':
      return [...asNumArr(op.pt), Number(op.width)];
    case 'F':
      return [Number(op.size)];
    case 't':
      return [Number(op.fontchar)];
    case 'C':
    case 'c':
      if (op.grad === 'linear' || op.grad === 'radial') {
        return [...asNumArr(op.p0), ...asNumArr(op.p1)];
      }
      return [];
    default:
      return [];
  }
}

/** Canonicalized gradient stops: `frac:color,frac:color,...`. */
function canonStops(v: JVal | undefined): string {
  if (!isArr(v)) return '';
  return v
    .filter(isObj)
    .map((s) => `${Number(s.frac).toFixed(3)}:${canonColor(asStr(s.color) ?? '')}`)
    .join(',');
}

/** Non-numeric, canonicalized scalar payload of an op (color/font/text/style). */
function opValues(op: JObj): Array<[string, string]> {
  switch (op.op) {
    case 'C':
    case 'c':
      if (!op.grad || op.grad === 'none') {
        return [['color', canonColor(asStr(op.color) ?? '')]];
      }
      return [
        ['grad', String(op.grad)],
        ['stops', canonStops(op.stops)],
      ];
    case 'F':
      return [['face', canonFont(asStr(op.face) ?? '')]];
    case 'T':
      return [
        ['align', String(op.align)],
        ['text', String(op.text)],
      ];
    case 'S':
      return [['style', (asStr(op.style) ?? '').trim()]];
    default:
      return [];
  }
}

/**
 * Compare two op-object arrays for one draw attribute. The opcode sequence
 * must match exactly (letter-by-letter); on the first kind mismatch or a
 * length mismatch a single structural diff is emitted and the walk stops
 * (mirrors compare-xdot.ts's structural-stop). Matching ops then compare
 * numeric payloads at tolerance and canonicalized scalar payloads exactly.
 */
function compareOps(
  port: JVal[],
  oracle: JVal[],
  objKey: string,
  attr: string,
  tolerance: number,
  diffs: JsonDiff[],
): void {
  if (port.length !== oracle.length) {
    diffs.push({
      object: objKey,
      attr,
      path: `${objKey}/${attr}[opCount]`,
      actual: String(port.length),
      expected: String(oracle.length),
      kind: 'structural',
    });
    return;
  }
  for (let i = 0; i < port.length; i++) {
    const a = port[i];
    const b = oracle[i];
    if (!isObj(a) || !isObj(b)) {
      diffs.push({
        object: objKey,
        attr,
        path: `${objKey}/${attr}/op[${i}][parse]`,
        actual: isObj(a) ? 'ok' : '<not-object>',
        expected: isObj(b) ? 'ok' : '<not-object>',
        kind: 'parse',
      });
      return;
    }
    if (a.op !== b.op) {
      diffs.push({
        object: objKey,
        attr,
        path: `${objKey}/${attr}/op[${i}].kind`,
        actual: String(a.op),
        expected: String(b.op),
        kind: 'structural',
      });
      return; // opcode sequence diverged — remaining indices are meaningless
    }
    const an = opNumbers(a);
    const bn = opNumbers(b);
    if (an.length !== bn.length) {
      diffs.push({
        object: objKey,
        attr,
        path: `${objKey}/${attr}/op[${i}].${String(a.op)}[ptCount]`,
        actual: String(an.length),
        expected: String(bn.length),
        kind: 'structural',
      });
      continue;
    }
    for (let j = 0; j < an.length; j++) {
      const delta = Math.abs(an[j] - bn[j]);
      if (delta > tolerance) {
        diffs.push({
          object: objKey,
          attr,
          path: `${objKey}/${attr}/op[${i}].${String(a.op)}[${j}]`,
          actual: String(an[j]),
          expected: String(bn[j]),
          delta,
          kind: 'numeric',
        });
      }
    }
    const av = opValues(a);
    const bv = opValues(b);
    for (let j = 0; j < av.length; j++) {
      if (av[j][1] !== bv[j][1]) {
        diffs.push({
          object: objKey,
          attr,
          path: `${objKey}/${attr}/op[${i}].${String(a.op)}.${av[j][0]}`,
          actual: av[j][1],
          expected: bv[j][1],
          kind: 'value',
        });
      }
    }
  }
}

/** Compare one draw-attribute value (`_draw_`, `_ldraw_`, ...): array vs array. */
function compareDrawAttr(
  pv: JVal | undefined,
  ov: JVal | undefined,
  objKey: string,
  attr: string,
  tolerance: number,
  diffs: JsonDiff[],
): void {
  if (pv === undefined && ov === undefined) return;
  if (pv === undefined || ov === undefined) {
    diffs.push({
      object: objKey,
      attr,
      path: `${objKey}/${attr}[missing]`,
      actual: pv === undefined ? '<absent>' : '<present>',
      expected: ov === undefined ? '<absent>' : '<present>',
      kind: 'structural',
    });
    return;
  }
  if (!isArr(pv) || !isArr(ov)) {
    diffs.push({
      object: objKey,
      attr,
      path: `${objKey}/${attr}[parse]`,
      actual: isArr(pv) ? 'ok' : '<not-array>',
      expected: isArr(ov) ? 'ok' : '<not-array>',
      kind: 'parse',
    });
    return;
  }
  compareOps(pv, ov, objKey, attr, tolerance, diffs);
}

// ---------------------------------------------------------------------------
// Positional / generic scalar attr comparison
// ---------------------------------------------------------------------------

/** Compare one positional attribute (pos/bb/width/height/...) numerically. */
function comparePositional(
  pv: string,
  ov: string,
  objKey: string,
  attr: string,
  tolerance: number,
  diffs: JsonDiff[],
): void {
  const an = extractNumbers(pv);
  const bn = extractNumbers(ov);
  if (an.length !== bn.length) {
    diffs.push({
      object: objKey,
      attr,
      path: `${objKey}/${attr}[count]`,
      actual: pv,
      expected: ov,
      kind: 'structural',
    });
    return;
  }
  for (let i = 0; i < an.length; i++) {
    const delta = Math.abs(an[i] - bn[i]);
    if (delta > tolerance) {
      diffs.push({
        object: objKey,
        attr,
        path: `${objKey}/${attr}[${i}]`,
        actual: String(an[i]),
        expected: String(bn[i]),
        delta,
        kind: 'numeric',
      });
    }
  }
}

/** Compare one generic (non-positional, non-draw) scalar attr exactly. */
function compareScalar(pv: string, ov: string, objKey: string, attr: string, diffs: JsonDiff[]): void {
  let a = pv;
  let b = ov;
  if (/color$/i.test(attr)) {
    a = canonColor(pv);
    b = canonColor(ov);
  } else if (attr === 'fontname') {
    a = canonFont(pv);
    b = canonFont(ov);
  } else {
    a = pv.trim();
    b = ov.trim();
  }
  if (a !== b) {
    diffs.push({ object: objKey, attr, path: `${objKey}/${attr}`, actual: a, expected: b, kind: 'value' });
  }
}

// ---------------------------------------------------------------------------
// Object-level comparison (graph / subgraph / node / edge)
// ---------------------------------------------------------------------------

/** Structural fields compared only on the root graph object. */
const GRAPH_STRUCTURAL_FIELDS = ['directed', 'strict', '_subgraph_cnt'] as const;

function compareObject(port: JObj, oracle: JObj, objKey: string, tolerance: number, diffs: JsonDiff[]): void {
  if (objKey === '[graph]') {
    for (const f of GRAPH_STRUCTURAL_FIELDS) {
      const pv = port[f];
      const ov = oracle[f];
      if (String(pv) !== String(ov)) {
        diffs.push({
          object: objKey,
          attr: f,
          path: `${objKey}/${f}`,
          actual: String(pv),
          expected: String(ov),
          kind: 'value',
        });
      }
    }
  }

  const keys = new Set<string>([...Object.keys(port), ...Object.keys(oracle)]);
  for (const k of [...keys].sort()) {
    if (RESERVED_TOP.has(k)) continue;
    const pv = port[k];
    const ov = oracle[k];
    if (isDrawAttr(k)) {
      compareDrawAttr(pv, ov, objKey, k, tolerance, diffs);
      continue;
    }
    if (pv === undefined || ov === undefined) {
      diffs.push({
        object: objKey,
        attr: k,
        path: `${objKey}/${k}[missing]`,
        actual: pv === undefined ? '<absent>' : '<present>',
        expected: ov === undefined ? '<absent>' : '<present>',
        kind: 'structural',
      });
      continue;
    }
    const pStr = asStr(pv) ?? '';
    const oStr = asStr(ov) ?? '';
    if (POSITIONAL_ATTRS.has(k)) {
      comparePositional(pStr, oStr, objKey, k, tolerance, diffs);
    } else {
      compareScalar(pStr, oStr, objKey, k, diffs);
    }
  }
}

// ---------------------------------------------------------------------------
// Object inventory (graph / subgraph / node / edge → keyed JSON objects)
// ---------------------------------------------------------------------------

/** A node entry always carries `pos`; a subgraph entry never does. */
function isNodeEntry(o: JObj): boolean {
  return typeof o.pos === 'string';
}

/** `_gvid` -> `name` map for resolving edge tail/head refs to stable names. */
function gvidToName(root: JObj): Map<number, string> {
  const map = new Map<number, string>();
  for (const o of isArr(root.objects) ? root.objects.filter(isObj) : []) {
    if (typeof o._gvid === 'number' && typeof o.name === 'string') map.set(o._gvid, o.name);
  }
  return map;
}

/** Build the full keyed object inventory for one side (graph tree root). */
function inventory(root: JObj): Map<string, JObj> {
  const inv = new Map<string, JObj>();
  inv.set('[graph]', root);
  for (const o of isArr(root.objects) ? root.objects.filter(isObj) : []) {
    if (typeof o.name !== 'string') continue;
    const key = isNodeEntry(o) ? `node:${o.name}` : `cluster:${o.name}`;
    if (!inv.has(key)) inv.set(key, o);
  }
  const names = gvidToName(root);
  const counter = new Map<string, number>();
  for (const e of isArr(root.edges) ? root.edges.filter(isObj) : []) {
    const tailName = names.get(Number(e.tail)) ?? String(e.tail);
    const headName = names.get(Number(e.head)) ?? String(e.head);
    const base = `${tailName}->${headName}`;
    const idx = counter.get(base) ?? 0;
    counter.set(base, idx + 1);
    inv.set(`edge:${base}#${idx}`, e);
  }
  return inv;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compare the port's json output against the oracle's, semantically.
 *
 * @param portText   full `render(g, 'json')` output from the port
 * @param oracleText full `dot -Tjson` output from native graphviz
 * @param tolerance  numeric tolerance in points (default 0.01, deterministic)
 * @returns `{ pass, diffs }`; `pass` iff `diffs` is empty
 */
export function compareJson(
  portText: string,
  oracleText: string,
  tolerance: number = JSON_TOLERANCE,
): JsonCompareResult {
  let portRoot: JObj;
  let oracleRoot: JObj;
  try {
    portRoot = JSON.parse(portText) as JObj;
  } catch (e) {
    return {
      pass: false,
      diffs: [
        {
          object: '[parse]',
          attr: 'port',
          path: '[parse]/port',
          actual: e instanceof Error ? e.message : String(e),
          expected: '<parseable>',
          kind: 'parse',
        },
      ],
    };
  }
  try {
    oracleRoot = JSON.parse(oracleText) as JObj;
  } catch (e) {
    return {
      pass: false,
      diffs: [
        {
          object: '[parse]',
          attr: 'oracle',
          path: '[parse]/oracle',
          actual: e instanceof Error ? e.message : String(e),
          expected: '<parseable>',
          kind: 'parse',
        },
      ],
    };
  }

  const diffs: JsonDiff[] = [];
  const portInv = inventory(portRoot);
  const oracleInv = inventory(oracleRoot);
  const keys = new Set<string>([...portInv.keys(), ...oracleInv.keys()]);

  for (const key of [...keys].sort()) {
    const p = portInv.get(key);
    const o = oracleInv.get(key);
    if (p === undefined || o === undefined) {
      diffs.push({
        object: key,
        attr: '<object>',
        path: `${key}[missing-object]`,
        actual: p === undefined ? '<absent>' : '<present>',
        expected: o === undefined ? '<absent>' : '<present>',
        kind: 'structural',
      });
      continue;
    }
    compareObject(p, o, key, tolerance, diffs);
  }

  return { pass: diffs.length === 0, diffs };
}

// ---------------------------------------------------------------------------
// CLI entry point — compare two json files (port vs oracle)
// ---------------------------------------------------------------------------

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [, , portPath, oraclePath] = process.argv;
  if (!portPath || !oraclePath) {
    process.stderr.write('Usage: tsx compare-json.ts <portJson> <oracleJson>\n');
    process.exit(2);
  }
  const { pass, diffs } = compareJson(
    readFileSync(portPath, 'utf8'),
    readFileSync(oraclePath, 'utf8'),
  );
  if (!pass) {
    for (const d of diffs.slice(0, 20)) {
      process.stderr.write(
        `DIFF ${d.path}: actual=${d.actual} expected=${d.expected}` +
          `${d.delta !== undefined ? ` delta=${d.delta.toFixed(6)}` : ''} [${d.kind}]\n`,
      );
    }
    if (diffs.length > 20) process.stderr.write(`... and ${diffs.length - 20} more\n`);
    process.exit(1);
  }
  process.exit(0);
}
