// SPDX-License-Identifier: EPL-2.0
//
// flat-geom-diff.mjs — diff the rendered geometry of the C oracle SVG against
// the graphviz-ts port SVG for a single graph, aligned by edge/node title.
//
// Built for mission 2368-conformant (Batch 0, T0). The two flat-edge residuals
// it isolates:
//   Issue 2 — adjacent labeled-flat curve geometry: C draws opposing flats as
//             one unordered {tail,head} group (straight earray[0] + arc
//             earray[1..]); the port splits by ordered (tail,head) so the
//             opposing leg is drawn straight. Shows up as a large per-edge path
//             @d delta on e.g. 376->76 / 376->196 / 256->436.
//   Issue 1 — flat-label-rank vertical spacing: C's bbox is 5pt taller. The
//             node-to-node spans are identical, so this surfaces here purely as
//             the <svg> height / translate delta, NOT as per-rank node deltas.
//
// Usage:
//   node test/diagnostic/flat-geom-diff.mjs <c.svg> <port.svg>
//
// Output: bbox (width/height/translate) delta, then per-title node-center and
// edge-path deltas (max abs coordinate delta per element), sorted worst-first.
// A coordinate-count mismatch (e.g. 4-pt straight vs 7-pt arc) is flagged
// explicitly since that is the Issue-2 signature.

import { readFileSync } from 'node:fs';

function readSvg(path) {
  return readFileSync(path, 'utf8');
}

/** Pull width/height/translate from the <svg>/<g transform> header. */
function bbox(svg) {
  const wh = /<svg width="(\d+)pt" height="(\d+)pt"/.exec(svg);
  const tr = /translate\(([-\d.]+)\s+([-\d.]+)\)/.exec(svg);
  return {
    width: wh ? +wh[1] : NaN,
    height: wh ? +wh[2] : NaN,
    tx: tr ? +tr[1] : NaN,
    ty: tr ? +tr[2] : NaN,
  };
}

/** All numbers in a string, in order. */
function nums(s) {
  return (s.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

/**
 * Map title -> { kind, coords } for every <g class="node"|"edge">. For nodes,
 * coords is the polygon point list (or ellipse cx/cy/rx/ry when no polygon);
 * for edges, the first <path d=...> numbers (the spline) — the dominant
 * geometry under test.
 *
 * Ellipse fix: default-shape nodes emit <ellipse cx/cy/rx/ry> rather than
 * <polygon points>. When no polygon is present, extract [cx, cy, rx, ry] from
 * <ellipse .../> so that node-center deltas are real for ellipse graphs.
 */
function elements(svg) {
  const out = new Map();
  const re = /<g id="[^"]*" class="(node|edge)">([\s\S]*?)<\/g>/g;
  let m;
  while ((m = re.exec(svg)) !== null) {
    const kind = m[1];
    const body = m[2];
    const title = (/<title>([\s\S]*?)<\/title>/.exec(body)?.[1] ?? '')
      .replace(/&#45;/g, '-').replace(/&gt;/g, '>');
    let coords = [];
    if (kind === 'node') {
      const polyMatch = /points="([^"]*)"/.exec(body);
      if (polyMatch) {
        coords = nums(polyMatch[1]);
      } else {
        // Ellipse node: extract cx, cy, rx, ry as the geometry
        const ellipseMatch = /<ellipse[^>]*cx="([^"]*)"[^>]*cy="([^"]*)"[^>]*rx="([^"]*)"[^>]*ry="([^"]*)"/
          .exec(body);
        if (ellipseMatch) {
          coords = [+ellipseMatch[1], +ellipseMatch[2], +ellipseMatch[3], +ellipseMatch[4]];
        }
      }
    } else {
      coords = nums(/<path[^>]*\bd="([^"]*)"/.exec(body)?.[1] ?? '');
    }
    out.set(title, { kind, coords });
  }
  return out;
}

const [, , cPath, portPath] = process.argv;
if (!cPath || !portPath) {
  process.stderr.write('usage: flat-geom-diff <c.svg> <port.svg>\n');
  process.exit(2);
}

const cSvg = readSvg(cPath);
const pSvg = readSvg(portPath);

const cb = bbox(cSvg);
const pb = bbox(pSvg);
console.log('=== bbox ===');
console.log(`  C    width=${cb.width} height=${cb.height} translate=(${cb.tx},${cb.ty})`);
console.log(`  port width=${pb.width} height=${pb.height} translate=(${pb.tx},${pb.ty})`);
console.log(`  Δ    width=${cb.width - pb.width} height=${cb.height - pb.height} `
  + `ty=${(cb.ty - pb.ty).toFixed(2)}`);

const cEl = elements(cSvg);
const pEl = elements(pSvg);

const rows = [];
for (const [title, c] of cEl) {
  const p = pEl.get(title);
  if (!p) { rows.push({ title, kind: c.kind, note: 'MISSING in port', max: Infinity }); continue; }
  if (c.coords.length !== p.coords.length) {
    rows.push({
      title, kind: c.kind,
      note: `COORD-COUNT C=${c.coords.length} port=${p.coords.length} (Issue-2 signature)`,
      max: Infinity,
    });
    continue;
  }
  let max = 0;
  for (let i = 0; i < c.coords.length; i++) {
    max = Math.max(max, Math.abs(c.coords[i] - p.coords[i]));
  }
  rows.push({ title, kind: c.kind, note: '', max });
}
for (const [title, p] of pEl) {
  if (!cEl.has(title)) rows.push({ title, kind: p.kind, note: 'EXTRA in port', max: Infinity });
}

rows.sort((a, b) => b.max - a.max);
console.log('\n=== per-element max coord delta (worst first) ===');
for (const r of rows) {
  const mv = r.max === Infinity ? '   --' : r.max.toFixed(2).padStart(6);
  console.log(`  ${mv}  ${r.kind.padEnd(4)} ${r.title}${r.note ? '  <- ' + r.note : ''}`);
}

const worst = rows.filter(r => r.max > 0.01);
console.log(`\n${worst.length} element(s) diverge; max coord delta = `
  + `${rows[0] ? (rows[0].max === Infinity ? 'count/missing' : rows[0].max.toFixed(2)) : 'n/a'}`);
