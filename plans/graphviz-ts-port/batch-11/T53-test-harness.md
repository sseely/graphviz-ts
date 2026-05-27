# T53 — Golden-File Test Harness

## Context

Stack: TypeScript 5.x strict, Vitest, esbuild, EPL-2.0.

This task creates the test infrastructure used by T55 (end-to-end diff
runner). The harness has three components: a shell script that drives
the comparison pipeline, an SVG normalizer that removes non-semantic
differences, and a coordinate-aware diff tool that applies per-engine
tolerances.

This task runs in parallel with T54. Neither depends on the other.

## Task

Write three files:

### test/golden/run.sh

Shell script that:
1. Accepts a manifest path as argument; defaults to
   `test/golden/manifest.json`
2. For each entry in the manifest, calls the TypeScript port's CLI to
   render the input `.dot` file with the specified engine
3. Runs `compare.ts` against the output and the reference SVG
4. Accumulates pass/fail counts
5. Exits 0 only if all entries pass; exits 1 with a summary otherwise

The script must be executable (`chmod +x`). It uses `node` to run the
TypeScript port's CLI (assumed built by esbuild). It sources the
engine name and tolerance class from each manifest entry.

```bash
#!/usr/bin/env bash
set -euo pipefail

MANIFEST="${1:-test/golden/manifest.json}"
PASS=0; FAIL=0

while IFS= read -r entry; do
  input=$(echo "$entry" | jq -r '.input')
  ref=$(echo "$entry" | jq -r '.reference')
  engine=$(echo "$entry" | jq -r '.engine')
  tol=$(echo "$entry" | jq -r '.toleranceClass')

  actual=$(mktemp /tmp/graphviz-ts-XXXXXX.svg)
  node dist/cli.js -K "$engine" -Tsvg "$input" > "$actual"

  if node dist/test/golden/compare.js "$actual" "$ref" "$tol"; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $input ($engine)"
  fi
  rm -f "$actual"
done < <(jq -c '.[]' "$MANIFEST")

echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
```

The script requires `jq` on PATH. If `jq` is not found, print an error
and exit 2.

### test/golden/normalize.ts

SVG normalization functions. The normalizer must handle:

1. **Whitespace**: collapse all runs of whitespace (including newlines)
   in text content to single space; trim leading/trailing whitespace.

2. **Floating-point formatting**: parse all numeric string values in
   SVG attributes (e.g. `x`, `y`, `cx`, `cy`, `width`, `height`,
   `d` path data coordinates, `points` polyline values) and
   re-serialize to 6 significant figures. This prevents spurious diffs
   from `1.000000` vs `1.0`.

3. **Attribute order**: sort attributes within each element
   alphabetically by name before comparison. SVG attribute order is not
   semantically significant.

4. **Comment nodes**: remove all XML comment nodes.

5. **`<?xml ...?>` declaration**: strip the XML declaration if present.

Export:
```typescript
export interface NormalizedNode {
  type: 'element' | 'text';
  tag?: string;                      // element only
  attrs?: Record<string, string>;    // element only, sorted by key
  text?: string;                     // text only
  children?: NormalizedNode[];       // element only
}

export function normalizeSvg(svgString: string): NormalizedNode;
```

Use the built-in `DOMParser` via `@xmldom/xmldom` (already in devDeps
or add it). Do not use regex to parse SVG — parse it as XML.

### test/golden/compare.ts

Comparison tool. Accepts: `actualPath`, `referencePath`, `toleranceClass`.

Tolerance classes:
```typescript
export const TOLERANCES: Record<string, number> = {
  deterministic: 0.01,  // dot, circo, twopi, osage, patchwork
  iterative: 0.5,        // neato, fdp, sfdp
};
```

Engine-to-tolerance-class mapping:
```typescript
export const ENGINE_TOLERANCE_CLASS: Record<string, string> = {
  dot:       'deterministic',
  circo:     'deterministic',
  twopi:     'deterministic',
  osage:     'deterministic',
  patchwork: 'deterministic',
  neato:     'iterative',
  fdp:       'iterative',
  sfdp:      'iterative',
};
```

**Comparison algorithm:**

1. Parse and normalize both SVG strings.
2. **Structural comparison** (exact match required):
   - Same root element tag (`svg`)
   - Same number of child elements at each level
   - Same element types (tags) in same positions
   - Same nesting hierarchy
   - Non-numeric string attribute values must match exactly
     (fill, stroke, font-family, id, class, etc.)
3. **Coordinate comparison** (tolerance applied):
   - Numeric attributes: `x`, `y`, `cx`, `cy`, `rx`, `ry`, `width`,
     `height`, `x1`, `y1`, `x2`, `y2`, `dx`, `dy`, `r`
   - SVG `d` path data: parse into commands and compare each numeric
     argument within tolerance
   - `points` polyline/polygon: parse as space/comma-separated pairs,
     compare each coordinate within tolerance
   - `transform` attribute: parse `translate(x,y)`, `scale(x,y)`,
     `rotate(a)`, `matrix(a,b,c,d,e,f)` — compare each parameter
     within tolerance; matrix type must match exactly
4. Collect all differences; on first structural mismatch, stop and
   report.
5. Return value: `{ pass: boolean; diffs: Diff[] }`.

```typescript
interface Diff {
  path: string;         // XPath-like: e.g. "svg/g[2]/ellipse/@cx"
  actual: string;
  expected: string;
  delta?: number;       // for numeric diffs only
  tolerance: number;
}

export function compareSvg(
  actual: string,
  reference: string,
  toleranceClass: string,
): { pass: boolean; diffs: Diff[] };
```

When called as CLI (`node dist/test/golden/compare.js actualPath
refPath toleranceClass`), exits 0 on pass, exits 1 and prints the
first 10 diffs to stderr on failure.

## Write-Set

- `test/golden/run.sh`
- `test/golden/compare.ts`
- `test/golden/normalize.ts`

## Read-Set

- `~/git/graphviz/docs/architecture/lib/circogen.md` — to understand
  which SVG elements circo produces (verify element structure assumptions)
- `~/git/graphviz/docs/architecture/lib/twopigen.md` — same for twopi

## Architecture Decisions

None from the locked decision list apply directly. XML parsing must use
a real XML parser, not regex.

## Interface Contracts

`compareSvg` must be importable from TypeScript test code:
```typescript
import { compareSvg } from '../compare.ts';
```

`normalizeSvg` must be importable from `compare.ts`:
```typescript
import { normalizeSvg } from '../normalize.ts';
```

`run.sh` takes an optional manifest path argument and exits 0 iff all
tests pass.

## Acceptance Criteria

1. Given two identical SVG strings, `compareSvg` returns
   `{ pass: true, diffs: [] }`. Unit test in `compare.ts` verifies this
   with a minimal SVG containing an ellipse.

2. Given actual SVG where one `cx` attribute differs by 0.005 pt from
   reference, and `toleranceClass = 'deterministic'` (tolerance 0.01),
   `compareSvg` returns `{ pass: true }`.

3. Given actual SVG where one `cx` attribute differs by 0.6 pt from
   reference, and `toleranceClass = 'deterministic'` (tolerance 0.01),
   `compareSvg` returns `{ pass: false }` and `diffs[0].path` contains
   `@cx`.

4. Given actual SVG with one fewer `<g>` element than reference
   (structural mismatch), `compareSvg` returns `{ pass: false }` and
   the diff identifies a structural difference, regardless of
   `toleranceClass`.

## Observability

N/A

## Rollback

Reversible. `test/golden/` is a new directory. No production code
depends on it.

## Quality Bar

- `tsc --noEmit` exits 0 for `compare.ts` and `normalize.ts`
- `vitest run test/golden/compare.ts` exits 0 (self-contained unit tests
  using the literal SVG strings described in acceptance criteria)
- `run.sh` is executable and contains no bash syntax errors
  (`bash -n test/golden/run.sh` exits 0)
- No `any` casts in `compare.ts` or `normalize.ts`
