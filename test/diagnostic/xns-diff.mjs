// SPDX-License-Identifier: EPL-2.0
//
// xns-diff.mjs — diff the x-coordinate network-simplex (balance=2) frame of
// Graphviz C against the graphviz-ts port, to locate where (and whether) the
// port's x-NS solution diverges from C's.
//
// Usage:
//   node test/diagnostic/xns-diff.mjs <c-dump.txt> <port-dump.txt>
//
// Each dump is a stream of lines (see test/diagnostic/xns-trace.md for the
// temporary instrumentation that produces them):
//
//   XNS <tag> r=<rank> o=<order> ty=<node_type> x=<xcoord> name=<name>
//
//   - C side  (lib/dotgen/position.c:set_xcoords, tag "C-setx")
//   - port    (src/layout/dot/position.ts:xnsdbgDump, tag "PRE-normalize")
//
// set_xcoords assigns x to the layout nodes in GD_rank[] (NORMAL + virtual),
// NOT the aux-only SLACK nodes (those never enter the rank arrays). The two
// streams therefore enumerate the same node set in the same (rank, order)
// sweep. The rank INDEX base can differ harmlessly (C numbers the abomination
// flat-label rank as -1; the port as 0), so both sides are normalized by
// subtracting their own minimum rank before joining. The x VALUES are the
// quantity under test — they must match for the internal frame to match.
//
// Output: the first (rank,order) cell whose x differs, with context; or a
// confirmation that every cell matches (i.e. the port's x-NS frame == C's and
// any remaining internal-frame divergence is downstream of set_xcoords —
// e.g. the port-only normalizeXcoords step).

import { readFileSync } from 'node:fs';

const LINE = /^XNS\s+(\S+)\s+r=(-?\d+)\s+o=(\d+)\s+ty=(\d+)\s+x=(-?\d+)\s+name=(.*)$/;

function parse(path) {
  const rows = [];
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const m = LINE.exec(raw.trim());
    if (m) {
      rows.push({
        rank: Number(m[2]), order: Number(m[3]),
        ty: Number(m[4]), x: Number(m[5]), name: m[6],
      });
    }
  }
  if (rows.length === 0) throw new Error(`no XNS lines parsed from ${path}`);
  const minRank = Math.min(...rows.map((r) => r.rank));
  // Key on (normalized rank, order) so the rank-index base cancels.
  const byKey = new Map();
  for (const r of rows) byKey.set(`${r.rank - minRank}:${r.order}`, r);
  return { rows, byKey, minRank };
}

function main() {
  const [, , cPath, portPath] = process.argv;
  if (!cPath || !portPath) {
    console.error('usage: node xns-diff.mjs <c-dump.txt> <port-dump.txt>');
    process.exit(2);
  }
  const c = parse(cPath);
  const p = parse(portPath);

  const keys = [...c.byKey.keys()];
  let mismatches = 0;
  let firstDiff = null;
  for (const k of keys) {
    const cr = c.byKey.get(k);
    const pr = p.byKey.get(k);
    if (!pr) {
      if (!firstDiff) firstDiff = { k, cr, pr: null, reason: 'missing in port' };
      mismatches++;
      continue;
    }
    if (cr.x !== pr.x) {
      if (!firstDiff) firstDiff = { k, cr, pr, reason: 'x differs' };
      mismatches++;
    }
  }
  for (const k of p.byKey.keys()) {
    if (!c.byKey.has(k)) {
      if (!firstDiff) firstDiff = { k, cr: null, pr: p.byKey.get(k), reason: 'extra in port' };
      mismatches++;
    }
  }

  console.log(`C nodes:    ${c.rows.length} (minrank ${c.minRank})`);
  console.log(`port nodes: ${p.rows.length} (minrank ${p.minRank})`);
  if (mismatches === 0) {
    console.log('MATCH: every (rank,order) cell has identical x.');
    console.log('=> port x-NS frame == C x-NS frame (pivot order is bit-exact).');
    console.log('   Any remaining internal-frame divergence is downstream of');
    console.log('   set_xcoords (port-only normalizeXcoords).');
    return;
  }
  console.log(`DIVERGENCE: ${mismatches} cell(s) differ.`);
  const d = firstDiff;
  const fmt = (n) => (n ? `r-norm=${d.k.split(':')[0]} o=${n.order} ty=${n.ty} x=${n.x} name=${n.name}` : '(absent)');
  console.log('first diverging cell:');
  console.log(`  reason: ${d.reason}`);
  console.log(`  C:    ${fmt(d.cr)}`);
  console.log(`  port: ${fmt(d.pr)}`);
  process.exitCode = 1;
}

main();
