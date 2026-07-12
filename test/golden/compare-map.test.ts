// SPDX-License-Identifier: EPL-2.0
//
// Tests for the semantic imagemap comparator (mission: map-conformance, T2).
//
// Fixtures are real `dot -Tcmapx` / `dot -Timap` output captured from the
// native oracle (GVBINDIR=/tmp/ghl) on corpus items 2258 and 2295 — both
// href-bearing, one with a `cluster`+`poly` edge area, one a bare rect with a
// tooltip. Assertions cover the comparator's contract: cosmetic differences
// (attribute order, insignificant whitespace) are invisible; real
// shape/coords/href/title/target/order differences surface as a classified
// diff at a stable path.

import { describe, test, expect } from 'vitest';
import { compareCmapx, compareImap, MAP_TOLERANCE } from './compare-map.js';

const ORACLE_CMAPX_2258 = `<map id="Tree" name="Tree">
<area shape="rect" id="G2_node1" href="xxx" title=" " alt="" coords="5,5,77,83"/>
<area shape="rect" id="G2_node2" href="xxx" title=" " alt="" coords="5,131,77,209"/>
<area shape="poly" id="G2_edge1" title=" " alt="" coords="42,81,44,116,39,115,41,86"/>
<area shape="rect" id="G2" title=" " alt="" coords="0,-0,83,214"/>
</map>
`;

const ORACLE_IMAP_2258 = `base referer
rect xxx 5,5 77,83
rect xxx 5,131 77,209
`;

const ORACLE_CMAPX_2295 = `<map id="%1" name="%1">
<area shape="rect" id="node1_0" href="https://example.com" title="hi mom" alt="" coords="9,9,165,40"/>
</map>
`;

const ORACLE_IMAP_2295 = `base referer
rect https://example.com 9,9 165,40
`;

describe('compareCmapx', () => {
  test('AC1: identical cmapx passes', () => {
    const { pass, diffs } = compareCmapx(ORACLE_CMAPX_2258, ORACLE_CMAPX_2258);
    expect(pass).toBe(true);
    expect(diffs).toHaveLength(0);
  });

  test('AC2: cosmetic differences invisible (attr order, id, extra whitespace)', () => {
    // Different `id` values (excluded from comparison per spec), attributes
    // reordered, extra indentation — all cosmetic.
    const cosmetic = `<map name="Tree" id="Tree">
  <area  title=" "  href="xxx"  id="different_id_1"  shape="rect"  coords="5,5,77,83"  alt=""  />
  <area  coords="5,131,77,209"  alt=""  title=" "  href="xxx"  id="different_id_2"  shape="rect"  />
  <area  alt=""  coords="42,81,44,116,39,115,41,86"  id="whatever"  title=" "  shape="poly"  />
  <area  shape="rect"  coords="0,-0,83,214"  alt=""  title=" "  id="G2"  />
</map>
`;
    const { pass, diffs } = compareCmapx(cosmetic, ORACLE_CMAPX_2258);
    expect(diffs).toEqual([]);
    expect(pass).toBe(true);
  });

  test('AC3: coord tolerance — exact-after-round is the default (delta=1 fails)', () => {
    expect(MAP_TOLERANCE).toBe(0);
    const offByOne = ORACLE_CMAPX_2295.replace('coords="9,9,165,40"', 'coords="9,9,166,40"');
    const { pass, diffs } = compareCmapx(offByOne, ORACLE_CMAPX_2295);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.path === 'area[0].coords[2]');
    expect(d).toBeDefined();
    expect(d?.kind).toBe('numeric');
    expect(d?.delta).toBe(1);
  });

  test('AC3b: explicit tolerance override passes a delta=1 coord difference', () => {
    const offByOne = ORACLE_CMAPX_2295.replace('coords="9,9,165,40"', 'coords="9,9,166,40"');
    const { pass } = compareCmapx(offByOne, ORACLE_CMAPX_2295, 1);
    expect(pass).toBe(true);
  });

  test('AC4: href mismatch surfaces as an exact value diff', () => {
    const wrongHref = ORACLE_CMAPX_2295.replace('href="https://example.com"', 'href="https://wrong.example"');
    const { pass, diffs } = compareCmapx(wrongHref, ORACLE_CMAPX_2295);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.path === 'area[0].href');
    expect(d).toBeDefined();
    expect(d?.kind).toBe('value');
    expect(d?.actual).toBe('https://wrong.example');
    expect(d?.expected).toBe('https://example.com');
  });

  test('AC5: shape mismatch surfaces as an exact value diff', () => {
    const wrongShape = ORACLE_CMAPX_2295.replace('shape="rect"', 'shape="poly"');
    const { pass, diffs } = compareCmapx(wrongShape, ORACLE_CMAPX_2295);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.path === 'area[0].shape');
    expect(d?.kind).toBe('value');
  });

  test('AC6: area order matters — swapping two rects is NOT silently reconciled', () => {
    const swapped = `<map id="Tree" name="Tree">
<area shape="rect" href="xxx" title=" " alt="" coords="5,131,77,209"/>
<area shape="rect" href="xxx" title=" " alt="" coords="5,5,77,83"/>
<area shape="poly" title=" " alt="" coords="42,81,44,116,39,115,41,86"/>
<area shape="rect" title=" " alt="" coords="0,-0,83,214"/>
</map>
`;
    const { pass, diffs } = compareCmapx(swapped, ORACLE_CMAPX_2258);
    expect(pass).toBe(false);
    // Both area[0] and area[1] coords now disagree (indices are literally
    // swapped) — the comparator does not sort areas to hide this.
    expect(diffs.some((d) => d.path.startsWith('area[0].coords['))).toBe(true);
    expect(diffs.some((d) => d.path.startsWith('area[1].coords['))).toBe(true);
  });

  test('AC7: area count mismatch is one structural diff (missing area)', () => {
    const missing = ORACLE_CMAPX_2258.replace(/<area shape="rect" id="G2"[^>]*\/>\n/, '');
    const { pass, diffs } = compareCmapx(missing, ORACLE_CMAPX_2258);
    expect(pass).toBe(false);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].path).toBe('map/area[count]');
    expect(diffs[0].kind).toBe('structural');
  });

  test('AC8: empty maps on both sides are conformant', () => {
    const empty = '<map id="MODEL" name="MODEL">\n</map>\n';
    const { pass, diffs } = compareCmapx(empty, empty);
    expect(pass).toBe(true);
    expect(diffs).toHaveLength(0);
  });

  test('AC9: empty vs non-empty map is a structural area-count diff', () => {
    const empty = '<map id="Tree" name="Tree">\n</map>\n';
    const { pass, diffs } = compareCmapx(empty, ORACLE_CMAPX_2258);
    expect(pass).toBe(false);
    expect(diffs[0].path).toBe('map/area[count]');
  });

  test('AC10: title/target/alt mismatches each surface individually', () => {
    const wrongTitle = ORACLE_CMAPX_2295.replace('title="hi mom"', 'title="bye mom"');
    const d1 = compareCmapx(wrongTitle, ORACLE_CMAPX_2295).diffs.find((d) => d.path === 'area[0].title');
    expect(d1?.kind).toBe('value');

    const withTarget = ORACLE_CMAPX_2295.replace('title="hi mom"', 'title="hi mom" target="_top"');
    const d2 = compareCmapx(withTarget, ORACLE_CMAPX_2295).diffs.find((d) => d.path === 'area[0].target');
    expect(d2?.actual).toBe('_top');
    expect(d2?.expected).toBe('');
  });
});

describe('compareImap', () => {
  test('AC1: identical imap passes', () => {
    const { pass, diffs } = compareImap(ORACLE_IMAP_2258, ORACLE_IMAP_2258);
    expect(pass).toBe(true);
    expect(diffs).toHaveLength(0);
  });

  test('AC2: blank-line/whitespace noise is invisible', () => {
    const cosmetic = 'base referer\n\n  rect   xxx   5,5   77,83  \n\nrect xxx 5,131 77,209\n\n';
    const { pass, diffs } = compareImap(cosmetic, ORACLE_IMAP_2258);
    expect(diffs).toEqual([]);
    expect(pass).toBe(true);
  });

  test('AC3: coord tolerance — exact-after-round by default (delta=1 fails)', () => {
    const offByOne = ORACLE_IMAP_2295.replace('9,9 165,40', '9,9 166,40');
    const { pass, diffs } = compareImap(offByOne, ORACLE_IMAP_2295);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.path === 'imap/line[1].coords[2]');
    expect(d?.kind).toBe('numeric');
    expect(d?.delta).toBe(1);
  });

  test('AC3b: explicit tolerance override passes a delta=1 coord difference', () => {
    const offByOne = ORACLE_IMAP_2295.replace('9,9 165,40', '9,9 166,40');
    const { pass } = compareImap(offByOne, ORACLE_IMAP_2295, 1);
    expect(pass).toBe(true);
  });

  test('AC4: url mismatch surfaces as an exact value diff', () => {
    const wrongUrl = ORACLE_IMAP_2295.replace('https://example.com', 'https://wrong.example');
    const { pass, diffs } = compareImap(wrongUrl, ORACLE_IMAP_2295);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.path === 'imap/line[1].url');
    expect(d?.actual).toBe('https://wrong.example');
    expect(d?.expected).toBe('https://example.com');
  });

  test('AC5: line order matters — swapped rects are NOT silently reconciled', () => {
    const swapped = 'base referer\nrect xxx 5,131 77,209\nrect xxx 5,5 77,83\n';
    const { pass, diffs } = compareImap(swapped, ORACLE_IMAP_2258);
    expect(pass).toBe(false);
    expect(diffs.some((d) => d.path === 'imap/line[1].coords[count]' || d.path.startsWith('imap/line[1].coords['))).toBe(true);
  });

  test('AC6: a shape keyword mismatch is structural, not a value diff', () => {
    const wrongKw = ORACLE_IMAP_2295.replace('rect https', 'circle https');
    const { pass, diffs } = compareImap(wrongKw, ORACLE_IMAP_2295);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.path === 'imap/line[1].keyword');
    expect(d?.kind).toBe('structural');
    expect(d?.actual).toBe('circle');
    expect(d?.expected).toBe('rect');
  });

  test('AC7: a missing `default` line (present on one side only) is a line-count/keyword diff', () => {
    const withDefault = 'base referer\ndefault https://example.com\nrect https://example.com 9,9 165,40\n';
    const { pass, diffs } = compareImap(withDefault, ORACLE_IMAP_2295);
    expect(pass).toBe(false);
    // Line counts differ (3 vs 2) — one structural count diff, not a
    // per-line misalignment.
    expect(diffs).toHaveLength(1);
    expect(diffs[0].path).toBe('imap/line[count]');
  });

  test('AC8: empty imap (base only, no url-bearing objects) on both sides is conformant', () => {
    const baseOnly = 'base referer\n';
    const { pass, diffs } = compareImap(baseOnly, baseOnly);
    expect(pass).toBe(true);
    expect(diffs).toHaveLength(0);
  });

  test('AC9: `base referer` line itself is compared exactly', () => {
    const wrongBase = 'base wrong\nrect https://example.com 9,9 165,40\n';
    const { pass, diffs } = compareImap(wrongBase, ORACLE_IMAP_2295);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.path === 'imap/line[0].token');
    expect(d).toBeDefined();
    expect(d?.actual).toBe('wrong');
    expect(d?.expected).toBe('referer');
  });
});
