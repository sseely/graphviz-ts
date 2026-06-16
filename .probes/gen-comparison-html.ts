// Generate visual HTML comparison pages: dot 15.0.0 vs graphviz-ts drawings
// side-by-side (the visual IS the test), plus the per-point delta table and
// diagnosis. SVGs are embedded via <img src> (sibling files; render crisp).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'plans/parity-steering-port-routing/comparisons';

interface Pair { caption: string; dot: string; ts: string; }
interface Tbl { caption: string; head: string[]; rows: string[][]; badCol?: number; badThresh?: number; }
interface Page {
  file: string; title: string; status: string;
  pairs: Pair[]; tables: Tbl[]; diagnosis: string[]; excluded: string[];
  /** Closing-section heading; defaults to the exclusion wording. */
  closingHeading?: string;
}

const STYLE = `
:root{font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.5}
body{margin:2rem auto;max-width:64rem;padding:0 1rem;color:#1a1a1a}
h1{font-size:1.5rem} h2{font-size:1.1rem;margin-top:2rem;border-bottom:1px solid #eee;padding-bottom:.3rem}
.status{background:#fdf6e3;border:1px solid #e8d9a0;padding:.6rem 1rem;border-radius:6px}
.pairs{display:flex;flex-wrap:wrap;gap:2rem;margin:1rem 0}
.pair{border:1px solid #ddd;border-radius:8px;padding:1rem}
.pair h3{margin:.2rem 0 1rem;font-size:.95rem;color:#444;text-align:center}
.cols{display:flex;gap:1.5rem;align-items:flex-start}
.col{text-align:center}
.col .lbl{font-size:.8rem;color:#666;margin-bottom:.4rem;font-weight:600}
.col img{height:300px;width:auto;border:1px dashed #ccc;background:
  repeating-conic-gradient(#f4f4f4 0% 25%,#fff 0% 50%) 0/16px 16px;padding:4px}
table{border-collapse:collapse;margin:.8rem 0;font-size:.85rem}
th,td{border:1px solid #ddd;padding:.25rem .6rem;text-align:right;font-variant-numeric:tabular-nums}
th{background:#f7f7f7} td:first-child,th:first-child{text-align:left}
tr.bad td{background:#fde8e8;font-weight:600}
.caption{font-size:.85rem;color:#555;margin:.3rem 0}
p{margin:.6rem 0} code{background:#f0f0f0;padding:.05rem .3rem;border-radius:3px}
.legend{font-size:.8rem;color:#888}
`;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderPair(p: Pair): string {
  return `<div class="pair"><h3>${esc(p.caption)}</h3><div class="cols">`
    + `<div class="col"><div class="lbl">dot 15.0.0</div>`
    + `<img src="${p.dot}" alt="dot 15.0.0 — ${esc(p.caption)}"></div>`
    + `<div class="col"><div class="lbl">graphviz-ts</div>`
    + `<img src="${p.ts}" alt="graphviz-ts — ${esc(p.caption)}"></div>`
    + `</div></div>`;
}

function renderTable(t: Tbl): string {
  const head = '<tr>' + t.head.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>';
  const rows = t.rows.map(r => {
    const bad = t.badCol !== undefined && t.badThresh !== undefined
      && Math.abs(parseFloat(r[t.badCol])) >= t.badThresh;
    return `<tr${bad ? ' class="bad"' : ''}>` + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>';
  }).join('');
  return `<p class="caption">${esc(t.caption)}</p><table>${head}${rows}</table>`;
}

const LEGEND = 'The drawings below are the actual rendered SVGs — the visual '
  + 'match is the test. Backgrounds are a checker pattern so white fills show.';

function renderPage(pg: Page): string {
  const parts: string[] = [
    '<!DOCTYPE html>', '<html lang="en"><head><meta charset="utf-8">',
    `<title>${esc(pg.title)}</title><style>${STYLE}</style></head><body>`,
    `<h1>${esc(pg.title)}</h1>`, `<p class="status">${pg.status}</p>`,
    `<p class="legend">${LEGEND}</p>`,
    pg.pairs.map(renderPair).join('\n'),
    '<h2>Geometry</h2>', pg.tables.map(renderTable).join('\n'),
    '<h2>Diagnosis</h2>', pg.diagnosis.map(d => `<p>${d}</p>`).join('\n'),
    `<h2>${esc(pg.closingHeading ?? 'Why excluded (not fixed)')}</h2>`,
    pg.excluded.map(d => `<p>${d}</p>`).join('\n'),
    '</body></html>', '',
  ];
  return parts.join('\n');
}

const PAGES: Page[] = [
  {
    file: 'An-Bs-double-steering.html',
    title: 'A:n-&gt;B:s — compound double-steering',
    status: '<strong>FIXED 2026-06-15</strong> (per-rank MINW bound, commit f5711d3). Side mask on BOTH ends (tail :n exits the top away from the head; head :s enters the bottom away from the tail) — a double loop. The mid-corridor now matches dot; pinned in steering-port-regression.test.ts.',
    pairs: [{ caption: 'digraph{A:n->B:s}', dot: 'An-Bs-dot1500.svg', ts: 'An-Bs-ts.svg' }],
    tables: [{
      caption: 'First edge path control points (SVG frame).',
      head: ['pt', 'dot 15.0.0', 'graphviz-ts', 'Δ'], badCol: 3, badThresh: 0.5,
      rows: [
        ['0 (tail :n)', '27.00,-118.01', '27.00,-117.36', '0.65'],
        ['1', '27.00,-130.01', '27.00,-129.37', '0.64'],
        ['2', '45.67,-125.65', '45.67,-125.01', '0.64'],
        ['3', '54.00,-117.01', '54.00,-116.36', '0.65'],
        ['4', '87.50,-82.24', '87.31,-81.80', '0.47'],
        ['5', '87.50,-43.13', '87.31,-42.93', '0.28'],
        ['6', '54.00,-8.36', '54.00,-8.36', '0.00'],
        ['9 (→ B)', '35.80,0.00', '35.80,0.00', '0.00'],
        ['arrow tip', '28.16,-6.39', '28.16,-6.39', '0.00'],
      ],
    }],
    diagnosis: [
      'Endpoints and both loop entries/exits match (≤0.65pt; arrowhead exact). The route is the correct shape — up over A, around the right, down under B.',
      'The <strong>mid-corridor lateral excursion</strong> joining the two loops now matches dot: ts holds <code>x=87.31</code> vs dot <code>x=87.5</code> (Δ≤0.47pt, was 24pt). Root cause was the corridor bound: <code>computeLeftBound</code>/<code>computeRightBound</code> added <code>MINW</code> once total, but C (<code>dotsplines.c:278</code>) adds it once PER RANK — so a 2-rank edge’s corridor was ~16pt too narrow. Fixed by accumulating MINW per rank; the residual ≤0.65pt is start-clip renormalization. Not a Proutespline/Pshortestpath divergence.',
    ],
    closingHeading: 'How it was fixed',
    excluded: ['The fix is in <code>edge-route-rank.ts</code> (per-rank MINW). It also resolved A:e->B:e and the adjacent flat-adj arc — all three were the same both-ends-side-port corridor bug. All 115 goldens stayed byte-identical (their splines never reach the bound). Pinned by steering-port-regression.test.ts.'],
  },
  {
    file: 'self-ew-double-lateral.html',
    title: 'A:e-&gt;A:w — lateral self-loop',
    status: '<strong>EXCLUDED at SR6.</strong> Self-edges already route faithfully (plain self-loops are byte-identical; n/s side ports ≤0.32pt). The lateral e/w loop diverges via the frozen <code>selfRightSpace</code> node-width reservation (AD5).',
    pairs: [{ caption: 'digraph{A:e->A:w; A->B}', dot: 'self-ew-dot1500.svg', ts: 'self-ew-ts.svg' }],
    tables: [{
      caption: 'Self-loop path control points (graph has ; A->B to expose the node shift).',
      head: ['pt', 'dot 15.0.0', 'graphviz-ts', 'Δ'], badCol: 3, badThresh: 0.5,
      rows: [
        ['0', '65.77,-90.00', '71.01,-90.00', '5.24'],
        ['1', '83.52,-108.00', '89.01,-108.00', '5.49'],
        ['3', '38.52,-144.00', '44.01,-144.00', '5.49'],
        ['5', '-5.44,-118.13', '0.00,-117.89', '5.45'],
        ['arrow tip', '10.37,-91.22', '16.10,-91.21', '5.73'],
      ],
    }],
    diagnosis: [
      'The loop <strong>shape is faithful</strong> (same lateral double-bulge, vertical extent to y=-144 exact), but the whole node-A region is translated ~5.5pt in x.',
      'The incident <code>A-&gt;B</code> edge shifts the same ~5.5pt (start x 38.52 vs 44.01), confirming the cause is node A’s <strong>reserved width</strong> (frozen <code>selfRightSpace</code>), not the loop spline.',
    ],
    excluded: ['SR6’s seam is self-loop.ts (already faithful). The lateral width reservation is in the AD5-frozen splines-selfedge.ts. Surfaced, not chased.'],
  },
  {
    file: 'flat-bottom-port-offset.html',
    title: 'Flat side-port exclusions',
    status: '<strong>Updated 2026-06-15.</strong> Non-adjacent box branch is exact (A:n->B:n, A:e->B:w 0.25pt). Adjacent flats route via the ported make_flat_adj_edges and now match dot within a uniform 0.32pt (was a straight line, then a half-magnitude arc; the per-rank MINW bound fix closed the magnitude gap — pinned as a dot oracle). The bottom-tail (:s) offset is the drawing transform, not routing. Invisible ordering edges are no longer drawn (style=invis fix).',
    pairs: [
      { caption: 'bottom-tail: digraph{rank=same A->C->B[invis]; A:s->B:s}', dot: 'flat-bottom-dot1500.svg', ts: 'flat-bottom-ts.svg' },
      { caption: 'adjacent: digraph{rank=same A B; A:n->B:n}', dot: 'flat-adjacent-dot1500.svg', ts: 'flat-adjacent-ts.svg' },
    ],
    tables: [{
      caption: 'Bottom-tail A:s->B:s — every point off a constant 7.06pt in y; X exact.',
      head: ['pt', 'dot 15.0.0', 'graphviz-ts', 'Δ'], badCol: 3, badThresh: 0.5,
      rows: [
        ['0', '27.00,-24.50', '27.00,-31.56', '7.06'],
        ['1', '27.00,3.75', '27.00,-3.31', '7.06'],
        ['2', '139.23,7.06', '139.23,0.00', '7.06'],
        ['3', '165.53,-14.57', '165.53,-21.63', '7.06'],
      ],
    }],
    diagnosis: [
      '<strong>Root cause 1 — bottom-tail (:s) is the drawing transform, NOT a routing error.</strong> The constant 7.06pt offset is exactly the graph-transform delta: dot emits <code>translate(4, 64.5)</code>, graphviz-ts <code>translate(4, 71.56)</code> — difference 7.06. The edge spline is <em>identical in internal (un-transformed) coordinates</em>; only the drawing bbox (viewBox height 68 vs 76) and its derived translate differ, shifting every rendered point by a constant. This is the same bbox-extent divergence as <a href="port-golden-bbox.html">port-golden-bbox</a> (the loop dips below the node baseline; TS reserves ~8pt more bbox below). The flat <em>routing</em> is faithful.',
      '<strong>Root cause 2 — adjacent endpoints use a different algorithm (now ported).</strong> When A and B are adjacent (no node between them), dot never uses the box channel: <code>make_flat_edge</code> dispatches to <code>make_flat_adj_edges</code>, which clones the two endpoints + edges into a 90°-rotated auxiliary graph (with a heavy ordering edge), lays it out (<code>dot_rank</code>/<code>mincross</code>/<code>position</code>), repositions, routes (<code>dot_splines_</code> + <code>gvPostprocess</code>), and copies the spline back via <code>transformf</code>. This is now ported AND the magnitude is fixed: graphviz-ts <code>M27,-37 C27,-64.88 81.63,-68.47 95.72,-47.78</code> vs dot <code>M27,-37.32 C27,-65.2 81.63,-68.79 95.72,-48.1</code> — a <strong>uniform 0.32pt</strong> offset on every control point (start-clip renormalization), not a magnitude error. The earlier half-height arc was the same both-ends-side-port corridor bug fixed in <a href="An-Bs-double-steering.html">An-Bs</a>: the aux edge for make_flat_adj_edges is a both-ends case, so its corridor was ~16pt too narrow until MINW was applied per rank (<code>edge-route-rank.ts</code>). Pinned as a dot oracle at tol 0.5 in splines-flat-oracle.test.ts.',
    ],
    closingHeading: 'Status',
    excluded: ['Bottom-tail is the shared drawing-bbox extent (geometry faithful) — same bbox divergence as <a href="port-golden-bbox.html">port-golden-bbox</a>. Adjacent flats now match dot within 0.32pt via the ported <code>make_flat_adj_edges</code> + the per-rank MINW bound fix, pinned as a dot oracle. No 115-golden uses a flat edge, so output is byte-stable.'],
  },
  {
    file: 'multirank-left-bulge.html',
    title: 'Multi-rank left-bulge exclusions',
    status: '<strong>EXCLUDED at SR7.</strong> The faithful multi-rank chain matches dot within 0.32pt for TOP/RIGHT loops up to 3 ranks (pinned). Loops that bulge left past x≈0 clamp at the boundary.',
    pairs: [
      { caption: 'left-lateral: digraph{A:w->C; A->B->C}', dot: 'multirank-left-w-dot1500.svg', ts: 'multirank-left-w-ts.svg' },
      { caption: 'deep 4-rank: digraph{A:n->E; A->B->C->D->E}', dot: 'multirank-left-deep-dot1500.svg', ts: 'multirank-left-deep-ts.svg' },
    ],
    tables: [{
      caption: 'A:w->C — X uniformly shifted ~21pt; Y matches (loop bulges left of x=0 in dot).',
      head: ['pt', 'dot 15.0.0', 'graphviz-ts', 'Δ'], badCol: 3, badThresh: 0.5,
      rows: [
        ['0', '25.30,-162.00', '46.30,-162.00', '21.00'],
        ['1', '-21.00,-162.00', '0.00,-162.00', '21.00'],
        ['2', '7.30,-87.00', '28.10,-87.00', '20.80'],
        ['3', '26.40,-45.60', '47.10,-45.60', '20.70'],
      ],
    }],
    diagnosis: [
      'dot’s loop swings to <code>x=-21</code> (left of the origin); TS clamps the left excursion at <code>x=0</code> and the whole loop translates right. The deep 4-rank case shows the same (~11pt).',
      'The faithful chain assembly is correct for loops within the drawing bounds; the left-extent of the assembled corridor (computeLeftBound / maximal_bbox clamp for the virtual nodes) does not reach as far negative as dot’s. Not a Proutespline numeric divergence (Y and shape are faithful). The straight-mode run optimization is also unported.',
    ],
    excluded: ['The named steering cases (TOP, RIGHT-lateral, ≤3 ranks) match within 0.32pt and are pinned. Left-extent + straight-mode are larger corridor-assembly changes.'],
  },
  {
    file: 'port-golden-bbox.html',
    title: 'Steering-port goldens &amp; the drawing-bbox divergence',
    status: '<strong>SR8.</strong> 4 steering-port goldens minted (≤0.5pt + 0.01pt drift pins). The remaining steering cases fail the full-SVG golden only on the drawing bbox — the edge path itself is ≤0.5pt.',
    pairs: [{ caption: 'digraph{A:n->B} (TOP steering)', dot: 'port-bbox-An-B-dot1500.svg', ts: 'port-bbox-An-B-ts.svg' }],
    tables: [
      {
        caption: 'Minted goldens (APPENDED to manifest).',
        head: ['id', 'input', 'Δ vs dot 15.0.0'],
        rows: [
          ['dot-port-compass-aligned', 'A:s->B:n', '0.000 (exact)'],
          ['dot-port-steering-east', 'A:e->B', '≤0.5'],
          ['dot-port-steering-west', 'A:w->B', '≤0.5'],
          ['dot-port-record-aligned', 'A:f0->B', '0.000 (exact)'],
        ],
      },
      {
        caption: 'A:n->B drawing bbox — edge path is ≤0.5pt; only the bbox differs.',
        head: ['attribute', 'dot 15.0.0', 'graphviz-ts', 'Δ'], badCol: 3, badThresh: 0.5,
        rows: [
          ['viewBox width', '68.00', '73.00', '5'],
          ['viewBox / height', '125.00', '129.00', '4'],
        ],
      },
    ],
    diagnosis: [
      'For the minted four the full SVG (geometry + the title fix: ports, <code>&amp;#45;</code> hyphen, compass-replaces-field) matches dot 15.0.0; each carries a TS portReference drift pin at 0.01pt.',
      'For TOP-steering / multi-rank / record-steering the <strong>edge path matches dot within 0.5pt</strong> (pinned in the SR4/SR7 oracle tests); the golden fails only on <code>svg/@viewBox</code>, <code>@height</code> and the derived graph transform — TS’s drawing bounding box is ~4–5pt larger for loops bulging beyond the node column.',
    ],
    excluded: ['A bbox-extent computation difference (position-bbox / postproc), not edge routing and not the svgBeginEdge title seam. Changing it risks the 115 existing no-port goldens. The edge geometry is already pinned by unit tests; only the golden mint is deferred.'],
  },
];

for (const pg of PAGES) {
  writeFileSync(join(process.cwd(), DIR, pg.file), renderPage(pg));
  console.error('wrote', pg.file);
}
