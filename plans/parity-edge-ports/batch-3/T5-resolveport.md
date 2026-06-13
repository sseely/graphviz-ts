# T5 — resolvePort + closestSide (stub → real)

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz; C at
`~/git/graphviz/lib` (tag 15.0.0) is the spec. Vitest, strict TS,
JSDoc @see per ported block. Suite baseline 1466/0, 82 goldens.
Hook rule: smallest fix, ≤2 attempts per file, then move on.
Hook limits: 30 lines/fn, CCN 10, 5 params, 500 lines/file.

Batch 2 (T3 + T4) is done: `compassPort`, `poly_port`, `record_port`
are ported and wired. `resolvePort` in
`src/common/splines-path-shared.ts:60` is still the identity stub
(returns port unchanged). This task replaces the stub with the real
implementation, which requires porting `closestSide` first.

`resolvePort` is called from `splines-path-begin.ts:227` and
`splines-path-end.ts:217` when `port.dyna === true` (the `_` compass
direction). It picks the compass point on the node boundary closest to
the other endpoint, then re-runs `compassPort`.

## Task

1. Port `closestSide(n, other, oldport)` in
   `src/common/splines-path-shared.ts` as a non-exported helper:
   - Reads `oldport.side` bitmask; if 0 or all-sides, returns `null`
     (use center).
   - Computes `pt = ND_coord(n)` and `opt = ND_coord(other)` in the
     rankdir-converted frame (call `cvtPt` or the TS equivalent used
     in position.ts).
   - Iterates the 4 bit positions (BOTTOM_IX, RIGHT_IX, TOP_IX,
     LEFT_IX); for each set bit, computes midpoint of that face of the
     bbox and picks the face with minimum distance to `opt`.
   - Returns the compass string `"s" | "e" | "n" | "w" | null`.
   @see `lib/common/shapes.c:4248-4320`.

2. Replace the `resolvePort` stub body in
   `src/common/splines-path-shared.ts`:
   - Call `closestSide(n, other, port)` → compass string or null.
   - Copy `port.name` to `rv.name`.
   - Call `compassPort(n, port.bp, rv, compass ?? '', port.side, null)`.
   - Return `rv`.
   @see `lib/common/shapes.c:4322-4332`.

3. TDD tests in `src/common/splines-path-shared.test.ts` (create or
   extend):
   - `closestSide` with `side === 0` returns null
   - `closestSide` with TOP|BOTTOM|LEFT|RIGHT (all) returns null
   - `closestSide` on a node at origin with `side === TOP`, other
     above → returns `'n'`
   - `closestSide` on a node at origin with `side === TOP`, other
     below → returns `'n'` (only available side)
   - `resolvePort` with `dyna=false` port: identity behavior unchanged
   - `resolvePort` with `dyna=true` port: calls `closestSide` and
     `compassPort`; verify `rv.p` is non-zero for a real node

## Write-set (strict — nothing else)

- `src/common/splines-path-shared.ts`
- `src/common/splines-path-shared.test.ts` (create or extend)

## Read-set

- `~/git/graphviz/lib/common/shapes.c:4248-4340` — closestSide +
  resolvePort (full, port every branch)
- `src/common/splines-path-shared.ts` — full file (only write target)
- `src/common/splines-path-begin.ts:220-235` — resolvePort call site,
  to verify no signature change needed
- `src/common/splines-path-end.ts:210-225` — resolvePort call site
- `src/common/compass-port.ts` — compassPort (from T3)
- `src/layout/dot/position.ts` — cvtPt / coord conversion equivalent

## Architecture decisions (locked)

AD1 (`Port.bp` value copy passed through to compassPort), AD2 (no new
abstractions), AD-C1.

## Acceptance criteria

- Given `resolvePort(n, other, { dyna: false, ...port })`, when called,
  then returns port unchanged (regression guard)
- Given `resolvePort(n, other, { dyna: true, side: TOP, bp: null })`,
  where other is directly above n, then `rv.p.y > 0` (top of node),
  `rv.side === TOP`
- Given `closestSide(n, other, { side: 0 })`, then returns null
- tsc clean; 0 vitest failed; 82 goldens byte-identical (T6 needed for
  the geometric change to reach SVG output)

## Quality bar

`npx tsc --noEmit` clean. `npx vitest run` 0 failed, ≥1466 passed.
82 goldens byte-identical. Commit: `feat(T5): port closestSide and
make resolvePort real`.
