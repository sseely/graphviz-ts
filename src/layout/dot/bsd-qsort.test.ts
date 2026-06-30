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
import { gvQsort } from './bsd-qsort.js';
import { renderSvg } from '../../index.js';

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
