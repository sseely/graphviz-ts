// SPDX-License-Identifier: EPL-2.0
//
// Unit tests for the pure classification/formatting logic in
// oracle-error-classifier.ts (D6: 3-rerun native-crash vs timeout-flake).
// The impure CLI shell (child_process reruns, file I/O) is not unit-tested,
// matching engine-walk.ts's convention in this corpus harness.

import { describe, it, expect } from 'vitest';
import {
  classifyAttempts,
  formatOracleErrorsSidecar,
  renderOracleErrorsSidecar,
} from './oracle-error-classifier.js';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('classifyAttempts', () => {
  it('classifies 3/3 failures as native-crash with attempts=3', () => {
    const r = classifyAttempts([
      { success: false, err: 'e1' },
      { success: false, err: 'e2' },
      { success: false, err: 'e3' },
    ]);
    expect(r.classification).toBe('native-crash');
    expect(r.attempts).toBe(3);
    expect(r.lastErr).toBe('e3');
  });

  it('classifies a first-attempt success as timeout-flake with attempts=1', () => {
    const r = classifyAttempts([{ success: true, err: '' }]);
    expect(r.classification).toBe('timeout-flake');
    expect(r.attempts).toBe(1);
    expect(r.lastErr).toBe('');
  });

  it('classifies a second-attempt success as timeout-flake with attempts=2', () => {
    const r = classifyAttempts([
      { success: false, err: 'e1' },
      { success: true, err: '' },
    ]);
    expect(r.classification).toBe('timeout-flake');
    expect(r.attempts).toBe(2);
    expect(r.lastErr).toBe('');
  });

  it('throws on an empty outcome list (caller bug, not a valid state)', () => {
    expect(() => classifyAttempts([])).toThrow();
  });
});

describe('formatOracleErrorsSidecar', () => {
  it('returns empty string when both counts are 0', () => {
    expect(formatOracleErrorsSidecar(0, 0)).toBe('');
  });

  it('renders native-crash and timeout-flake counts', () => {
    const s = formatOracleErrorsSidecar(2, 1);
    expect(s).toContain('2 native-crash');
    expect(s).toContain('1 timeout-flake');
    expect(s).toContain('excluded');
  });

  it('renders when only one of the two counts is nonzero', () => {
    const s = formatOracleErrorsSidecar(0, 3);
    expect(s).toContain('0 native-crash');
    expect(s).toContain('3 timeout-flake');
  });
});

describe('renderOracleErrorsSidecar', () => {
  it('returns empty string when the sidecar file does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oracle-errors-test-'));
    try {
      expect(renderOracleErrorsSidecar('neato', dir)).toBe('');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reads a sidecar file and formats its classification counts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oracle-errors-test-'));
    try {
      mkdirSync(join(dir, 'test/corpus'), { recursive: true });
      writeFileSync(
        join(dir, 'test/corpus/oracle-errors-neato.json'),
        JSON.stringify({
          generatedAt: '2026-07-11T00:00:00.000Z',
          engine: 'neato',
          results: [
            { id: 'a', classification: 'native-crash', attempts: 3, lastErr: 'x' },
            { id: 'b', classification: 'native-crash', attempts: 3, lastErr: 'x' },
            { id: 'c', classification: 'timeout-flake', attempts: 2, lastErr: '' },
          ],
        }),
      );
      const s = renderOracleErrorsSidecar('neato', dir);
      expect(s).toContain('2 native-crash');
      expect(s).toContain('1 timeout-flake');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
