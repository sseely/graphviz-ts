// SPDX-License-Identifier: EPL-2.0
//
// Tests for the semantic JSON comparator (mission: json-conformance, T-json-2).
//
// ORACLE is the real `dot -Tjson` output for `digraph G { a -> b; }` (captured
// from the native oracle, GVBINDIR=/tmp/ghl) — the same probe graph the xdot
// comparator tests use, so the two tracks stay easy to cross-reference.

import { describe, test, expect } from 'vitest';
import { compareJson } from './compare-json.js';

const ORACLE = `{
  "name": "G",
  "directed": true,
  "strict": false,
  "_draw_":
  [
    {
      "op": "c",
      "grad": "none",
      "color": "#fffffe00"
    },
    {
      "op": "C",
      "grad": "none",
      "color": "#ffffff"
    },
    {
      "op": "P",
      "points": [[0.000,0.000],[0.000,108.000],[54.000,108.000],[54.000,0.000]]
    }
  ],
  "bb": "0,0,54,108",
  "xdotversion": "1.7",
  "_subgraph_cnt": 0,
  "objects": [
    {
      "_gvid": 0,
      "name": "a",
      "_draw_":
      [
        {
          "op": "c",
          "grad": "none",
          "color": "#000000"
        },
        {
          "op": "e",
          "rect": [27.000,90.000,27.000,18.000]
        }
      ],
      "_ldraw_":
      [
        {
          "op": "F",
          "size": 14.000,
          "face": "Times-Roman"
        },
        {
          "op": "c",
          "grad": "none",
          "color": "#000000"
        },
        {
          "op": "T",
          "pt": [27.000,85.800],
          "align": "c",
          "width": 6.210,
          "text": "a"
        }
      ],
      "height": "0.5",
      "label": "\\\\N",
      "pos": "27,90",
      "width": "0.75"
    },
    {
      "_gvid": 1,
      "name": "b",
      "_draw_":
      [
        {
          "op": "c",
          "grad": "none",
          "color": "#000000"
        },
        {
          "op": "e",
          "rect": [27.000,18.000,27.000,18.000]
        }
      ],
      "_ldraw_":
      [
        {
          "op": "F",
          "size": 14.000,
          "face": "Times-Roman"
        },
        {
          "op": "c",
          "grad": "none",
          "color": "#000000"
        },
        {
          "op": "T",
          "pt": [27.000,13.800],
          "align": "c",
          "width": 7.000,
          "text": "b"
        }
      ],
      "height": "0.5",
      "label": "\\\\N",
      "pos": "27,18",
      "width": "0.75"
    }
  ],
  "edges": [
    {
      "_gvid": 0,
      "tail": 0,
      "head": 1,
      "_draw_":
      [
        {
          "op": "c",
          "grad": "none",
          "color": "#000000"
        },
        {
          "op": "b",
          "points": [[27.000,71.700],[27.000,64.410],[27.000,55.730],[27.000,47.540]]
        }
      ],
      "_hdraw_":
      [
        {
          "op": "S",
          "style": "solid"
        },
        {
          "op": "c",
          "grad": "none",
          "color": "#000000"
        },
        {
          "op": "C",
          "grad": "none",
          "color": "#000000"
        },
        {
          "op": "P",
          "points": [[30.500,47.620],[27.000,37.620],[23.500,47.620]]
        }
      ],
      "pos": "e,27,36.104 27,71.697 27,64.407 27,55.726 27,47.536"
    }
  ]
}`;

describe('compareJson', () => {
  test('identical json passes', () => {
    const { pass, diffs } = compareJson(ORACLE, ORACLE);
    expect(pass).toBe(true);
    expect(diffs).toHaveLength(0);
  });

  test('numeric difference within tolerance (0.005 < 0.01) passes', () => {
    const near = ORACLE.replace('"rect": [27.000,90.000,27.000,18.000]', '"rect": [27.000,90.005,27.000,18.000]');
    const { pass, diffs } = compareJson(near, ORACLE);
    expect(pass).toBe(true);
    expect(diffs).toHaveLength(0);
  });

  test('numeric difference beyond tolerance surfaces as a numeric diff', () => {
    const far = ORACLE.replace('"rect": [27.000,90.000,27.000,18.000]', '"rect": [27.000,90.5,27.000,18.000]');
    const { pass, diffs } = compareJson(far, ORACLE);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.object === 'node:a' && x.attr === '_draw_');
    expect(d).toBeDefined();
    expect(d?.kind).toBe('numeric');
    expect(d?.delta).toBeCloseTo(0.5, 5);
  });

  test('missing node object surfaces as missing-object', () => {
    // Drop node "b" from the objects array and its edge reference (tail=0
    // head=1 would now dangle) — simulate the port omitting a node entirely.
    const noB = ORACLE.replace(
      /,\s*\{\s*"_gvid": 1,\s*"name": "b",[\s\S]*?"width": "0\.75"\s*\}/,
      '',
    );
    const { pass, diffs } = compareJson(noB, ORACLE);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.object === 'node:b');
    expect(d).toBeDefined();
    expect(d?.path).toBe('node:b[missing-object]');
    expect(d?.kind).toBe('structural');
  });

  test('draw-op array mismatch (empty vs populated) surfaces as op-count structural diff', () => {
    // Mirrors the port's actual current behavior: _draw_ present but empty.
    const empty = ORACLE.replace(
      /"_draw_":\s*\n\s*\[\s*\{\s*"op": "c",\s*"grad": "none",\s*"color": "#000000"\s*\},\s*\{\s*"op": "e",\s*"rect": \[27\.000,90\.000,27\.000,18\.000\]\s*\}\s*\]/,
      '"_draw_": []',
    );
    const { pass, diffs } = compareJson(empty, ORACLE);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.object === 'node:a' && x.attr === '_draw_' && x.path.endsWith('[opCount]'));
    expect(d).toBeDefined();
    expect(d?.kind).toBe('structural');
    expect(d?.actual).toBe('0');
    expect(d?.expected).toBe('2');
  });

  test('op kind mismatch surfaces as structural op.kind diff', () => {
    const wrongKind = ORACLE.replace('"op": "e",\n          "rect"', '"op": "E",\n          "rect"');
    const { pass, diffs } = compareJson(wrongKind, ORACLE);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.path.endsWith('.kind') && x.object === 'node:a');
    expect(d).toBeDefined();
    expect(d?.kind).toBe('structural');
    expect(d?.actual).toBe('E');
    expect(d?.expected).toBe('e');
  });

  test('wrong pen color surfaces as canonicalized value diff', () => {
    const red = ORACLE.replace(
      '"op": "c",\n          "grad": "none",\n          "color": "#000000"\n        },\n        {\n          "op": "e"',
      '"op": "c",\n          "grad": "none",\n          "color": "red"\n        },\n        {\n          "op": "e"',
    );
    const { pass, diffs } = compareJson(red, ORACLE);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.object === 'node:a' && x.path.endsWith('.color'));
    expect(d).toBeDefined();
    expect(d?.kind).toBe('value');
    expect(d?.actual).toBe('#ff0000');
    expect(d?.expected).toBe('#000000');
  });

  test('cosmetic differences are invisible (key order, whitespace)', () => {
    const reordered = JSON.stringify(JSON.parse(ORACLE));
    const { pass, diffs } = compareJson(reordered, ORACLE);
    expect(diffs).toEqual([]);
    expect(pass).toBe(true);
  });

  test('missing graph-level attr (e.g. xdotversion, matches the port gap) surfaces as missing', () => {
    const noVersion = ORACLE.replace(',\n  "xdotversion": "1.7"', '');
    const { pass, diffs } = compareJson(noVersion, ORACLE);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.object === '[graph]' && x.attr === 'xdotversion');
    expect(d).toBeDefined();
    expect(d?.kind).toBe('structural');
  });

  test('_subgraph_cnt mismatch surfaces as a graph structural value diff', () => {
    const withSubg = ORACLE.replace('"_subgraph_cnt": 0', '"_subgraph_cnt": 1');
    const { pass, diffs } = compareJson(ORACLE, withSubg);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.object === '[graph]' && x.attr === '_subgraph_cnt');
    expect(d).toBeDefined();
    expect(d?.actual).toBe('0');
    expect(d?.expected).toBe('1');
  });

  // -------------------------------------------------------------------------
  // Member-list (subgraph nodes/edges/subgraphs) deep comparison
  // -------------------------------------------------------------------------

  // Two clusters, one node each, cross-referenced by _gvid. The port uses a
  // DIFFERENT gid numbering than the oracle (subgraphs and nodes swapped in
  // order) to prove the comparison is by resolved identity, not raw gid.
  const SUBG_ORACLE = `{
    "name": "G", "directed": true, "strict": false, "_subgraph_cnt": 2,
    "objects": [
      { "name": "cluster0", "_gvid": 0, "nodes": [2] },
      { "name": "cluster1", "_gvid": 1, "nodes": [3] },
      { "_gvid": 2, "name": "a", "pos": "1,1" },
      { "_gvid": 3, "name": "b", "pos": "2,2" }
    ],
    "edges": [ { "_gvid": 0, "tail": 2, "head": 3 } ]
  }`;

  test('member node lists match by identity despite different gid numbering', () => {
    // Port numbers cluster1 first (gid 0) and node b before a, so the raw gids
    // differ, but each cluster still references its own node by name.
    const SUBG_PORT = `{
      "name": "G", "directed": true, "strict": false, "_subgraph_cnt": 2,
      "objects": [
        { "name": "cluster1", "_gvid": 0, "nodes": [2] },
        { "name": "cluster0", "_gvid": 1, "nodes": [3] },
        { "_gvid": 2, "name": "b", "pos": "2,2" },
        { "_gvid": 3, "name": "a", "pos": "1,1" }
      ],
      "edges": [ { "_gvid": 0, "tail": 3, "head": 2 } ]
    }`;
    const { pass, diffs } = compareJson(SUBG_PORT, SUBG_ORACLE);
    expect(diffs).toEqual([]);
    expect(pass).toBe(true);
  });

  test('wrong member node surfaces as a members structural diff', () => {
    // Port's cluster0 lists node "b" (gid 3) instead of "a" (gid 2).
    const SUBG_PORT = SUBG_ORACLE.replace(
      '{ "name": "cluster0", "_gvid": 0, "nodes": [2] }',
      '{ "name": "cluster0", "_gvid": 0, "nodes": [3] }',
    );
    const { pass, diffs } = compareJson(SUBG_PORT, SUBG_ORACLE);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.object === 'cluster:cluster0' && x.attr === 'nodes');
    expect(d).toBeDefined();
    expect(d?.path).toBe('cluster:cluster0/nodes[members]');
    expect(d?.kind).toBe('structural');
    expect(d?.actual).toBe('b');
    expect(d?.expected).toBe('a');
  });

  test('member list present on one side only surfaces as structural diff', () => {
    const SUBG_PORT = SUBG_ORACLE.replace(', "nodes": [2] }', ' }');
    const { pass, diffs } = compareJson(SUBG_PORT, SUBG_ORACLE);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.object === 'cluster:cluster0' && x.attr === 'nodes');
    expect(d).toBeDefined();
    expect(d?.actual).toBe('<absent>');
    expect(d?.expected).toBe('<member-list>');
  });

  test('malformed JSON on the port side surfaces as a parse diff', () => {
    const { pass, diffs } = compareJson('{ not json', ORACLE);
    expect(pass).toBe(false);
    expect(diffs[0].object).toBe('[parse]');
    expect(diffs[0].attr).toBe('port');
    expect(diffs[0].kind).toBe('parse');
  });
});
