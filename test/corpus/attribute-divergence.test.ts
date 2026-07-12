// SPDX-License-Identifier: EPL-2.0
//
// Unit tests for the T1 injection-attribution harness's D5 classifier
// (iterative-parity-campaign batch-1). Only the pure surface is tested; the
// imperative shell (oracle spawn / port spawn / resume plumbing) is exercised
// end-to-end by the corpus sweep, mirroring engine-walk.ts's and
// oracle-error-classifier.ts's convention.

import { describe, it, expect } from 'vitest';
import { classifyBucket, dedupeRows } from './attribute-divergence.js';
import type { XdotDiff } from '../golden/compare-xdot.js';

const META = '{"_meta":true,"oracleSha1":"abc","generatedAt":"2026-07-12T00:00:00.000Z"}';

function row(id: string, verdict: string, injectedDiffs = 0): string {
  return JSON.stringify({ id, verdict, baseDiffs: 3, injectedDiffs, bucket: { shape: 'node/pos/numeric' } });
}

describe('dedupeRows', () => {
  it('keeps one row per id, last-write-wins', () => {
    const text = [META, row('a', 'not-cleared', 4), row('b', 'drift-exonerated'), row('a', 'drift-exonerated')].join('\n');
    const out = dedupeRows(text);
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.id === 'a')?.verdict).toBe('drift-exonerated');
    expect(out.find((r) => r.id === 'a')?.injectedDiffs).toBe(0);
  });

  it('preserves first-appearance order', () => {
    const text = [META, row('b', 'not-cleared'), row('a', 'not-cleared'), row('b', 'drift-exonerated')].join('\n');
    expect(dedupeRows(text).map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('drops the _meta line and tolerates a torn trailing line', () => {
    const text = [META, row('a', 'not-cleared'), '{"id":"b","verdi'].join('\n');
    expect(dedupeRows(text).map((r) => r.id)).toEqual(['a']);
  });

  it('returns nothing for a jsonl holding only metadata', () => {
    expect(dedupeRows(META + '\n')).toEqual([]);
  });
});

/** A numeric diff whose path ends in `[j]` — the form the detectors parse. */
function num(object: string, attr: string, j: number, actual: number, expected: number): XdotDiff {
  return {
    object,
    attr,
    path: `${object}/${attr}[${j}]`,
    actual: String(actual),
    expected: String(expected),
    delta: Math.abs(actual - expected),
    kind: 'numeric',
  };
}

describe('classifyBucket (D5)', () => {
  describe('shape label', () => {
    it('derives <objectType>/<attr>/<kind> from the first diff', () => {
      const diffs: XdotDiff[] = [
        { object: 'edge:a->b#0', attr: '_draw_', path: 'edge:a->b#0/_draw_[opCount]', actual: '3', expected: '4', kind: 'structural' },
      ];
      expect(classifyBucket(diffs).shape).toBe('edge/_draw_/structural');
    });

    it('collapses the [graph] object to the `graph` type', () => {
      const diffs: XdotDiff[] = [
        { object: '[graph]', attr: 'bb', path: '[graph]/bb[2]', actual: '100', expected: '101', delta: 1, kind: 'numeric' },
      ];
      expect(classifyBucket(diffs).shape).toBe('graph/bb/numeric');
    });
  });

  describe('fallback when injection cleared every diff', () => {
    it('parses the pre-injection firstDiff string, marking the kind unknown', () => {
      expect(classifyBucket([], 'node:a pos numeric drift')).toEqual({ shape: 'node/pos/unknown' });
    });

    it('reports `unknown` when there is no fallback firstDiff to parse', () => {
      expect(classifyBucket([])).toEqual({ shape: 'unknown' });
    });
  });

  describe('uniform-translation detector', () => {
    it('fires with the shared (dx, dy) when every point is offset alike', () => {
      // Even index = x, odd = y (flat x,y,x,y payload).
      const diffs = [
        num('node:a', 'pos', 0, 12.5, 10.0),
        num('node:a', 'pos', 1, 27.0, 20.0),
        num('node:b', 'pos', 2, 42.5, 40.0),
        num('node:b', 'pos', 3, 57.0, 50.0),
      ];
      expect(classifyBucket(diffs).uniformDelta).toEqual([2.5, 7]);
    });

    it('does not fire when the offsets disagree beyond the epsilon', () => {
      const diffs = [
        num('node:a', 'pos', 0, 12.5, 10.0),
        num('node:a', 'pos', 1, 27.0, 20.0),
        num('node:b', 'pos', 2, 99.0, 40.0), // x drifts on its own
        num('node:b', 'pos', 3, 57.0, 50.0),
      ];
      expect(classifyBucket(diffs).uniformDelta).toBeUndefined();
    });

    it('needs both an x and a y sample — an all-x diff set does not translate', () => {
      const diffs = [num('node:a', 'pos', 0, 12.5, 10.0), num('node:b', 'pos', 2, 42.5, 40.0)];
      expect(classifyBucket(diffs).uniformDelta).toBeUndefined();
    });
  });

  describe('mirror detector', () => {
    it('fires when every y is negated and no x diff survives', () => {
      const diffs = [num('node:a', 'pos', 1, -20, 20), num('node:b', 'pos', 3, -50, 50)];
      const b = classifyBucket(diffs);
      expect(b.mirror).toBe(true);
    });

    it('does not fire when an x diff is also present', () => {
      const diffs = [num('node:a', 'pos', 0, 5, 10), num('node:a', 'pos', 1, -20, 20)];
      expect(classifyBucket(diffs).mirror).toBeUndefined();
    });

    it('does not fire when a y is merely shifted rather than negated', () => {
      const diffs = [num('node:a', 'pos', 1, 21, 20), num('node:b', 'pos', 3, 51, 50)];
      expect(classifyBucket(diffs).mirror).toBeUndefined();
    });
  });

  describe('detector preconditions', () => {
    it('skips both detectors when fewer than two numeric diffs exist', () => {
      const diffs = [num('node:a', 'pos', 0, 12.5, 10.0)];
      expect(classifyBucket(diffs)).toEqual({ shape: 'node/pos/numeric' });
    });

    it('ignores numeric diffs whose path carries no trailing [index]', () => {
      // e.g. `node:a/_draw_/op[1].ellipse.y` — indexable payloads only.
      const diffs: XdotDiff[] = [
        { object: 'node:a', attr: '_draw_', path: 'node:a/_draw_/op[1].ellipse.y', actual: '2', expected: '1', delta: 1, kind: 'numeric' },
        { object: 'node:b', attr: '_draw_', path: 'node:b/_draw_/op[1].ellipse.y', actual: '4', expected: '3', delta: 1, kind: 'numeric' },
      ];
      const b = classifyBucket(diffs);
      expect(b.shape).toBe('node/_draw_/numeric');
      expect(b.uniformDelta).toBeUndefined();
      expect(b.mirror).toBeUndefined();
    });

    it('ignores structural diffs when sampling points', () => {
      const diffs: XdotDiff[] = [
        { object: 'node:a', attr: 'pos', path: 'node:a/pos[opCount]', actual: '3', expected: '4', kind: 'structural' },
        num('node:a', 'pos', 0, 12.5, 10.0),
        num('node:a', 'pos', 1, 27.0, 20.0),
      ];
      const b = classifyBucket(diffs);
      expect(b.shape).toBe('node/pos/structural'); // shape still comes from diffs[0]
      expect(b.uniformDelta).toEqual([2.5, 7]);
    });
  });
});
