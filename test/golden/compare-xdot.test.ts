// SPDX-License-Identifier: EPL-2.0
//
// Tests for the semantic xdot comparator (mission: xdot-conformance, T2).
//
// The fixtures are hand-written xdot DOT-text pairs modeled on the a->b probe
// (fix-loop.md). They assert the comparator's contract: cosmetic differences
// (formatting, attr order, named-vs-hex color, the `node [label="\N"]` line) are
// invisible; real geometry / color / structure differences surface with a
// classified diff at a stable path.

import { describe, test, expect } from 'vitest';
import { compareXdot, canonColor, canonFont } from './compare-xdot.js';

const ORACLE_AB = `digraph {
\tgraph [_draw_="c 9 -#fffffe00 C 7 -#ffffff P 4 0 0 0 108 54 108 54 0 ",
\t\tbb="0,0,54,108",
\t\txdotversion=1.7
\t];
\tnode [label="\\N"];
\ta\t[_draw_="c 7 -#ff0000 e 27 90 27 18 ",
\t\t_ldraw_="F 14 11 -Times-Roman c 7 -#000000 T 27 85.8 0 6.21 1 -a ",
\t\tcolor=red,
\t\theight=0.5,
\t\tpos="27,90",
\t\twidth=0.75];
\tb\t[_draw_="c 7 -#000000 e 27 18 27 18 ",
\t\t_ldraw_="F 14 11 -Times-Roman c 7 -#000000 T 27 13.8 0 7 1 -b ",
\t\theight=0.5,
\t\tpos="27,18",
\t\twidth=0.75];
\ta -> b\t[_draw_="c 7 -#000000 B 4 27 71.7 27 64.41 27 55.73 27 47.54 ",
\t\t_hdraw_="S 5 -solid c 7 -#000000 C 7 -#000000 P 3 30.5 47.62 27 37.62 23.5 47.62 ",
\t\tpos="e,27,36.104 27,71.697 27,64.407 27,55.726 27,47.536"];
}`;

describe('compareXdot', () => {
  test('AC1: identical xdot passes', () => {
    const { pass, diffs } = compareXdot(ORACLE_AB, ORACLE_AB);
    expect(pass).toBe(true);
    expect(diffs).toHaveLength(0);
  });

  test('AC2: cosmetic differences are invisible (formatting, .75, named color, attr order)', () => {
    // Same semantics, wildly different formatting: spaces not commas, `.75`,
    // `red`/`black` names instead of hex, attributes reordered, no `node [...]`.
    const cosmetic = `digraph {
\tgraph [xdotversion="1.7" bb="0,0,54,108" _draw_="c 9 -#fffffe00 C 7 -#ffffff P 4 0 0 0 108 54 108 54 0 "];
\ta [width=.75 pos="27,90" height=.5 color=red _draw_="c 3 -red e 27 90 27 18 " _ldraw_="F 14 11 -Times-Roman c 5 -black T 27 85.8 0 6.21 1 -a "];
\tb [pos="27,18" _draw_="c 7 -#000000 e 27 18 27 18 " _ldraw_="F 14 11 -Times-Roman c 5 -black T 27 13.8 0 7 1 -b " width=.75 height=.5];
\ta -> b [pos="e,27,36.104 27,71.697 27,64.407 27,55.726 27,47.536" _draw_="c 7 -#000000 B 4 27 71.7 27 64.41 27 55.73 27 47.54 " _hdraw_="S 5 -solid c 7 -#000000 C 7 -#000000 P 3 30.5 47.62 27 37.62 23.5 47.62 "];
}`;
    const { pass, diffs } = compareXdot(cosmetic, ORACLE_AB);
    expect(diffs).toEqual([]);
    expect(pass).toBe(true);
  });

  test('AC3: within-tolerance numeric difference passes (0.005 < 0.01)', () => {
    const near = ORACLE_AB.replace('e 27 90 27 18', 'e 27 90.005 27 18');
    const { pass } = compareXdot(near, ORACLE_AB);
    expect(pass).toBe(true);
  });

  test('AC4: y-inversion (F1) surfaces as a numeric ellipse diff on node a', () => {
    // Port emits node a's ellipse at y=18 instead of 90 (108-90 inversion).
    const inverted = ORACLE_AB.replace(
      'a\t[_draw_="c 7 -#ff0000 e 27 90 27 18 "',
      'a\t[_draw_="c 7 -#ff0000 e 27 18 27 18 "',
    );
    const { pass, diffs } = compareXdot(inverted, ORACLE_AB);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.object === 'node:a' && x.attr === '_draw_');
    expect(d).toBeDefined();
    expect(d?.kind).toBe('numeric');
    expect(d?.delta).toBeGreaterThan(0.01);
  });

  test('AC5: missing _ldraw_ (F3 label routing) surfaces as a structural diff', () => {
    const noLabel = ORACLE_AB.replace(
      /\n\t\t_ldraw_="F 14 11 -Times-Roman c 7 -#000000 T 27 85.8 0 6.21 1 -a ",/,
      '',
    );
    const { pass, diffs } = compareXdot(noLabel, ORACLE_AB);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.object === 'node:a' && x.attr === '_ldraw_');
    expect(d).toBeDefined();
    expect(d?.kind).toBe('structural');
  });

  test('AC6: wrong pen color (F2) surfaces as a canonicalized value diff', () => {
    // Port draws node a black instead of red — a real semantic difference.
    const black = ORACLE_AB.replace(
      'a\t[_draw_="c 7 -#ff0000 e 27 90 27 18 "',
      'a\t[_draw_="c 7 -#000000 e 27 90 27 18 "',
    );
    const { pass, diffs } = compareXdot(black, ORACLE_AB);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.object === 'node:a' && x.path.includes('.color'));
    expect(d).toBeDefined();
    expect(d?.kind).toBe('value');
    expect(d?.actual).toBe('#000000');
    expect(d?.expected).toBe('#ff0000');
  });

  test('AC7: missing edge draw (F3 edge routing) surfaces as a missing object/attr', () => {
    // Port emits `a -> b;` with no draw attributes at all.
    const noEdgeDraw = ORACLE_AB.replace(
      /\ta -> b\t\[[^\]]*\];/,
      '\ta -> b;',
    );
    const { pass, diffs } = compareXdot(noEdgeDraw, ORACLE_AB);
    expect(pass).toBe(false);
    const d = diffs.find((x) => x.object === 'edge:a->b#0');
    expect(d).toBeDefined();
  });

  test('AC8: missing graph background (F4) surfaces as a missing graph object', () => {
    const noBg = ORACLE_AB.replace(
      /\tgraph \[_draw_="[^"]*",\n\t\tbb/,
      '\tgraph [bb',
    );
    const { pass, diffs } = compareXdot(noBg, ORACLE_AB);
    expect(pass).toBe(false);
    // Root graph loses its only draw attr → the `[graph]` object vanishes from
    // the port inventory → missing-object diff.
    const d = diffs.find((x) => x.object === '[graph]');
    expect(d).toBeDefined();
  });

  test('canonColor: named, hex-case, and rgb all collapse to lowercase #rrggbb', () => {
    expect(canonColor('red')).toBe('#ff0000');
    expect(canonColor('#FF0000')).toBe('#ff0000');
    expect(canonColor('black')).toBe('#000000');
    expect(canonColor('#ffffff')).toBe('#ffffff');
  });

  test('canonColor: partial alpha becomes #rrggbbaa', () => {
    expect(canonColor('#fffffe00')).toBe('#fffffe00');
  });

  test('canonFont: cosmetic normalization only — distinct faces stay distinct', () => {
    expect(canonFont('Times-Roman')).toBe(canonFont('"Times-Roman"'));
    expect(canonFont('Times,serif')).not.toBe(canonFont('Times-Roman'));
  });
});
