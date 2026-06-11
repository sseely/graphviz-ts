// SPDX-License-Identifier: EPL-2.0
/// <reference types="vitest/importMeta" />
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { normalizeSvg } from './normalize.js';
import type { NormalizedNode } from './normalize.js';

// ---------------------------------------------------------------------------
// Tolerance tables
// ---------------------------------------------------------------------------

export const TOLERANCES: Record<string, number> = {
  deterministic: 0.01,
  iterative: 0.5,
};

export const ENGINE_TOLERANCE_CLASS: Record<string, string> = {
  dot: 'deterministic',
  circo: 'deterministic',
  twopi: 'deterministic',
  osage: 'deterministic',
  patchwork: 'deterministic',
  neato: 'iterative',
  fdp: 'iterative',
  sfdp: 'iterative',
};

// ---------------------------------------------------------------------------
// Diff type
// ---------------------------------------------------------------------------

export interface Diff {
  path: string;    // XPath-like: e.g. "svg/g[2]/ellipse/@cx"
  actual: string;
  expected: string;
  delta?: number;  // for numeric diffs only
  tolerance: number;
}

// ---------------------------------------------------------------------------
// Numeric attribute detection
// ---------------------------------------------------------------------------

const NUMERIC_ATTRS = new Set([
  'x', 'y', 'cx', 'cy', 'rx', 'ry',
  'width', 'height',
  'x1', 'y1', 'x2', 'y2',
  'dx', 'dy', 'r',
]);

function parseNumber(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// Path-data and points comparison helpers
// ---------------------------------------------------------------------------

function extractNumbers(s: string): number[] {
  const nums: number[] = [];
  const re = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const n = parseFloat(m[0]);
    if (!isNaN(n)) nums.push(n);
  }
  return nums;
}

function extractPathCommands(d: string): string[] {
  return (d.match(/[MmZzLlHhVvCcSsQqTtAa]/g) ?? []);
}

// ---------------------------------------------------------------------------
// Transform comparison helper
// ---------------------------------------------------------------------------

interface ParsedTransform {
  type: string;
  params: number[];
}

function parseTransformAttr(t: string): ParsedTransform[] {
  const result: ParsedTransform[] = [];
  const re = /(\w+)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const type = m[1];
    const params = extractNumbers(m[2]);
    result.push({ type, params });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Tree walker
// ---------------------------------------------------------------------------

function compareNodes(
  actual: NormalizedNode,
  expected: NormalizedNode,
  path: string,
  tolerance: number,
  diffs: Diff[],
): void {
  // Structural: node type must match
  if (actual.type !== expected.type) {
    diffs.push({
      path,
      actual: actual.type,
      expected: expected.type,
      tolerance,
    });
    return; // structural mismatch — stop here
  }

  if (actual.type === 'text' && expected.type === 'text') {
    if (actual.text !== expected.text) {
      diffs.push({
        path,
        actual: actual.text ?? '',
        expected: expected.text ?? '',
        tolerance,
      });
    }
    return;
  }

  if (actual.type === 'element' && expected.type === 'element') {
    // Tag check
    if (actual.tag !== expected.tag) {
      diffs.push({
        path,
        actual: actual.tag ?? '',
        expected: expected.tag ?? '',
        tolerance,
      });
      return; // structural mismatch — stop here
    }

    // Attribute comparison
    const actualAttrs = actual.attrs ?? {};
    const expectedAttrs = expected.attrs ?? {};
    const allAttrNames = new Set([
      ...Object.keys(actualAttrs),
      ...Object.keys(expectedAttrs),
    ]);

    for (const name of [...allAttrNames].sort()) {
      const attrPath = `${path}/@${name}`;
      const av = actualAttrs[name] ?? '';
      const ev = expectedAttrs[name] ?? '';

      if (av === ev) continue;

      if (NUMERIC_ATTRS.has(name)) {
        const an = parseNumber(av);
        const en = parseNumber(ev);
        if (an !== null && en !== null) {
          const delta = Math.abs(an - en);
          if (delta > tolerance) {
            diffs.push({ path: attrPath, actual: av, expected: ev, delta, tolerance });
          }
          continue;
        }
      }

      if (name === 'd') {
        // Compare command letters structurally
        const actualCmds = extractPathCommands(av);
        const expectedCmds = extractPathCommands(ev);
        if (actualCmds.join('') !== expectedCmds.join('')) {
          diffs.push({ path: attrPath, actual: av, expected: ev, tolerance });
          continue;
        }
        // Compare numeric arguments
        const actualNums = extractNumbers(av);
        const expectedNums = extractNumbers(ev);
        if (actualNums.length !== expectedNums.length) {
          diffs.push({ path: attrPath, actual: av, expected: ev, tolerance });
          continue;
        }
        for (let i = 0; i < actualNums.length; i++) {
          const delta = Math.abs(actualNums[i] - expectedNums[i]);
          if (delta > tolerance) {
            diffs.push({
              path: `${attrPath}[${i}]`,
              actual: String(actualNums[i]),
              expected: String(expectedNums[i]),
              delta,
              tolerance,
            });
          }
        }
        continue;
      }

      if (name === 'points' || name === 'viewBox') {
        const actualNums = extractNumbers(av);
        const expectedNums = extractNumbers(ev);
        if (actualNums.length !== expectedNums.length) {
          diffs.push({ path: attrPath, actual: av, expected: ev, tolerance });
          continue;
        }
        for (let i = 0; i < actualNums.length; i++) {
          const delta = Math.abs(actualNums[i] - expectedNums[i]);
          if (delta > tolerance) {
            diffs.push({
              path: `${attrPath}[${i}]`,
              actual: String(actualNums[i]),
              expected: String(expectedNums[i]),
              delta,
              tolerance,
            });
          }
        }
        continue;
      }

      if (name === 'transform') {
        const actualTx = parseTransformAttr(av);
        const expectedTx = parseTransformAttr(ev);
        if (actualTx.length !== expectedTx.length) {
          diffs.push({ path: attrPath, actual: av, expected: ev, tolerance });
          continue;
        }
        for (let i = 0; i < actualTx.length; i++) {
          const at = actualTx[i];
          const et = expectedTx[i];
          if (at.type !== et.type) {
            diffs.push({
              path: `${attrPath}[${i}].type`,
              actual: at.type,
              expected: et.type,
              tolerance,
            });
            continue;
          }
          if (at.params.length !== et.params.length) {
            diffs.push({ path: `${attrPath}[${i}]`, actual: av, expected: ev, tolerance });
            continue;
          }
          for (let j = 0; j < at.params.length; j++) {
            const delta = Math.abs(at.params[j] - et.params[j]);
            if (delta > tolerance) {
              diffs.push({
                path: `${attrPath}[${i}].param[${j}]`,
                actual: String(at.params[j]),
                expected: String(et.params[j]),
                delta,
                tolerance,
              });
            }
          }
        }
        continue;
      }

      // Non-numeric, non-special attribute: must match exactly
      diffs.push({ path: attrPath, actual: av, expected: ev, tolerance });
    }

    // Children comparison
    const actualChildren = actual.children ?? [];
    const expectedChildren = expected.children ?? [];

    if (actualChildren.length !== expectedChildren.length) {
      diffs.push({
        path: `${path}[childCount]`,
        actual: String(actualChildren.length),
        expected: String(expectedChildren.length),
        tolerance,
      });
      return; // structural mismatch — stop recursing into children
    }

    // Track sibling index per tag for XPath-like notation
    const tagCounters: Record<string, number> = {};
    for (let i = 0; i < actualChildren.length; i++) {
      const ac = actualChildren[i];
      const ec = expectedChildren[i];

      let childPath: string;
      if (ac.type === 'element' && ac.tag !== undefined) {
        tagCounters[ac.tag] = (tagCounters[ac.tag] ?? 0) + 1;
        const idx = tagCounters[ac.tag];
        childPath = `${path}/${ac.tag}[${idx}]`;
      } else {
        childPath = `${path}/text()[${i + 1}]`;
      }

      compareNodes(ac, ec, childPath, tolerance, diffs);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function compareSvg(
  actual: string,
  reference: string,
  toleranceClass: string,
  toleranceOverride?: number,
): { pass: boolean; diffs: Diff[] } {
  const tolerance =
    toleranceOverride ?? TOLERANCES[toleranceClass] ?? TOLERANCES['deterministic'];
  const diffs: Diff[] = [];

  const actualNorm = normalizeSvg(actual);
  const refNorm = normalizeSvg(reference);

  compareNodes(actualNorm, refNorm, actualNorm.tag ?? 'svg', tolerance, diffs);

  return { pass: diffs.length === 0, diffs };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [, , actualPath, refPath, toleranceClass] = process.argv;
  if (!actualPath || !refPath || !toleranceClass) {
    process.stderr.write(
      'Usage: node dist/test/golden/compare.js <actualPath> <refPath> <toleranceClass>\n',
    );
    process.exit(2);
  }

  const actualSvg = readFileSync(actualPath, 'utf8');
  const refSvg = readFileSync(refPath, 'utf8');

  const { pass, diffs } = compareSvg(actualSvg, refSvg, toleranceClass);
  if (!pass) {
    const shown = diffs.slice(0, 10);
    for (const d of shown) {
      process.stderr.write(
        `DIFF ${d.path}: actual=${d.actual} expected=${d.expected}${d.delta !== undefined ? ` delta=${d.delta.toFixed(6)}` : ''}\n`,
      );
    }
    if (diffs.length > 10) {
      process.stderr.write(`... and ${diffs.length - 10} more diff(s)\n`);
    }
    process.exit(1);
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// In-source Vitest tests
// ---------------------------------------------------------------------------

if (import.meta.vitest) {
  const { describe, test, expect } = import.meta.vitest;

  const MINIMAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <g><ellipse cx="50.0" cy="50.0" rx="20" ry="10"/></g>
</svg>`;

  describe('compareSvg', () => {
    // AC1: identical SVGs → pass
    test('AC1: identical SVGs pass', () => {
      const { pass, diffs } = compareSvg(MINIMAL_SVG, MINIMAL_SVG, 'deterministic');
      expect(pass).toBe(true);
      expect(diffs).toHaveLength(0);
    });

    // AC2: cx differs by 0.005 with deterministic (0.01 tolerance) → pass
    test('AC2: cx within tolerance passes', () => {
      const actual = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <g><ellipse cx="50.005" cy="50.0" rx="20" ry="10"/></g>
</svg>`;
      const { pass, diffs } = compareSvg(actual, MINIMAL_SVG, 'deterministic');
      expect(pass).toBe(true);
      expect(diffs).toHaveLength(0);
    });

    // AC3: cx differs by 0.6 with deterministic (0.01 tolerance) → fail, diff contains @cx
    test('AC3: cx outside tolerance fails with @cx in path', () => {
      const actual = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <g><ellipse cx="50.6" cy="50.0" rx="20" ry="10"/></g>
</svg>`;
      const { pass, diffs } = compareSvg(actual, MINIMAL_SVG, 'deterministic');
      expect(pass).toBe(false);
      const cxDiff = diffs.find((d) => d.path.includes('@cx'));
      expect(cxDiff).toBeDefined();
      expect(cxDiff?.delta).toBeGreaterThan(0.01);
    });

    // AC4: one fewer <g> element → fail, structural diff
    test('AC4: missing child element produces structural diff', () => {
      const actual = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
</svg>`;
      const { pass, diffs } = compareSvg(actual, MINIMAL_SVG, 'deterministic');
      expect(pass).toBe(false);
      const structuralDiff = diffs.find((d) => d.path.includes('childCount'));
      expect(structuralDiff).toBeDefined();
    });
  });
}
