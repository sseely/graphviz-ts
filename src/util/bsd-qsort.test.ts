// SPDX-License-Identifier: EPL-2.0

/**
 * Locks the BSD/libc `qsort` tie-ordering reproduction and its load-bearing
 * effect on `TB_balance` rank assignment, via `graphs/mike.gv` edge L→U.
 *
 * Root cause (mission fix-graphs-mike): C `TB_balance` sorts nodes by rank with
 * `LIST_SORT` == libc `qsort` (UNSTABLE) and walks the result mutating a per-rank
 * population count, so the order of equal-rank nodes decides which rank a tied
 * node lands on. JS's stable `Array.prototype.sort` keeps insertion order and
 * diverges: node L lands one rank too high (cy −522 vs oracle −450), forcing the
 * L→U spline to span 2 ranks and over-segment (14 pts vs oracle 8). `gvQsort`
 * reproduces qsort's permutation so L lands on the oracle rank.
 *
 * @see bsd-qsort.ts · lib/common/ns.c:TB_balance · lib/util/list.c:gv_list_sort_
 */

import { describe, it, expect } from 'vitest';
import { gvQsort, heapSort } from './bsd-qsort.js';
import { renderSvg } from '../index.js';

const MIKE = `digraph mike{
  size = "8,8";
  a -> A; a -> m; a -> E; t -> O; r -> V; r -> Q; p -> B; m -> R;
  l -> C; c -> C; W -> X; W -> D; V -> W; T -> U; Q -> T; Q -> H;
  Q -> A; O -> K; L -> U; K -> L; K -> J; K -> E; J -> I; R -> B;
  P -> F; H -> R; H -> P; U -> H; G -> U; E -> G; C -> Z; C -> D;
  S -> D; B -> N; B -> D; B -> S; M -> B; A -> M; N -> Y;
}`;

describe('gvQsort — reproduces libc qsort tie ordering', () => {
  // The mike.gv TB_balance pre-sort node order (name@rank) captured from the
  // port, and the post-sort order captured from the C oracle (MIKEDBG probe of
  // ns.c:TB_balance). A stable sort yields a DIFFERENT equal-rank order, so this
  // case is sensitive: it fails with `Array.prototype.sort`.
  const PRE = 'a@2,A@4,M@5,B@8,D@10,C@9,Z@10,l@8,c@8,W@4,X@5,V@3,r@2,Q@3,T@4,U@5,H@6,R@7,m@3,P@7,F@8,L@3,K@2,E@3,G@4,J@3,I@4,O@1,t@0,S@9,N@9,Y@10,p@7';
  const C_POST = 't@0,O@1,r@2,K@2,a@2,L@3,J@3,E@3,V@3,Q@3,m@3,I@4,W@4,A@4,T@4,G@4,X@5,U@5,M@5,H@6,P@7,R@7,p@7,F@8,c@8,l@8,B@8,S@9,N@9,C@9,D@10,Z@10,Y@10';

  it('matches the C oracle permutation byte-for-byte (mike TB_balance)', () => {
    const items = PRE.split(',').map((s) => {
      const [name, r] = s.split('@');
      return { name, rank: Number(r) };
    });
    // increasingrankcmpf: compare by rank only, 0 on tie (unstable under qsort).
    gvQsort(items, (a, b) => a.rank - b.rank);
    expect(items.map((x) => `${x.name}@${x.rank}`).join(',')).toBe(C_POST);
  });

  it('orders equal keys differently from a stable sort (sensitivity guard)', () => {
    const stable = PRE.split(',').map((s) => {
      const [name, r] = s.split('@');
      return { name, rank: Number(r) };
    });
    stable.sort((a, b) => a.rank - b.rank); // stable: keeps insertion order
    expect(stable.map((x) => `${x.name}@${x.rank}`).join(',')).not.toBe(C_POST);
  });
});

// ---------------------------------------------------------------------------
// heapSort — the introsort depth-limit fallback (never triggered on this
// corpus, but ported per CLAUDE.md "port every branch"). Pinned against the
// system libc `heapsort(3)` (BSD-derived, same lineage as Apple's), invoked
// via a throwaway C driver — not against the graphviz oracle.
// ---------------------------------------------------------------------------

interface Tagged { d: number; tag: number; }

/** Sort by `d` only, tie on `tag` — exercises the permutation of tied keys. */
const byD = (a: Tagged, b: Tagged) => a.d - b.d;

function tagged(pairs: Array<[number, number]>): Tagged[] {
  return pairs.map(([d, tag]) => ({ d, tag }));
}

describe('heapSort — matches libc heapsort(3) (BSD/Apple lineage)', () => {
  // Fixtures and expected permutations captured from a throwaway C driver
  // calling the system heapsort(3) directly (macOS libc; same BSD lineage
  // as Apple's qsort.c fallback). See analysis: R9 residual-cleanup task.
  const cases: Array<{ name: string; input: Array<[number, number]>; expected: Array<[number, number]> }> = [
    {
      name: 'all-tied, n=8 (power-of-two heap shape)',
      input: Array.from({ length: 8 }, (_, i) => [5, i] as [number, number]),
      expected: [[5, 1], [5, 2], [5, 3], [5, 4], [5, 5], [5, 6], [5, 7], [5, 0]],
    },
    {
      name: 'all-tied, n=13 (non-power-of-two)',
      input: Array.from({ length: 13 }, (_, i) => [42, i] as [number, number]),
      expected: Array.from({ length: 13 }, (_, i) => [42, (i + 1) % 13] as [number, number]),
    },
    {
      name: 'descending distinct with a tied run in the middle',
      input: [9, 8, 7, 7, 7, 6, 5, 4, 3, 2, 1, 0].map((d, tag) => [d, tag] as [number, number]),
      expected: [
        [0, 11], [1, 10], [2, 9], [3, 8], [4, 7], [5, 6], [6, 5],
        [7, 2], [7, 4], [7, 3], [8, 1], [9, 0],
      ],
    },
    {
      name: 'reverse-sorted distinct, n=20',
      input: Array.from({ length: 20 }, (_, i) => [20 - i, i] as [number, number]),
      expected: Array.from({ length: 20 }, (_, i) => [i + 1, 19 - i] as [number, number]),
    },
    {
      name: 'two interleaved tied groups, n=16',
      input: Array.from({ length: 16 }, (_, i) => [i % 2, i] as [number, number]),
      expected: [
        [0, 12], [0, 4], [0, 14], [0, 6], [0, 2], [0, 10], [0, 0], [0, 8],
        [1, 13], [1, 11], [1, 5], [1, 9], [1, 15], [1, 7], [1, 3], [1, 1],
      ],
    },
    { name: 'single element', input: [[7, 0]], expected: [[7, 0]] },
    { name: 'two tied elements', input: [[3, 0], [3, 1]], expected: [[3, 1], [3, 0]] },
  ];

  for (const { name, input, expected } of cases) {
    it(`${name}`, () => {
      const items = tagged(input);
      heapSort(items, 0, items.length, byD);
      expect(items.map((x) => [x.d, x.tag])).toEqual(expected);
    });
  }

  it('sorts a sub-range in place, leaving the rest of the array untouched', () => {
    const items = tagged([[9, 0], [3, 1], [3, 2], [1, 3], [8, 4]]);
    heapSort(items, 1, 3, byD); // sort only indices [1,4)
    expect(items.map((x) => [x.d, x.tag])).toEqual([
      [9, 0], [1, 3], [3, 2], [3, 1], [8, 4],
    ]);
  });
});

// ---------------------------------------------------------------------------
// Integration: the fix makes graphs/mike edge L→U conformant with the oracle.
// ---------------------------------------------------------------------------

const Q = String.fromCharCode(34);
const RE_NUM = /-?[0-9.]+/g;

/** Numbers of the first <path d=...> following the given edge <title>. */
function edgePathNums(svg: string, title: string): number[] {
  const re = new RegExp(
    '<title>' + title + '</title>\\s*<path[^>]*\\sd=' + Q + '([^' + Q + ']+)' + Q,
  );
  const m = re.exec(svg);
  if (!m) throw new Error(`edge ${title} not found`);
  return (m[1].match(RE_NUM) ?? []).map(Number);
}

/** cy of the node ellipse for the given node <title>. */
function nodeCy(svg: string, title: string): number {
  const re = new RegExp('<title>' + title + '</title>\\s*<ellipse[^>]*\\scy=' + Q + '(-?[0-9.]+)' + Q);
  const m = re.exec(svg);
  if (!m) throw new Error(`node ${title} not found`);
  return Number(m[1]);
}

describe('graphs/mike — L rank + L→U/K→L geometry vs C oracle', () => {
  const svg = renderSvg(MIKE, 'dot');
  // C oracle (GVBINDIR headless dot, EstimateTextMeasurer parity), mission fix-graphs-mike.
  const LU = [387.79, -434.5, 377.94, -424.92, 364.85, -412.19, 353.68, -401.34];
  const KL = [402.71, -575.59, 402.71, -551.61, 402.71, -508.14, 402.71, -479.42];
  const TOL = 0.01;

  it('node L sits on the oracle rank (cy −450, not −522)', () => {
    expect(Math.abs(nodeCy(svg, 'L') - -450)).toBeLessThanOrEqual(TOL);
  });

  it('L→U is one cubic (8 numbers), not over-segmented (14)', () => {
    const got = edgePathNums(svg, 'L&#45;&gt;U');
    expect(got.length).toBe(8);
    for (let i = 0; i < LU.length; i++) {
      expect(Math.abs(got[i] - LU[i])).toBeLessThanOrEqual(TOL);
    }
  });

  it('K→L (shared node L) is conformant downstream', () => {
    const got = edgePathNums(svg, 'K&#45;&gt;L');
    expect(got.length).toBe(8);
    for (let i = 0; i < KL.length; i++) {
      expect(Math.abs(got[i] - KL[i])).toBeLessThanOrEqual(TOL);
    }
  });
});
