// SPDX-License-Identifier: EPL-2.0
//
// Unit tests for the survey harness oracle-usability guard (mission fix-1472).
//
// `isWellFormedSvg` decides whether a native-oracle SVG is parseable by the same
// normalizer `compareSvg` uses. A non-well-formed oracle (e.g. tests/1472.dot,
// where native dot leaks invalid UTF-8 into its output) must classify as
// `oracle-error`, NOT as a port `diverged` — the port render is fine; the oracle
// is the unusable side. See plans/fix-1472-oracle-classification/decisions.md AD-1.

import { describe, it, expect } from 'vitest';
import { isWellFormedSvg } from './survey.js';

describe('isWellFormedSvg', () => {
  it('returns true for a minimal well-formed SVG', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><g></g></svg>';
    expect(isWellFormedSvg(svg)).toBe(true);
  });

  it('returns false for an unbalanced/malformed SVG (svg != g mismatch)', () => {
    // The 1472 signature: native dot emits an opening <g> closed by </svg>.
    expect(isWellFormedSvg('<svg><g></svg>')).toBe(false);
  });

  it('returns false for an empty string (no root element)', () => {
    expect(isWellFormedSvg('')).toBe(false);
  });
});
