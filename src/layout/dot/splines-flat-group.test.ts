// SPDX-License-Identifier: EPL-2.0

/**
 * RED oracle test — adjacent-flat edge grouping (#241_0, nodes 2↔3).
 *
 * C `dot_splines_` groups all three adjacent flat edges between nodes 2 and 3
 * into ONE `make_flat_adj_edges` call (cnt=3). The port dispatches each edge
 * in isolation (cnt=1), so the back-edge `3:sw->2:se` is routed as a forward
 * edge in its own aux → straight spline (size=4) instead of a back-edge curl
 * (size=7).
 *
 * RED until T2 grouping lands (edge-route.ts caller-side grouping pass).
 *
 * ## C oracle (dot 15.0.0 / native, clean binary, 2026-06-20):
 *
 * edge11 — 2:ne->3:nw (forward, already correct in port shape):
 *   d="M185.02,-40.9C186.01,-41.89 184.88,-43.06 186.02,-43.88
 *      191.39,-47.75 206.14,-48.86 217.03,-45.95"
 *   7 coord-pairs, Y-range ≈ 7.96pt (curl)
 *
 * edge12 — 3:sw->2:se (back edge, BUG — port emits size=4 straight):
 *   C oracle:
 *     d="M228.98,-10.86C227.99,-9.87 229.12,-8.7 227.98,-7.88
 *        216.52,0.37 206.01,1.79 195.86,-3.95"
 *     7 coord-pairs, Y-range ≈ 12.65pt (curl)
 *   Port (current / buggy):
 *     d="M227.98,-2.98C217.82,-2.98 207.66,-2.98 197.49,-2.98"
 *     4 coord-pairs, Y-range = 0pt (straight line)
 *
 * ## AD-1 resolution (from T1 C instrumentation, 2026-06-20):
 *   e0_tail=2, e0_head=3 (e0 is normalized-forward; `tn`=node2 determines auxt)
 *   edges[0]: 3->2 (back edge, lower AGSEQ=2)
 *   edges[1]: 2->3 (forward ne->nw, same main AGSEQ=2)
 *   edges[2]: 2->3 (forward e->w, same main AGSEQ=2)
 *   auxt cloned from: 2  (tn = agtail(e0) = node2)
 *   auxh cloned from: 3
 *   aux_spline sizes: 2->3 size=7, 2->3 size=4, 2->3 size=4, 3->2 size=7
 *
 * @see plans/group-adjacent-flats/findings-ordering-contract.md
 * @see lib/dotgen/dotsplines.c:make_flat_adj_edges, make_flat_edge
 * @see src/layout/dot/edge-route.ts:routeFaithfulSidePort
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

// The 241_0.dot source (from ~/git/graphviz/tests/241_0.dot), inlined to avoid
// filesystem dependency. The red edges between nodes 2 and 3 are the target.
const DOT_241_0 = `\
digraph {
  splines=true
  { rank=same
    0 [label="("]
    1 [label="("]
    2 [label=A]
    3 [label="*"]
    4 [label=B]
    5 [label="|"]
    6 [label=A]
    7 [label=C]
    8 [label=")"]
    9 [label=D]
    10 [label=")"]
    5 -> 6 [style=invis]
    2:e -> 3:w
    4:e -> 5:w
    6:e -> 7:w
    7:e -> 8:w
    9:e -> 10:w
    0:e -> 1:w [color=red]
    1:e -> 2:w [color=red]
    3:e -> 4:w [color=red]
    8:e -> 9:w [color=red]
    2:ne -> 3:nw [color=red]
    3:sw -> 2:se [color=red]
    1:se -> 6:sw [color=red]
    5:ne -> 8:nw [color=red]
  }
}`;

// ---------- SVG parsing helpers ----------

interface Pt { x: number; y: number; }

const Q = String.fromCharCode(34);
const RE_EDGE = new RegExp(
  '<g[^>]*class=' + Q + 'edge' + Q + '[^>]*>[\\s\\S]*?</g>',
  'g',
);
const RE_TITLE = /<title>([^<]+)<\/title>/;
const RE_PATH = new RegExp('\\sd=' + Q + '(M[^' + Q + ']+)' + Q);
const RE_NUM = /-?[0-9]+(?:\.[0-9]+)?/g;

interface EdgePath {
  title: string;
  pts: Pt[];
}

/** Parse the d="M..." coordinate pairs from an SVG path string. */
function parsePts(d: string): Pt[] {
  const nums = d.match(RE_NUM) ?? [];
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: Number(nums[i]), y: Number(nums[i + 1]) });
  }
  return pts;
}

/** Extract all edge paths from the SVG, keyed by unescaped title. */
function edgePaths(svg: string): EdgePath[] {
  const out: EdgePath[] = [];
  let m: RegExpExecArray | null;
  RE_EDGE.lastIndex = 0;
  while ((m = RE_EDGE.exec(svg)) !== null) {
    const block = m[0];
    const titleM = RE_TITLE.exec(block);
    const pathM = RE_PATH.exec(block);
    if (!titleM || !pathM) continue;
    // Unescape &#45; → -
    const title = titleM[1].replace(/&#45;/g, '-').replace(/&#62;/g, '>');
    out.push({ title, pts: parsePts(pathM[1]) });
  }
  return out;
}

function yRange(pts: Pt[]): number {
  const ys = pts.map(p => p.y);
  return Math.max(...ys) - Math.min(...ys);
}

// ---------- Tests ----------

/**
 * GUARD: forward edge 2:ne->3:nw must ALREADY be a 7-point curl.
 * GREEN now; must stay GREEN after T2.
 * C oracle: 7 pts, Y-range ≈ 7.96pt. Port: same shape, Y-shifted ~7.88pt.
 */
function assertFwdCurl(svg: string): void {
  const edges = edgePaths(svg);
  const fwd = edges.find(e => e.title.includes('2:ne') && e.title.includes('3:nw'));
  expect(fwd).toBeDefined();
  expect(fwd!.pts.length).toBe(7);
  expect(yRange(fwd!.pts)).toBeGreaterThan(5);
}

/**
 * RED: back edge 3:sw->2:se must be a 7-point curl (size=7), not a
 * 4-point straight line (size=4).
 * C oracle: 7 pts, Y-range ≈ 12.65pt. Port bug: 4 pts, Y-range = 0.
 * RED until T2 grouping lands.
 */
function assertBackCurl(svg: string): void {
  const edges = edgePaths(svg);
  const back = edges.find(e => e.title.includes('3:sw') && e.title.includes('2:se'));
  expect(back).toBeDefined();
  expect(back!.pts.length).toBe(7);
  expect(yRange(back!.pts)).toBeGreaterThan(10);
}

// 1949.dot (from ~/git/graphviz/tests/1949.dot), reduced to ASCII-safe inline
// form. The T10b target is the flat-adj pair structParty <-> structDefaultAuto
// under rankdir=LR (the `:S` and `:N` compass-port edges).
const DOT_1949 = `\
digraph G {
rankdir=LR;
bgcolor=transparent;
node[fontsize=8 shape=box];
edge[fontsize=8, arrowsize=0.7];
compound=true;
remincross=true;
nodesep=0.4;
ranksep=.4;
structDefaultroot->structC[label=<  > fontname=Arial, style=dotted];
structHell:W -> structDefaultDunkel[labeldistance = 2.0, taillabel=<evE...>  color=black, fontname=Arial,fontcolor=black lhead=clusterDunkel];//Hell Dunkel
structDefaultDunkel->structHell:SE[labeldistance=2.0, headlabel=<evE...>  color=black, fontname=Arial,fontcolor=black ltail=clusterDunkel];//Dunkel structHell
structNichtsErkannt->structEtwasErkannt[label=<evP...>  color=black, fontname=Arial, fontcolor=black]; //NichtsErkannt EtwasErkannt
structEtwasErkannt->structNichtsErkannt[label=<evP...>  color=black, fontname=Arial, fontcolor=black]; //EtwasErkannt NichtsErkannt
structDefaultDunkel->structNichtsErkannt[label=<  > fontname=Arial, style=dotted];
structC -> structDefaultAuto[labeldistance = 2.0, taillabel=<&#91;au...>  color=black, fontname=Arial,fontcolor=black lhead=clusterAuto];//C Auto
structC->structParty[label=<&#91;el...>  color=black, fontname=Arial, fontcolor=black]; //C Party
structDefaultAuto->structHell[label=<  > fontname=Arial, style=dotted];
structDefaultAuto->structParty:N[labeldistance=2.0, headlabel=<evP...>  color=black, fontname=Arial,fontcolor=black ltail=clusterAuto];//Auto structParty
structParty:S -> structDefaultAuto[labeldistance=2.0, taillabel=<evA...> color=blue, fontname=Arial, fontcolor=blue lhead=clusterAuto];//Party Auto
structEtwasErkannt->structEtwasErkannt[label=<evE...>  color=black, fontname=Arial, fontcolor=black]; //EtwasErkannt EtwasErkannt
structParty->structFinale[label=<evE...> color=blue, fontname=Arial, fontcolor=blue]; //Party Finale
structDefaultAuto->structFinale[labeldistance=2.0, headlabel=<evE...>  color=black, fontname=Arial,fontcolor=black ltail=clusterAuto];//Auto structFinale
structDefaultroot[shape=circle, fontsize=8, height=0.5, width=0.5, fixedsize=true, fontname=Arial, fontcolor=white,fillcolor=black,  style=filled label=< <TABLE BORDER="0"><TR><TD PORT="NW"></TD> <TD PORT="N"></TD> <TD PORT="NE"></TD></TR><TR><TD PORT="W"> </TD> <TD BORDER="0" ALIGN="CENTER"> <FONT COLOR="white"> </FONT>  </TD> <TD PORT="E"></TD></TR><TR><TD PORT="SW"></TD><TD PORT="S"></TD><TD PORT="SE"></TD></TR></TABLE> >];
structParty[penwidth="1" style=rounded BORDER="1" color="red" fontname=Arial label=< <TABLE STYLE="rounded" BORDER="0" CELLBORDER="0">
<TR><TD PORT="NW"></TD><TD PORT="N"></TD><TD PORT="NE"></TD></TR>
<TR><TD PORT="W"></TD> <TD BORDER="1" SIDES="B">Party</TD><TD PORT="E"></TD></TR>
<TR><TD COLSPAN="3" ALIGN="LEFT">Entry:<br ALIGN="LEFT"/>lic...</TD></TR>
<TR><TD PORT="SW"></TD><TD PORT="S"></TD><TD PORT="SE"></TD></TR>
</TABLE> >];

subgraph "clusterAuto"{fontname=Arial; fontsize=8
color=black; style=rounded;
 label=< <TABLE BORDER="0" ><TR><TD PORT="E"></TD><TD BORDER="1" SIDES="B"> Auto </TD><TD PORT="E"></TD></TR></TABLE> >;

structHell[penwidth="1" style=rounded BORDER="1" color="black" fontname=Arial label=< <TABLE STYLE="rounded" BORDER="0" CELLBORDER="0">
<TR><TD PORT="NW"></TD><TD PORT="N"></TD><TD PORT="NE"></TD></TR>
<TR><TD PORT="W"></TD> <TD BORDER="1" SIDES="B">Hell</TD><TD PORT="E"></TD></TR>
<TR><TD COLSPAN="3" ALIGN="LEFT">Entry:<br ALIGN="LEFT"/>lic...</TD></TR>
<TR><TD PORT="SW"></TD><TD PORT="S"></TD><TD PORT="SE"></TD></TR>
</TABLE> >];

subgraph "clusterDunkel"{fontname=Arial; fontsize=8
color=black; style=rounded;
 label=< <TABLE BORDER="0" ><TR><TD PORT="E"></TD><TD BORDER="1" SIDES="B"> Dunkel </TD><TD PORT="E"></TD></TR></TABLE> >;
structDefaultDunkel[shape=circle, fontsize=8, height=0.5, width=0.5, fixedsize=true, fontname=Arial, fontcolor=white,fillcolor=black,  style=filled label=< <TABLE BORDER="0"><TR><TD PORT="NW"></TD> <TD PORT="N"></TD> <TD PORT="NE"></TD></TR><TR><TD PORT="W"> </TD> <TD BORDER="0" ALIGN="CENTER"> <FONT COLOR="white"> </FONT>  </TD> <TD PORT="E"></TD></TR><TR><TD PORT="SW"></TD><TD PORT="S"></TD><TD PORT="SE"></TD></TR></TABLE> >];
structNichtsErkannt[penwidth="1" style=rounded BORDER="1" color="black" fontname=Arial label=< <TABLE STYLE="rounded" BORDER="0" CELLBORDER="0">
<TR><TD PORT="NW"></TD><TD PORT="N"></TD><TD PORT="NE"></TD></TR>
<TR><TD PORT="W"></TD> <TD BORDER="1" SIDES="B">NichtsErkannt</TD><TD PORT="E"></TD></TR>
<TR><TD COLSPAN="3" ALIGN="LEFT">Entry:<br ALIGN="LEFT"/>lic...</TD></TR>
<TR><TD PORT="SW"></TD><TD PORT="S"></TD><TD PORT="SE"></TD></TR>
</TABLE> >];


structEtwasErkannt[penwidth="1" style=rounded BORDER="1" color="black" fontname=Arial label=< <TABLE STYLE="rounded" BORDER="0" CELLBORDER="0">
<TR><TD PORT="NW"></TD><TD PORT="N"></TD><TD PORT="NE"></TD></TR>
<TR><TD PORT="W"></TD> <TD BORDER="1" SIDES="B">EtwasErkannt</TD><TD PORT="E"></TD></TR>
<TR><TD COLSPAN="3" ALIGN="LEFT">Entry:<br ALIGN="LEFT"/>lic...</TD></TR>
<TR><TD PORT="SW"></TD><TD PORT="S"></TD><TD PORT="SE"></TD></TR>
</TABLE> >];

};

structDefaultAuto[shape=circle, fontsize=8, height=0.5, width=0.5, fixedsize=true, fontname=Arial, fontcolor=white,fillcolor=black,  style=filled label=< <TABLE BORDER="0"><TR><TD PORT="NW"></TD> <TD PORT="N"></TD> <TD PORT="NE"></TD></TR><TR><TD PORT="W"> </TD> <TD BORDER="0" ALIGN="CENTER"> <FONT COLOR="white"> </FONT>  </TD> <TD PORT="E"></TD></TR><TR><TD PORT="SW"></TD><TD PORT="S"></TD><TD PORT="SE"></TD></TR></TABLE> >];};

structFinale[label=< >,shape=doublecircle, width=0.4, fontname=Arial, fillcolor=black, fixedsize=true, height=0.2, width=0.2, style=filled];
structC [label=<  > shape=diamond, fixedsize=true, height=0.2, width=0.2, fontname=Arial color=black];

}
`;

describe('flat-group #241_0 — adjacent flat edges 2↔3', () => {
  it('GUARD: 2:ne->3:nw forward edge is already a curl (7 pts, Y-range > 5pt)', () => {
    assertFwdCurl(renderSvg(DOT_241_0, 'dot'));
  });

  // GREEN (closed): the aux back-edge clone (auxh->auxt, a regular adjacent-rank
  // back edge in the aux) now curls (size 7). Root fix: makeFwdEdge SWAPS the
  // ports instead of stripping them, matching C makefwdedge, so the sw/se corner
  // ports survive into the forward view and make_regular_edge curls the spline.
  // @see lib/dotgen/dotsplines.c:makefwdedge
  // @see plans/aux-back-edge-curl/findings-curl-mechanism.md
  it('3:sw->2:se back edge is a curl — 7 pts AND Y-range > 10pt', () => {
    assertBackCurl(renderSvg(DOT_241_0, 'dot'));
  });
});

// ---------- T10b: flat-adj copied-spline normalization (discriminator) ----------

/**
 * T10b regression — C's flat-adj splines are copied UN-normalized from the aux
 * (`dot_splines_(auxg, 0)`) and reversed only by the TOP-LEVEL edge_normalize,
 * keyed on the MAIN edge's flat ORDER predicate (swap_ends_p: ND_order(head) <
 * ND_order(tail)). The port's aux router swaps by the aux edge's RANK predicate
 * (always true for back-edge clones); the two disagree exactly when a back-edge
 * clone belongs to a low-order→high-order main edge (1949 `structParty:S->
 * structDefaultAuto` under rankdir=LR). Verified against native dot 15.1.0
 * (T10b C instrumentation, 2026-07-04).
 * @see lib/dotgen/dotsplines.c:edge_normalize, swap_ends_p, make_flat_adj_edges
 * @see src/layout/dot/splines-flat.ts:normalizeCopiedFlatSpline
 */
describe('T10b — flat-adj spline direction follows C top-level edge_normalize', () => {
  it('241_0: 3:sw->2:se stays tail→head (starts at node 3, right of node 2)', () => {
    // Both predicates true (ND_order(2)=2 < ND_order(3)=3): the aux swap
    // matches C's normalize — spline must run tail(3, right) → head(2, left).
    const edges = edgePaths(renderSvg(DOT_241_0, 'dot'));
    const back = edges.find(e => e.title.includes('3:sw') && e.title.includes('2:se'));
    expect(back).toBeDefined();
    const pts = back!.pts;
    expect(pts[0].x).toBeGreaterThan(pts[pts.length - 1].x);
  });

  it('1949: structParty:S->structDefaultAuto stays head→tail (C normalize quirk)', () => {
    // Main predicate FALSE (ND_order(structParty)=0 < ND_order(structDefaultAuto)=1):
    // C leaves the aux-forward geometry alone, so the final spline runs
    // head (clusterAuto side, above) → tail (structParty:S, below): first point
    // is the HIGHEST point of the path (most negative SVG y) and the last point
    // is the LOWEST. Native oracle: M176.53,-102.39 ... 158.3,-7.97.
    // Pre-fix the port emitted the reverse (M158.3,-24.09 ... 184.32,-94.33),
    // which mislaid the evA taillabel and grew the canvas by +16.12.
    const edges = edgePaths(renderSvg(DOT_1949, 'dot'));
    const s = edges.find(e => e.title.startsWith('structParty:S')
      && e.title.endsWith('structDefaultAuto'));
    expect(s).toBeDefined();
    const pts = s!.pts;
    const ys = pts.map(p => p.y);
    expect(pts[0].y).toBe(Math.min(...ys)); // starts at the top (head side)
    // ends far below the start, at structParty:S (native: -102.39 → -7.97)
    expect(pts[pts.length - 1].y).toBeGreaterThan(pts[0].y + 50);
  });

  it('1949: canvas height matches native (282pt, no +16 bb growth)', () => {
    // The reversed :S spline made place_portlabel read the taillabel off the
    // wrong end, and updateBB grew the root bb by 16.12pt. Guard the height.
    const svg = renderSvg(DOT_1949, 'dot');
    const m = /height="(\d+)pt"/.exec(svg);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(282);
  });
});

/**
 * F1 (followup-residuals) — the two #1949 discriminators that took the flat
 * pair from structural-match to conformant. Native oracle: dot 15.1.0.
 *
 * 1. makefwdedge lead normalization: `structDefaultAuto->structParty:N` is a
 *    lone all-backward flat group (ND_order(structDefaultAuto)=1 >
 *    ND_order(structParty)=0). C's make_flat_edge forward-normalizes edges[0]
 *    via makefwdedge before make_flat_adj_edges, so tn is ALWAYS the
 *    lower-order endpoint; without it the port mirrored auxt/auxh and the :N
 *    clone became an aux BACK edge that fell off the faithful path entirely.
 *    @see lib/dotgen/dotsplines.c:make_flat_edge, setflags (FLATEDGE order)
 *
 * 2. Stale aux arrow attrs: inside the cloned aux dictionary C's arrow_length
 *    resolves E_arrowsz/E_penwidth through un-remapped main-graph symbol ids
 *    (setState skips them) — for 1949 the misindexed slot holds `color`
 *    ("black"/"blue"), strtod fails, and the backoff is computed with
 *    arrowsize=1.0 instead of the edge's 0.7 (11.48 vs 8.48; delta ≈ 3). The
 *    final curve therefore stops 3pt SHORT of the 0.7-scaled arrow base.
 *    @see lib/dotgen/dotsplines.c:setState; lib/common/arrows.c:arrow_length
 */
describe('F1 — #1949 makefwdedge lead normalization + stale aux arrow attrs', () => {
  it(':N edge routes through the aux as a forward clone (native geometry)', () => {
    // Native: M158.3,-74.25 C158.3,-86.4 158.3,-98.91 158.3,-109.84 — a
    // vertical faithful-aux spline. Pre-fix the mirrored aux produced no
    // spline and the edge fell back to the fitter (start ≈ -36, curved).
    const edges = edgePaths(renderSvg(DOT_1949, 'dot'));
    const n = edges.find(e => e.title.startsWith('structDefaultAuto')
      && e.title.endsWith('structParty:N'));
    expect(n).toBeDefined();
    const pts = n!.pts;
    expect(pts.length).toBe(4);
    for (const p of pts) expect(p.x).toBeCloseTo(158.3, 1);
    expect(pts[pts.length - 1].y).toBeCloseTo(-109.84, 1);
    // Stale-attr backoff: the curve starts at -74.25 (arrowsize-1.0 backoff),
    // 3pt short of the 0.7-scaled arrow base at ≈-71.28. A port that resolves
    // the aux edge's real arrowsize=0.7 starts at -71.25 instead.
    expect(pts[0].y).toBeCloseTo(-74.25, 1);
  });

  it(':S edge leaves structParty:S at the native point (176.53,-102.39)', () => {
    // The :S group shares the aux frame with the :N group only through the
    // postprocess translation; the stale-attr backoff also shapes its loop
    // (pre-fix: M175.48,-105.11 — delta 2.72 from the 0.7-scaled backoff).
    const edges = edgePaths(renderSvg(DOT_1949, 'dot'));
    const s = edges.find(e => e.title.startsWith('structParty:S')
      && e.title.endsWith('structDefaultAuto'));
    expect(s).toBeDefined();
    expect(s!.pts[0].x).toBeCloseTo(176.53, 1);
    expect(s!.pts[0].y).toBeCloseTo(-102.39, 1);
  });
});
