// SPDX-License-Identifier: EPL-2.0
//
// Guard for the accepted-divergence registry (test/corpus/accepted-divergences.json).
// Keeps the accepted list honest so PARITY-dot.md and the rules gate describe reality:
//   - every entry is well-formed (class/scope/reason/ref + exactly one selector),
//   - every per-id entry names a real corpus graph,
//   - every parity/both per-id entry is STILL non-conformant (a graph we
//     "accepted" that now conforms to is a STALE entry → remove it),
//   - matchAccepted resolves the documented A* and migrated R-* entries.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { loadAccepted, matchAccepted, type AcceptedEntry } from './accepted.js';

const entries = loadAccepted();

interface ManifestEntry { id: string; engine?: string; status?: string }
interface Row { id: string; verdict: string }

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')) as T;
}

const manifest = readJson<ManifestEntry[]>('./corpus-manifest.json');
const manifestIds = new Set(manifest.map((e) => e.id));
const parityRows: Row[] = readJson<{ results: Row[] }>('./parity.json').results;
const verdictById = new Map(parityRows.map((r) => [r.id, r.verdict]));

const SCOPES = new Set(['parity', 'rules', 'both']);
const idEntries = (e: AcceptedEntry): boolean => e.match.id !== undefined;
const parityScoped = (e: AcceptedEntry): boolean => e.scope === 'parity' || e.scope === 'both';

describe('accepted-divergences registry', () => {
  it('every entry is well-formed', () => {
    for (const e of entries) {
      expect(e.class, `class on ${JSON.stringify(e.match)}`).toBeTruthy();
      expect(SCOPES.has(e.scope), `scope=${e.scope}`).toBe(true);
      expect(e.reason, `reason on ${e.class}`).toBeTruthy();
      expect(e.ref, `ref on ${e.class}`).toBeTruthy();
      const selectors = [e.match.id, e.match.idPattern, e.match.engineIn].filter((s) => s !== undefined);
      expect(selectors.length, `exactly one selector on ${e.class}`).toBe(1);
    }
  });

  it('every per-id entry names a real corpus graph', () => {
    const missing = entries.filter(idEntries).map((e) => e.match.id!).filter((id) => !manifestIds.has(id));
    expect(missing, 'unknown ids in registry').toEqual([]);
  });

  it('every parity-scoped per-id entry is still non-conformant (no stale acceptance)', () => {
    const stale: string[] = [];
    for (const e of entries) {
      if (!idEntries(e) || !parityScoped(e)) continue;
      const v = verdictById.get(e.match.id!);
      // accepted graphs must remain a real divergence; conformant (or absent) = stale.
      if (v === undefined || v === 'conformant') stale.push(`${e.match.id} (${v ?? 'absent'})`);
    }
    expect(stale, 'stale accepted entries — graph is now conformant, remove from registry').toEqual([]);
  });

  it('resolves the documented A-class deltas under the parity scope', () => {
    expect(matchAccepted('2368', 'dot', 'parity', entries)?.class).toBe('A3');
    // A4 oracle-bug family (verify-oracle-bug-family, 2026-07-02). 1939 is
    // deliberately ABSENT: it went conformant, so acceptance would be stale.
    for (const id of ['2796', '2471', '1435', 'graphs-structs']) {
      expect(matchAccepted(id, 'dot', 'parity', entries)?.class, `${id} parity`).toBe('A4');
    }
    expect(matchAccepted('1939', 'dot', 'parity', entries)).toBeNull();
    // A2 closed 2026-07-01 (fix/nan-a2-retire): the NaN family is conformant
    // and must NOT resolve to an accepted entry any more.
    expect(matchAccepted('graphs-NaN', 'dot', 'parity', entries)).toBeNull();
    // a known conformant graph is NOT accepted
    expect(matchAccepted('121', 'dot', 'parity', entries)).toBeNull();
  });

  it('resolves the migrated rules allowlist under the rules scope only', () => {
    // graphs-structs additionally carries an A4 parity entry since the
    // verify-oracle-bug-family mission (2026-07-02); 2168_2 stays rules-only.
    for (const id of ['graphs-structs', '2168_2']) {
      expect(matchAccepted(id, 'dot', 'rules', entries), `${id} rules`).not.toBeNull();
    }
    expect(matchAccepted('2168_2', 'dot', 'parity', entries), '2168_2 parity').toBeNull();
  });

  it('A1 engine pattern matches force-directed engines, not dot', () => {
    expect(matchAccepted('whatever', 'neato', 'parity', entries)?.class).toBe('A1');
    expect(matchAccepted('whatever', 'dot', 'parity', entries)).toBeNull();
  });
});
