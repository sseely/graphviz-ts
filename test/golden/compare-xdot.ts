// SPDX-License-Identifier: EPL-2.0
/// <reference types="vitest/importMeta" />
//
// Semantic xdot comparator (mission: xdot-conformance, T2 / decisions.md AD-1).
//
// xdot output is a DOT file whose objects carry draw-op strings in `_draw_`,
// `_ldraw_`, `_hdraw_`, `_tdraw_`, `_hldraw_`, `_tldraw_` attributes plus
// positional `pos`/`bb`/`width`/`height`. A literal/byte compare drowns in
// formatting noise (`width=.75` vs `0.75`, attribute order, the
// `node [label="\N"]` default line, named vs hex colors). This comparator is
// SEMANTIC: it parses both sides, keys objects by identity (graph / node name /
// edge tail->head / cluster name), parses each draw string with the port's own
// `parseXDot`, and compares the typed op streams — opcode sequence exactly,
// numbers at 0.01 tolerance, colors canonicalized to `#rrggbb[aa]`, fonts
// normalized for case/whitespace. Cosmetic differences are invisible by design;
// a reported diff is a real geometry/color/text/structure difference.
//
// Mirrors test/golden/compare.ts's tolerance philosophy (0.01 deterministic).
// Node-only dev/test infra — never imported by src/index.ts.

import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { parse } from '../../src/index.js';
import { parseXDot } from '../../src/xdot/index.js';
import type { XdotOp } from '../../src/xdot/index.js';
import { colorxlate, ColorxlateResult, type GVColor } from '../../src/common/color.js';
import { translatePostscriptFontname } from '../../src/common/ps-fontalias.js';
import type { Graph } from '../../src/model/graph.js';
import type { Node } from '../../src/model/node.js';
import type { Edge } from '../../src/model/edge.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export const XDOT_TOLERANCE = 0.01;

/** Classification of a single xdot divergence. */
export type XdotDiffKind = 'structural' | 'numeric' | 'value' | 'parse';

/** One semantic difference between the port's xdot and the oracle's. */
export interface XdotDiff {
  /** Object identity: `[graph]`, `node:a`, `edge:a->b#0`, `cluster:cluster_0`. */
  object: string;
  /** Draw/positional attribute the diff is in: `_draw_`, `pos`, `bb`, ... */
  attr: string;
  /**
   * Stable dot-path key of the divergence — the dashboard buckets on this.
   * e.g. `node:a/_draw_/op[1].ellipse.y` or `edge:a->b#0/_hdraw_[opCount]`.
   */
  path: string;
  actual: string;
  expected: string;
  /** Magnitude for numeric diffs (|actual − expected|). */
  delta?: number;
  kind: XdotDiffKind;
}

export interface XdotCompareResult {
  pass: boolean;
  diffs: XdotDiff[];
}

// ---------------------------------------------------------------------------
// Canonicalization (AD-1: colors + font names normalized before comparing)
// ---------------------------------------------------------------------------

/**
 * Canonicalize a color spec to lowercase `#rrggbb` (or `#rrggbbaa` when alpha
 * < 255) so representation differences vanish: native emits canonical hex
 * (`#ff0000`), the port may emit a name (`red`) or a differently-cased hex.
 * Both sides run through the SAME `colorxlate` the renderer uses, so `red`,
 * `#ff0000`, and `#FF0000` all collapse to `#ff0000`. An unrecognized name
 * (colorxlate → ColorUnknown) keeps its lowercased/trimmed raw form so two
 * genuinely-different unknown names stay distinct rather than both becoming
 * black.
 */
export function canonColor(raw: string): string {
  const color: GVColor = { type: 'rgba', r: 0, g: 0, b: 0, a: 0 };
  const res = colorxlate(raw, color, 'rgba');
  if (res !== ColorxlateResult.ColorOk || color.type !== 'rgba') {
    return raw.trim().toLowerCase();
  }
  const byte = (v: number): string =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  const rgb = '#' + byte(color.r) + byte(color.g) + byte(color.b);
  const a = Math.round(Math.max(0, Math.min(1, color.a)) * 255);
  return a >= 255 ? rgb : rgb + byte(color.a);
}

/**
 * Canonicalize a font face for comparison (AD-1: "font names canonicalized").
 *
 * xdot emits the resolved PostScript face name (`span->font->name`, e.g.
 * `Times-Roman`); the port's default fontname is the SVG family the renderer
 * feeds to `-Tsvg` (`Times,serif`) — the SAME font under two names. Native's
 * SVG output likewise maps `Times-Roman` → `Times,serif` via the postscript
 * alias table (ps_font_equiv.h). So the canonical key is the SVG family string
 * the alias yields (`family[,svgFontFamily]`): both `Times-Roman` and
 * `Times,serif` collapse to `times,serif`, while genuinely different faces
 * (`Helvetica` → `helvetica,sans-serif`) stay distinct. A name with no alias is
 * normalized (dequoted, ws-collapsed, lowercased) verbatim.
 *
 * @see lib/common/textspan.c:66 translate_postscript_fontname
 * @see plugin/core/gvrender_core_svg.c svg_textspan (NATIVEFONTS)
 */
export function canonFont(raw: string): string {
  const base = raw
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, ' ');
  const alias = translatePostscriptFontname(base);
  if (alias !== null) {
    const fam =
      alias.svgFontFamily !== alias.family
        ? `${alias.family},${alias.svgFontFamily}`
        : alias.family;
    return fam.toLowerCase();
  }
  return base.toLowerCase();
}

// ---------------------------------------------------------------------------
// Draw-attribute detection
// ---------------------------------------------------------------------------

/** True for any xdot draw attribute: `_draw_`, `_ldraw_`, `_hdraw_`, ... */
function isDrawAttr(name: string): boolean {
  return /^_[a-z]*draw_$/.test(name);
}

/** Positional attributes compared numerically (points / inches). */
const POSITIONAL_ATTRS = ['pos', 'bb', 'width', 'height'] as const;

// ---------------------------------------------------------------------------
// Object inventory (graph / cluster / node / edge → draw-bearing attrs)
// ---------------------------------------------------------------------------

/** One comparable object: its identity key and the attribute map to read. */
interface XdotObject {
  key: string;
  attrs: Map<string, string>;
}

/** Collect all graph objects (root + subgraphs) that carry ≥1 draw attr. */
function collectGraphs(root: Graph): XdotObject[] {
  const out: XdotObject[] = [];
  const visit = (g: Graph, isRoot: boolean): void => {
    const hasDraw = [...g.attrs.keys()].some(isDrawAttr);
    if (hasDraw) {
      const key = isRoot ? '[graph]' : `cluster:${g.name}`;
      out.push({ key, attrs: g.attrs });
    }
    for (const sg of g.subgraphs.values()) visit(sg, false);
  };
  visit(root, true);
  return out;
}

/** Effective node-attr default for `key` in graph `g` (self → ancestors). */
function effectiveNodeDefault(g: Graph, key: string): string | undefined {
  for (let cur: Graph | null = g; cur !== null; cur = cur.parent) {
    const v = cur.nodeDefaults.get(key);
    if (v !== undefined && v.length > 0) return v;
  }
  return undefined;
}

/**
 * Collect every node once (root + subgraph scopes, dedup by name), resolving
 * `width`/`height` against the effective node defaults. Native's agwrite omits
 * an attribute equal to the `node [...]` default; the port emits width/height
 * per-node. Comparing the EFFECTIVE value (own attr, else inherited default)
 * makes these formatting-only differences invisible, per AD-1.
 */
function collectNodes(root: Graph): XdotObject[] {
  const seen = new Map<string, XdotObject>();
  const visit = (g: Graph): void => {
    for (const [name, node] of g.nodes) {
      if (seen.has(name)) continue;
      const attrs = new Map(node.attrs);
      for (const k of ['width', 'height']) {
        if (!attrs.has(k)) {
          const d = effectiveNodeDefault(g, k);
          if (d !== undefined) attrs.set(k, d);
        }
      }
      seen.set(name, { key: `node:${name}`, attrs });
    }
    for (const sg of g.subgraphs.values()) visit(sg);
  };
  visit(root);
  return [...seen.values()];
}

/**
 * Collect edges, keyed `edge:<tail>-><head>#<occurrence>`. Parallel edges
 * between the same endpoints are disambiguated by their order of appearance —
 * the same basis on both sides (identical input, identical dot layout), so a
 * per-key count mismatch is itself a real divergence.
 */
function collectEdges(root: Graph): XdotObject[] {
  const counter = new Map<string, number>();
  const out: XdotObject[] = [];
  for (const e of root.edges as Edge[]) {
    const base = `${e.tail.name}->${e.head.name}`;
    const idx = counter.get(base) ?? 0;
    counter.set(base, idx + 1);
    out.push({ key: `edge:${base}#${idx}`, attrs: e.attrs });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Numeric helpers (shared philosophy with compare.ts extractNumbers)
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
// Op-stream comparison
// ---------------------------------------------------------------------------

/** Numeric payload of an op, in a fixed order, for tolerance comparison. */
function opNumbers(op: XdotOp): number[] {
  switch (op.kind) {
    case 'filled_ellipse':
    case 'unfilled_ellipse':
      return [op.ellipse.x, op.ellipse.y, op.ellipse.w, op.ellipse.h];
    case 'filled_polygon':
    case 'unfilled_polygon':
      return op.polygon.pts.flatMap((p) => [p.x, p.y]);
    case 'filled_bezier':
    case 'unfilled_bezier':
      return op.bezier.pts.flatMap((p) => [p.x, p.y]);
    case 'polyline':
      return op.polyline.pts.flatMap((p) => [p.x, p.y]);
    case 'text':
      return [op.text.x, op.text.y, op.text.width];
    case 'font':
      return [op.font.size];
    case 'image':
      return [op.image.pos.x, op.image.pos.y, op.image.pos.w, op.image.pos.h];
    case 'fontchar':
      return [op.fontchar];
    default:
      return [];
  }
}

/** Non-numeric, canonicalized scalar payload of an op (color/font/text/style). */
function opValues(op: XdotOp): Array<[string, string]> {
  switch (op.kind) {
    case 'fill_color':
    case 'pen_color':
      return [['color', canonColor(op.color)]];
    case 'grad_fill_color':
    case 'grad_pen_color':
      return [['grad', canonGrad(op.gradColor)]];
    case 'font':
      return [['face', canonFont(op.font.name)]];
    case 'text':
      return [
        ['align', op.text.align],
        ['text', op.text.text],
      ];
    case 'style':
      return [['style', op.style.trim()]];
    case 'image':
      return [['name', op.image.name]];
    default:
      return [];
  }
}

/** Canonical string for a gradient color op (coords rounded, colors canon). */
function canonGrad(c: import('../../src/xdot/index.js').XdotColor): string {
  if (c.type === 'none') return `none:${canonColor(c.clr)}`;
  const g = c.type === 'linear' ? c.ling : c.ring;
  const stops = g.stops.map((s) => `${s.frac.toFixed(3)}:${canonColor(s.color)}`).join(',');
  return `${c.type}:${stops}`;
}

/**
 * Compare two op streams for one draw attribute. The opcode sequence must match
 * exactly (kind-by-kind); on the first kind mismatch or a length mismatch a
 * single structural diff is emitted and the walk stops (mirrors compare.ts's
 * structural-stop). Matching ops then compare numeric payloads at tolerance and
 * canonicalized scalar payloads exactly.
 */
function compareOps(
  port: XdotOp[],
  oracle: XdotOp[],
  objKey: string,
  attr: string,
  tolerance: number,
  diffs: XdotDiff[],
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
    if (a.kind !== b.kind) {
      diffs.push({
        object: objKey,
        attr,
        path: `${objKey}/${attr}/op[${i}].kind`,
        actual: a.kind,
        expected: b.kind,
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
        path: `${objKey}/${attr}/op[${i}].${a.kind}[ptCount]`,
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
          path: `${objKey}/${attr}/op[${i}].${a.kind}[${j}]`,
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
          path: `${objKey}/${attr}/op[${i}].${a.kind}.${av[j][0]}`,
          actual: av[j][1],
          expected: bv[j][1],
          kind: 'value',
        });
      }
    }
  }
}

/** Compare one positional attribute (pos/bb/width/height) numerically. */
function comparePositional(
  portVal: string | undefined,
  oracleVal: string | undefined,
  objKey: string,
  attr: string,
  tolerance: number,
  diffs: XdotDiff[],
): void {
  if (portVal === undefined && oracleVal === undefined) return;
  if (portVal === undefined || oracleVal === undefined) {
    diffs.push({
      object: objKey,
      attr,
      path: `${objKey}/${attr}[missing]`,
      actual: portVal ?? '<absent>',
      expected: oracleVal ?? '<absent>',
      kind: 'structural',
    });
    return;
  }
  const an = extractNumbers(portVal);
  const bn = extractNumbers(oracleVal);
  if (an.length !== bn.length) {
    diffs.push({
      object: objKey,
      attr,
      path: `${objKey}/${attr}[count]`,
      actual: portVal,
      expected: oracleVal,
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

/** Compare all draw + positional attrs of one matched object. */
function compareObject(
  port: Map<string, string>,
  oracle: Map<string, string>,
  objKey: string,
  tolerance: number,
  diffs: XdotDiff[],
): void {
  const drawNames = new Set<string>();
  for (const k of port.keys()) if (isDrawAttr(k)) drawNames.add(k);
  for (const k of oracle.keys()) if (isDrawAttr(k)) drawNames.add(k);

  for (const attr of [...drawNames].sort()) {
    const pv = port.get(attr);
    const ov = oracle.get(attr);
    if (pv === undefined || ov === undefined) {
      diffs.push({
        object: objKey,
        attr,
        path: `${objKey}/${attr}[missing]`,
        actual: pv === undefined ? '<absent>' : '<present>',
        expected: ov === undefined ? '<absent>' : '<present>',
        kind: 'structural',
      });
      continue;
    }
    const pOps = parseXDot(pv)?.ops;
    const oOps = parseXDot(ov)?.ops;
    if (pOps === undefined || pOps === null || oOps === undefined || oOps === null) {
      diffs.push({
        object: objKey,
        attr,
        path: `${objKey}/${attr}[parse]`,
        actual: pOps == null ? '<parse-fail>' : 'ok',
        expected: oOps == null ? '<parse-fail>' : 'ok',
        kind: 'parse',
      });
      continue;
    }
    compareOps(pOps, oOps, objKey, attr, tolerance, diffs);
  }

  for (const attr of POSITIONAL_ATTRS) {
    comparePositional(port.get(attr), oracle.get(attr), objKey, attr, tolerance, diffs);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Build the full keyed object inventory for one side. */
function inventory(root: Graph): Map<string, Map<string, string>> {
  const inv = new Map<string, Map<string, string>>();
  for (const o of [...collectGraphs(root), ...collectNodes(root), ...collectEdges(root)]) {
    inv.set(o.key, o.attrs);
  }
  return inv;
}

/**
 * Compare the port's xdot output against the oracle's, semantically.
 *
 * @param portText   full `render(g, 'xdot')` output from the port
 * @param oracleText full `dot -Txdot` output from native graphviz
 * @param tolerance  numeric tolerance in points (default 0.01, deterministic)
 * @returns `{ pass, diffs }`; `pass` iff `diffs` is empty
 */
export function compareXdot(
  portText: string,
  oracleText: string,
  tolerance: number = XDOT_TOLERANCE,
): XdotCompareResult {
  const diffs: XdotDiff[] = [];

  let portG: Graph;
  let oracleG: Graph;
  try {
    portG = parse(portText);
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
    oracleG = parse(oracleText);
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

  const portInv = inventory(portG);
  const oracleInv = inventory(oracleG);
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
// CLI entry point — compare two xdot files (port vs oracle)
// ---------------------------------------------------------------------------

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [, , portPath, oraclePath] = process.argv;
  if (!portPath || !oraclePath) {
    process.stderr.write('Usage: tsx compare-xdot.ts <portXdot> <oracleXdot>\n');
    process.exit(2);
  }
  const { pass, diffs } = compareXdot(
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
