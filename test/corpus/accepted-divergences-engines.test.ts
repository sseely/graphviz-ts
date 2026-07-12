// SPDX-License-Identifier: EPL-2.0
//
// Guard for the per-engine accepted-divergence registry
// (test/corpus/accepted-divergences-engines.json).
//
// Mirrors accepted-divergences.test.ts's role for the dot-track registry, for
// the per-engine xdot tracks (circo/twopi/osage/patchwork/neato/fdp/sfdp).
// Two entry shapes share this one registry (see parity-report.ts and
// plans/iterative-parity-campaign/decisions.md#D2):
//   - per-id:  { class: string,  bound?, ref } — a single hand-root-caused
//              graph, one row per corpus id (circo/twopi/osage today).
//   - class:   { class: true,    attributionFile, ref } — membership is
//              COMPUTED from attribution-<engine>.json at report time, never
//              hand-enumerated here (T2, neato/fdp/sfdp's A1-drift).
//
// Until this file existed, the per-id shape had NO automated guard at all
// (introduced 2026-07-11, commit 1b33154) — this closes that gap in addition
// to covering the new class shape.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

interface EngineAcceptedEntry {
  class: string;
  bound?: string;
  ref: string;
}
interface EngineAcceptedClassEntry {
  class: true;
  attributionFile: string;
  ref: string;
}
type RegistryEntry = EngineAcceptedEntry | EngineAcceptedClassEntry;

interface AttributionResultRow {
  id: string;
  verdict: 'drift-exonerated' | 'not-cleared' | 'harness-error';
  baseDiffs: number;
  injectedDiffs: number;
  bucket?: { shape: string; uniformDelta?: [number, number]; mirror?: boolean };
}
interface AttributionReport {
  generatedAt: string;
  oracleSha1: string;
  tolerance: number;
  results: AttributionResultRow[];
}

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')) as T;
}

const raw = readJson<Record<string, unknown>>('./accepted-divergences-engines.json');
const { comment: _comment, ...registry } = raw as Record<string, unknown>;
const typedRegistry = registry as Record<string, Record<string, RegistryEntry>>;

interface ManifestEntry { id: string }
const manifestIds = new Set(readJson<ManifestEntry[]>('./corpus-manifest.json').map((e) => e.id));

const VERDICTS = new Set(['drift-exonerated', 'not-cleared', 'harness-error']);
const isClassEntry = (e: RegistryEntry): e is EngineAcceptedClassEntry => e.class === true;

describe('accepted-divergences-engines registry', () => {
  for (const [engine, entries] of Object.entries(typedRegistry)) {
    describe(engine, () => {
      it('every per-id entry is well-formed and names a real corpus graph', () => {
        for (const [id, e] of Object.entries(entries)) {
          if (isClassEntry(e)) continue;
          expect(typeof e.class, `class on ${engine}/${id}`).toBe('string');
          expect(e.ref, `ref on ${engine}/${id}`).toBeTruthy();
          expect(manifestIds.has(id), `unknown corpus id ${engine}/${id}`).toBe(true);
        }
      });

      it('every class entry is well-formed, and its attribution file (if generated) is well-formed', () => {
        for (const [name, e] of Object.entries(entries)) {
          if (!isClassEntry(e)) continue;
          expect(e.attributionFile, `attributionFile on ${engine}/${name}`).toMatch(/^attribution-.+\.json$/);
          expect(e.ref, `ref on ${engine}/${name}`).toBeTruthy();
          // Membership is NOT hand-enumerated (D2) — no per-id listing to
          // validate here. Only the file's own well-formedness is checked,
          // and only when it exists: T1's harness may not have produced it
          // for this engine yet, in which case the class is allowed to
          // precede its data (parity-report.ts renders "attribution
          // pending" with 0 members — see parity-report.test.ts).
          const path = fileURLToPath(new URL(`./${e.attributionFile}`, import.meta.url));
          if (!existsSync(path)) continue;
          const report = JSON.parse(readFileSync(path, 'utf8')) as AttributionReport;
          expect(typeof report.generatedAt, `${e.attributionFile} generatedAt`).toBe('string');
          expect(typeof report.oracleSha1, `${e.attributionFile} oracleSha1`).toBe('string');
          expect(typeof report.tolerance, `${e.attributionFile} tolerance`).toBe('number');
          expect(Array.isArray(report.results), `${e.attributionFile} results`).toBe(true);
          for (const r of report.results) {
            expect(VERDICTS.has(r.verdict), `${e.attributionFile}/${r.id} verdict=${r.verdict}`).toBe(true);
            expect(typeof r.id, `${e.attributionFile} result.id`).toBe('string');
          }
        }
      });
    });
  }

  it('class entries exist only for the iterative engines this mission targets (D2)', () => {
    const classEngines = Object.entries(typedRegistry)
      .filter(([, entries]) => Object.values(entries).some(isClassEntry))
      .map(([engine]) => engine)
      .sort();
    expect(classEngines).toEqual(['fdp', 'neato', 'sfdp']);
  });
});
