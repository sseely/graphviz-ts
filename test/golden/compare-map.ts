// SPDX-License-Identifier: EPL-2.0
/// <reference types="vitest/importMeta" />
//
// Semantic imagemap comparator (mission: map-conformance, T2 twin of
// compare-xdot.ts).
//
// `dot -Tcmapx` / `dot -Timap` both derive from ONE C source,
// plugin/core/gvrender_core_map.c:map_output_shape, whose coordinate
// formatting is `%.0f` in every branch (rect/circle/poly, all three of
// IMAP/CMAP/CMAPX) — i.e. the C oracle NEVER emits a fractional coordinate;
// every AF[i].x/y is rounded to the nearest integer by printf before it
// reaches the page. The port mirrors this with `Math.round` (src/render/
// map.ts:cmapxCoords*/mapOutputImap). Both sides are therefore ALREADY
// integer-rounded text by the time this comparator sees them — the
// "coords numerically" instruction reduces to comparing the parsed integers
// for EXACT equality (MAP_TOLERANCE = 0), not a ±epsilon window. A delta of
// exactly 1 at a `.5` decision boundary would mean the two sides used
// different round-half rules (JS `Math.round` = half-up; C `printf %.0f` =
// current FP rounding mode, normally round-half-to-even) — kept visible as a
// `numeric` diff rather than silently tolerated, so a real occurrence shows
// up as its own dashboard bucket instead of being masked.
//
// cmapx is XML (`<map><area .../></map>`): parsed with the SAME
// `@xmldom/xmldom` DOMParser test/golden/normalize.ts already uses for SVG,
// so entity-escaping differences between the port's `escapeXml` and the C
// `xml_url_puts`/`gvputs_xml` (different escape flavors for href vs.
// title/target — plugin/core/gvrender_core_map.c:87-106) are invisible: the
// DOM gives back the decoded attribute VALUE on both sides, and only a real
// content difference surfaces. `<area>` order is NOT sorted away — it is the
// C object-emission order (map_end_page for the graph shape, map_begin_anchor
// per node/edge/cluster in traversal order) and a reordering is itself a
// structural finding, so areas are compared index-by-index; a count mismatch
// is one structural diff, not a silent re-alignment.
//
// imap is plain text (`base referer`, optional `default <url>`, then one
// `rect|circle|poly <url> <coords...>` line per url-bearing object, again in
// C's emission order — plugin/core/gvrender_core_map.c:map_begin_page /
// map_output_shape FORMAT_IMAP branch). Compared line-by-line, keyword then
// url token exactly, trailing coordinate tokens numerically by the same
// exact-after-round rule.
//
// KNOWN C QUIRK (not "fixed" here — a triage finding, see PARITY-MAP.md): the
// C imap `default` line runs the graph URL through `gvputs_xml` (XML-entity
// escaping) even though `-Timap` is a plain-text format, not XML
// (gvrender_core_map.c:145-150). The port's `ImapRenderer.beginGraph`
// (src/render/map.ts) writes the raw URL unescaped. This comparator does NOT
// paper over that: the `default` line's url token is compared as raw text on
// both sides, so a graph-level URL containing `&`/`<`/`>`/`"` would surface a
// real `value` diff on the `default` line. No corpus item observed during the
// initial survey triggers it (no href-bearing item sets a graph-level `URL`
// attribute with an XML-special character), so it reads as absent for now —
// flagged here so it isn't silently normalized away if the corpus grows.
//
// Node-only dev/test infra — never imported by src/index.ts.

import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import type { Element as XmlElement } from '@xmldom/xmldom';

// xmldom's Node interface does not export nodeType constants in all
// versions — same workaround as test/golden/normalize.ts.
const ELEMENT_NODE = 1;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Coordinates on both sides are already `%.0f`/`Math.round`-rounded text —
 * compare the parsed integers for exact equality (see file header). */
export const MAP_TOLERANANCE_NOTE =
  'coords are pre-rounded on both sides; MAP_TOLERANCE=0 means exact-after-round, not a window';
export const MAP_TOLERANCE = 0;

/** Classification of a single imagemap divergence. */
export type MapDiffKind = 'structural' | 'numeric' | 'value';

/** One semantic difference between the port's map output and the oracle's. */
export interface MapDiff {
  /** Stable path key the dashboard buckets on, e.g. `area[2].href`. */
  path: string;
  actual: string;
  expected: string;
  /** Magnitude for numeric diffs (|actual − expected|). */
  delta?: number;
  kind: MapDiffKind;
}

export interface MapCompareResult {
  pass: boolean;
  diffs: MapDiff[];
}

// ---------------------------------------------------------------------------
// Shared numeric helpers (same philosophy as compare-xdot.ts extractNumbers)
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

/** Compare a `coords`-shaped string (rect/circle/poly numbers, any grouping)
 * at `tolerance`: count mismatch is structural, else per-index numeric. */
function compareCoords(
  path: string,
  portCoords: string,
  oracleCoords: string,
  tolerance: number,
  diffs: MapDiff[],
): void {
  const an = extractNumbers(portCoords);
  const bn = extractNumbers(oracleCoords);
  if (an.length !== bn.length) {
    diffs.push({
      path: `${path}[count]`,
      actual: portCoords,
      expected: oracleCoords,
      kind: 'structural',
    });
    return;
  }
  for (let i = 0; i < an.length; i++) {
    const delta = Math.abs(an[i] - bn[i]);
    if (delta > tolerance) {
      diffs.push({
        path: `${path}[${i}]`,
        actual: String(an[i]),
        expected: String(bn[i]),
        delta,
        kind: 'numeric',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// cmapx (XML)
// ---------------------------------------------------------------------------

/** Attributes compared EXACTLY on each `<area>` (mission spec). `coords` is
 * handled separately (numeric). `id` is deliberately excluded — it is an
 * internal object identifier (cgraph AGID / port node counter), not
 * spec-required, and not stable across the two independent id-assignment
 * schemes. */
const CMAPX_AREA_ATTRS = ['shape', 'href', 'title', 'alt', 'target'] as const;

/** `getAttribute` returns `null` when absent; C only ever emits an attribute
 * when its value is non-empty, so absent and `""` are the same "no value". */
function attrOrEmpty(el: XmlElement, name: string): string {
  const v = el.getAttribute(name);
  return v === null ? '' : v;
}

function parseXml(text: string): XmlElement | null {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  const root = doc.documentElement;
  return root === null ? null : (root as unknown as XmlElement);
}

/** Direct `<area>` children of `<map>`, in document (= C emission) order. */
function areaChildren(mapEl: XmlElement): XmlElement[] {
  const out: XmlElement[] = [];
  const kids = mapEl.childNodes;
  for (let i = 0; i < kids.length; i++) {
    const n = kids.item(i);
    if (n !== null && n.nodeType === ELEMENT_NODE && n.nodeName === 'area') {
      out.push(n as unknown as XmlElement);
    }
  }
  return out;
}

/**
 * Compare the port's `render(g, 'cmapx')` output against `dot -Tcmapx`,
 * semantically (see file header for the rounding/escaping rationale).
 */
export function compareCmapx(
  portText: string,
  oracleText: string,
  tolerance: number = MAP_TOLERANCE,
): MapCompareResult {
  let portMap: XmlElement | null;
  let oracleMap: XmlElement | null;
  try {
    portMap = parseXml(portText);
  } catch (e) {
    return {
      pass: false,
      diffs: [{ path: '[parse]/port', actual: e instanceof Error ? e.message : String(e), expected: '<parseable>', kind: 'structural' }],
    };
  }
  try {
    oracleMap = parseXml(oracleText);
  } catch (e) {
    return {
      pass: false,
      diffs: [{ path: '[parse]/oracle', actual: e instanceof Error ? e.message : String(e), expected: '<parseable>', kind: 'structural' }],
    };
  }
  if (portMap === null || oracleMap === null) {
    return {
      pass: false,
      diffs: [{
        path: 'map[missing]',
        actual: portMap === null ? '<absent>' : '<present>',
        expected: oracleMap === null ? '<absent>' : '<present>',
        kind: 'structural',
      }],
    };
  }

  const diffs: MapDiff[] = [];

  for (const attr of ['id', 'name'] as const) {
    const pv = attrOrEmpty(portMap, attr);
    const ov = attrOrEmpty(oracleMap, attr);
    if (pv !== ov) diffs.push({ path: `map/@${attr}`, actual: pv, expected: ov, kind: 'value' });
  }

  const portAreas = areaChildren(portMap);
  const oracleAreas = areaChildren(oracleMap);
  if (portAreas.length !== oracleAreas.length) {
    diffs.push({
      path: 'map/area[count]',
      actual: String(portAreas.length),
      expected: String(oracleAreas.length),
      kind: 'structural',
    });
    return { pass: false, diffs };
  }

  for (let i = 0; i < portAreas.length; i++) {
    const pa = portAreas[i]!;
    const oa = oracleAreas[i]!;
    for (const attr of CMAPX_AREA_ATTRS) {
      const pv = attrOrEmpty(pa, attr);
      const ov = attrOrEmpty(oa, attr);
      if (pv !== ov) {
        diffs.push({ path: `area[${i}].${attr}`, actual: pv, expected: ov, kind: 'value' });
      }
    }
    compareCoords(`area[${i}].coords`, attrOrEmpty(pa, 'coords'), attrOrEmpty(oa, 'coords'), tolerance, diffs);
  }

  return { pass: diffs.length === 0, diffs };
}

// ---------------------------------------------------------------------------
// imap (plain text)
// ---------------------------------------------------------------------------

function nonEmptyLines(text: string): string[] {
  return text.split('\n').map((l) => l.trimEnd()).filter((l) => l.length > 0);
}

function tokenize(line: string): string[] {
  return line.trim().split(/\s+/).filter((t) => t.length > 0);
}

/**
 * Compare the port's `render(g, 'imap')` output against `dot -Timap`,
 * line-structurally (see file header). Line order is C's emission order and
 * is preserved, not sorted; a line-count mismatch is one structural diff.
 */
export function compareImap(
  portText: string,
  oracleText: string,
  tolerance: number = MAP_TOLERANCE,
): MapCompareResult {
  const diffs: MapDiff[] = [];
  const portLines = nonEmptyLines(portText);
  const oracleLines = nonEmptyLines(oracleText);

  if (portLines.length !== oracleLines.length) {
    diffs.push({
      path: 'imap/line[count]',
      actual: String(portLines.length),
      expected: String(oracleLines.length),
      kind: 'structural',
    });
    return { pass: false, diffs };
  }

  for (let i = 0; i < portLines.length; i++) {
    const pt = tokenize(portLines[i]!);
    const ot = tokenize(oracleLines[i]!);
    const pKw = pt[0] ?? '';
    const oKw = ot[0] ?? '';
    if (pKw !== oKw) {
      diffs.push({ path: `imap/line[${i}].keyword`, actual: pKw, expected: oKw, kind: 'structural' });
      continue;
    }
    // Second token: "referer" for `base`, else the url. Same shape for both
    // — compare exactly (see the `default`-line escaping note in the header).
    const pTok = pt[1] ?? '';
    const oTok = ot[1] ?? '';
    if (pTok !== oTok) {
      const field = pKw === 'base' ? 'token' : 'url';
      diffs.push({ path: `imap/line[${i}].${field}`, actual: pTok, expected: oTok, kind: 'value' });
    }
    const pCoords = pt.slice(2).join(' ');
    const oCoords = ot.slice(2).join(' ');
    compareCoords(`imap/line[${i}].coords`, pCoords, oCoords, tolerance, diffs);
  }

  return { pass: diffs.length === 0, diffs };
}

// ---------------------------------------------------------------------------
// CLI entry point — compare two map files (port vs oracle)
// ---------------------------------------------------------------------------

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [, , format, portPath, oraclePath] = process.argv;
  if ((format !== 'cmapx' && format !== 'imap') || !portPath || !oraclePath) {
    process.stderr.write('Usage: tsx compare-map.ts <cmapx|imap> <portFile> <oracleFile>\n');
    process.exit(2);
  }
  const compare = format === 'cmapx' ? compareCmapx : compareImap;
  const { pass, diffs } = compare(readFileSync(portPath, 'utf8'), readFileSync(oraclePath, 'utf8'));
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
