# T6 — spline attachment: beginpath / endpath port offset + clip

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz; C at
`~/git/graphviz/lib` (tag 15.0.0) is the spec. Vitest, strict TS,
JSDoc @see per ported block. Suite baseline 1466/0, 82 goldens.
Hook rule: smallest fix, ≤2 attempts per file, then move on.
Hook limits: 30 lines/fn, CCN 10, 5 params, 500 lines/file.

Batches 1–3 are done. `compassPort`, `record_port`, and the real
`resolvePort` are live. `initEdgeLabels` sets `tail_port.p` and
`head_port.p` correctly for edges with ports. BUT the spline attachment
code in `src/common/splines-path-begin.ts` and
`src/common/splines-path-end.ts` already reads `tail_port.p` and
`head_port.p` — they are added to `ND_coord` in `beginpath:393`
(`P->start.p = add_pointf(ND_coord(n), ED_tail_port(e).p)`). This is
already ported (`splines-path-begin.ts:230`).

This task's job is the remaining gap: the **side-specific routing box
logic** in `beginpath` (the `if (side & TOP)` / `if (side & BOTTOM)`
/ etc. blocks, lines 407–555 in `lib/common/splines.c`) and the
equivalent in `endpath`. Currently `src/layout/dot/edge-route-boxes.ts`
implements only the no-port case. Port the side-mask routing boxes for
when `ED_tail_port(e).side` is non-zero.

## Task

1. In `src/layout/dot/edge-route-boxes.ts`, extend (or add adjacent
   functions) to handle the `side` cases from `beginpath` and
   `endpath`:
   - When `tail_port.side & TOP`: build the two routing boxes that
     steer the spline out through the top face. @see
     `lib/common/splines.c:beginpath:407-450` (TOP branch).
   - When `tail_port.side & BOTTOM`: bottom face routing boxes.
   - When `tail_port.side & LEFT / RIGHT`: left/right face routing.
   - Same structure for `head_port.side` in endpath.
   Each branch mirrors the C box arithmetic exactly — no simplification.

2. In `src/layout/dot/edge-route-boxes.ts`, update the caller(s) in
   `src/layout/dot/edge-route.ts` (or wherever `tailBox`/`headBox` are
   assembled for regular edges) to consult `tail_port.side` and
   dispatch to the port-routing box builder.

3. Verify `splines-path-begin.ts` and `splines-path-end.ts` already
   handle `tail_port.dyna` resolution (they call `resolvePort` — now
   real). Read those files before writing anything.

4. TDD tests:
   - Add fixtures in `src/layout/dot/edge-route-boxes.test.ts` (or
     `splines.test.ts`) for an edge with `tail_port.side === TOP`:
     verify the tail routing boxes steer upward.
   - Integration test: render `digraph G { A -> B [headport=n,
     tailport=s]; }` via the full dot pipeline and assert the spline
     path starts/ends at the correct y coordinates (compare to C
     oracle: `M27,-72C27,-60.62 27,-55.32 27,-47.45`).

## Write-set (strict — nothing else)

- `src/layout/dot/edge-route-boxes.ts`
- `src/layout/dot/edge-route.ts` (dispatch to port-side routing only)
- `src/layout/dot/edge-route-boxes.test.ts` OR
  `src/layout/dot/splines.test.ts` (extend)

## Read-set

- `~/git/graphviz/lib/common/splines.c:378-570` — beginpath full;
  focus on the port-routing box blocks (side mask dispatch,
  lines 407–555)
- `~/git/graphviz/lib/common/splines.c:575-770` — endpath full;
  same port-routing blocks
- `src/layout/dot/edge-route-boxes.ts` — full (only write target)
- `src/layout/dot/edge-route.ts` — the call sites that use tailBox/
  headBox
- `src/common/splines-path-begin.ts` — full (verify resolvePort call
  and coord offset are already correct)
- `src/common/splines-path-end.ts` — full (same verification)
- `src/common/splines-constants.ts` — TOP, BOTTOM, LEFT, RIGHT bitmask
  values

## Architecture decisions (locked)

AD1, AD6 (0.5 pt tolerance for port-using goldens), AD-C1. Do NOT
simplify the box arithmetic — every branch in C encodes a routing
quirk from user-reported bugs.

## Acceptance criteria

C oracle: `digraph G { A -> B [headport=n, tailport=s]; }`
- dot -Tsvg produces path: `M27,-72C27,-60.62 27,-55.32 27,-47.45`
  (exits node bottom center, enters top center)
- When T6 is applied, the TS pipeline for this input must match within
  0.5 pt at each control point
C oracle: `digraph G { rankdir=LR; A -> B [headport=w, tailport=e]; }`
- dot -Tsvg produces path: `M54,-18C65.38,-18 70.68,-18 78.55,-18`
- TS pipeline matches within 0.5 pt

tsc clean; 0 vitest failed; 82 existing goldens conformant (port-
using goldens added in T8).

## Quality bar

`npx tsc --noEmit` clean. `npx vitest run` 0 failed, ≥1466 passed.
82 goldens conformant. Commit: `feat(T6): port beginpath/endpath
side-mask routing boxes for port attachment`.
