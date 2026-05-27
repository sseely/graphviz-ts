# T55 — End-to-End Golden-File Diff Runner

## Context

Stack: TypeScript 5.x strict, Vitest, esbuild, EPL-2.0.

This task writes the Vitest test suite that feeds each of the 50 inputs
from `manifest.json` through the TypeScript port and diffs the output
against the reference SVG using the comparison tool from T53.

Depends on T53 (harness) and T54 (reference SVGs). Both must be
complete before this task begins.

## Task

Write `test/golden/suite.test.ts` as a Vitest test file. The file must:

1. Read and parse `test/golden/manifest.json` at module load time.
2. For each manifest entry, register a Vitest test with a descriptive
   name.
3. Each test: render the input with the TypeScript port, compare output
   against reference SVG, assert pass.

### Entry point: renderSvg

The TypeScript port exposes:
```typescript
// src/index.ts (or src/cli.ts — read the existing entry point)
export function renderSvg(dotSource: string, engine: string): string;
```

Import it from the appropriate module. Read `src/index.ts` or
`src/cli.ts` to find the correct import path before writing the test.

### Test structure

```typescript
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderSvg } from '../../src/index.js';
import { compareSvg } from './compare.js';

const manifestPath = join(__dirname, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestEntry[];

interface ManifestEntry {
  id: string;
  engine: string;
  toleranceClass: string;
  input: string;
  reference: string;
  description: string;
}

describe('golden-file SVG comparison', () => {
  for (const entry of manifest) {
    test(`${entry.engine} / ${entry.id}`, () => {
      const dotSource = readFileSync(
        join(process.cwd(), entry.input), 'utf8'
      );
      const refSvg = readFileSync(
        join(process.cwd(), entry.reference), 'utf8'
      );

      const actualSvg = renderSvg(dotSource, entry.engine);

      const result = compareSvg(actualSvg, refSvg, entry.toleranceClass);

      if (!result.pass) {
        // Print first differing element for debugging
        const first = result.diffs[0];
        throw new Error(
          `[${entry.id}] SVG mismatch at ${first.path}\n` +
          `  actual:   ${first.actual}\n` +
          `  expected: ${first.expected}\n` +
          (first.delta !== undefined
            ? `  delta: ${first.delta} (tolerance: ${first.tolerance})\n`
            : '')
        );
      }

      expect(result.pass).toBe(true);
    });
  }
});
```

### Test naming convention

Test names must follow: `${entry.engine} / ${entry.id}`. This makes
Vitest's output scannable: all circo failures appear grouped under
`circo /` in the output.

### Tolerance class forwarding

The tolerance class from `entry.toleranceClass` is passed unchanged to
`compareSvg`. The `compareSvg` function resolves the numeric tolerance
from the class name. The test suite does not hard-code any numeric
tolerance values.

### Error output requirements

When a test fails, the error message must include:
1. The `entry.id` for identification
2. The path of the first differing element (XPath-like, from `Diff.path`)
3. The actual value
4. The expected value
5. The numeric delta and tolerance (for numeric diffs only)

The format shown in the template above is the minimum required. Do not
truncate or suppress this information.

### renderSvg signature discovery

Before writing the test, read `src/index.ts` to find the actual
function name and signature that renders SVG from a DOT source string.
If the function has a different name or signature than shown above,
adapt the test accordingly. Do not assume the signature — verify it.

### Test count assertion

Add a suite-level check that exactly 50 tests were registered:
```typescript
test('manifest has 50 entries', () => {
  expect(manifest).toHaveLength(50);
});
```

This ensures the manifest was not accidentally truncated.

## Write-Set

- `test/golden/suite.test.ts`

## Read-Set

- `test/golden/manifest.json` — for entry shapes
- `test/golden/compare.ts` — for `compareSvg` and `Diff` types
- `test/golden/normalize.ts` — understand what normalization is applied
- `src/index.ts` — to find the actual `renderSvg` entry point
  signature and import path

## Architecture Decisions

None from the locked list apply directly.

## Interface Contracts

The test file assumes:
- `compareSvg(actual, reference, toleranceClass): { pass: boolean; diffs: Diff[] }`
  is exported from `./compare.js`
- `renderSvg(dotSource: string, engine: string): string` is exported
  from the main TypeScript port entry point
- `manifest.json` contains exactly 50 entries with the fields defined
  in T54's manifest format

If `renderSvg` throws for a given input+engine combination, the test
fails with the thrown error message (not a comparison diff). Do not
catch and swallow render errors.

## Acceptance Criteria

1. All 50 manifest entries produce a registered test: `vitest run
   test/golden/suite.test.ts --reporter=verbose` output contains
   exactly 50 test names (plus the suite-level count assertion = 51
   total).

2. Tolerance class applied per engine family: inspect the test source —
   `compareSvg` is called with `entry.toleranceClass` (a string), not a
   hard-coded number. Verified by code review, not a runtime assertion.

3. Test name includes engine and input id: the test registered for
   manifest entry `{ engine: 'circo', id: 'circo-simple' }` must have
   name `'circo / circo-simple'`. Verify by running `vitest run
   test/golden/suite.test.ts --reporter=verbose` and checking output
   contains `circo / circo-simple`.

4. Failure output shows first differing element and coordinate: when
   `compareSvg` returns `{ pass: false, diffs: [{path:'...@cx', ...}] }`,
   the thrown error message contains the path, actual, expected, and
   delta values. Verified by a unit test that mocks `compareSvg` to
   return a failing result with a known diff and asserts the error
   message format.

## Observability

N/A

## Rollback

Reversible. `test/golden/suite.test.ts` is a new file.

## Quality Bar

- `tsc --noEmit` exits 0 for `test/golden/suite.test.ts`
- `vitest run test/golden/suite.test.ts` exits 0
  (all 50 + 1 tests pass)
- No `any` casts
- No hard-coded numeric tolerance values in this file
