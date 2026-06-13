# T3 — compassPort + poly_port (AD2)

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz; C at
`~/git/graphviz/lib` (tag 15.0.0) is the spec. Vitest, strict TS,
JSDoc @see per ported block. Suite baseline 1466/0, 82 goldens.
Hook rule: smallest fix, ≤2 attempts per file, then move on.
Hook limits: 30 lines/fn, CCN 10, 5 params, 500 lines/file.

Batch 1 (T1, T2) is done. `chkPort` is wired; `POLY_FNS.portfn` is
still `null` in `shapes.ts`. This task creates the port-resolution
module for polygon shapes.

## Task

Create `src/common/compass-port.ts` with:

1. **`compassPort(n, bp, pp, compass, sides, ictxt)`** — port C's
   `shapes.c:compassPort:2698` (~183 LOC). Due to the 30-line hook
   limit, split into private helpers within the same file:
   - `compassBbox(n, bp)` → `{ b: Box, p: Point, defined: boolean }`:
     computes the reference bbox from bp or node dims (flip-aware).
     @see `shapes.c:2711-2731`
   - `compassDirection(compass, b, p, maxv)` → direction+side fields
     (the large switch on `"n"`, `"ne"`, `"e"`, `"se"`, `"s"`, `"sw"`,
     `"w"`, `"nw"`, `"_"`, `"c"`, `""`). @see `shapes.c:2733-2840`
   - `compassPort(n, bp, pp, compass, sides, ictxt)` — thin
     orchestrator calling the above and populating `pp`. Exported.
   Export only `compassPort`.

2. **`poly_port(n, portname, compass)`** — C's `shapes.c:2880`. Logic:
   - If `ND_label(n).html` is true, call `htmlPort(n, portname, sides)`
     (from T7 — at this stage, import the stub that returns null); if
     result non-null, call `compassPort(n, bp, rv, compass, sides, null)`.
   - Else call `compassPort(n, null, rv, portname, sides, ictxt)`.
   Returns a `Port`. @see `shapes.c:2880`.
   NOTE: `htmlPort` is not ported until T7. `poly_port` must call it
   via a nullable import; the HTML branch returns a zero-port with
   `defined: false` until T7 lands.

3. Set `POLY_FNS.portfn = poly_port` in `src/common/shapes.ts`.

4. Write TDD tests in `src/common/compass-port.test.ts`:
   - `compassPort` for each of the 8 directions + center + dyna (`_`):
     verify `p`, `side`, `theta`, `clip`, `dyna`, `defined`
   - LR (flip) graph: verify `compassPort` uses `ND_ht/lw` correctly
   - `poly_port` without HTML label: delegates to `compassPort`

## Write-set (strict — nothing else)

- `src/common/compass-port.ts` (new)
- `src/common/compass-port.test.ts` (new)
- `src/common/shapes.ts` (set POLY_FNS.portfn only)

## Read-set

- `~/git/graphviz/lib/common/shapes.c:2674-2930` — compassPort comment,
  compassPort body, poly_port body (full — port all branches)
- `src/common/shapes.ts:39-65` — POLY_FNS definition
- `src/common/types.ts:270-285` — ShapeFunctions.portfn signature
- `src/model/geom.ts:85-100` — Port interface fields
- `src/model/edgeInfo.ts:330-345` — makePort() zero-init
- `src/model/node.ts` — NodeInfo fields (ht, lw, coord, flip-aware)

## Architecture decisions (locked)

AD1 (`Port.bp` value copy), AD2 (split compassPort, same file), AD6
(0.5 pt tolerance for new goldens), AD-C1.
`ictxt` (inside_t): pass `null` always — the inside_t clipping path
for exotic polygon shapes is deferred (open question AD2 in decisions.md).

## Acceptance criteria

- Given `compassPort(n, null, pp, 'n', 0, null)` on a 54×36pt node
  centered at origin, then `pp.p ≈ {x:0, y:18}`, `pp.side === TOP`,
  `pp.theta ≈ -π/2`, `pp.defined === true`, `pp.clip === true`
- Given `compassPort(n, null, pp, 's', 0, null)`, then `pp.p ≈
  {x:0, y:-18}`, side `BOTTOM`
- Given `compassPort(n, null, pp, '_', 0, null)`, then `pp.dyna ===
  true`, `pp.defined === false`
- Given `compassPort(n, null, pp, '', 0, null)`, then `pp.defined ===
  false` (center, no port)
- Given `poly_port` called with portname `'n'` on a non-HTML node,
  then `port.side === TOP` and `port.defined === true`
- tsc clean; 0 vitest failed; 82 goldens byte-identical (T6 needed
  before goldens can change)

## Quality bar

`npx tsc --noEmit` clean. `npx vitest run` 0 failed, ≥1466 passed.
82 goldens byte-identical. Commit: `feat(T3): port compassPort and
poly_port; wire POLY_FNS.portfn`.
