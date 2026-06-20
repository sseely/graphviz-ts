# T2 — Implement the pinned routeSplines equivariance fix

## Context
Start on `fix/nonadjacent-flat-5ne8nw` (off `main`). T1 pinned the exact sub-step
and line where `routeSplines` breaks translation-equivariance (the mirror), in
`plans/nonadjacent-flat-5ne8nw/findings-mirror-mechanism.md`, and verified
(throwaway) that the candidate fix makes the `5:ne->8:nw` knot land tail-side
(internal x≈405, matching C). This task implements that fix and flips the RED
equivariance test green.

## Task
1. Read T1's `findings-mirror-mechanism.md` — implement EXACTLY the confirmed fix
   at the named `fixLine`. It is a faithful match to C's algorithm
   (`Pshortestpath`/`Proutespline` in `lib/pathplan/`, `routespl.c`) at that line —
   remove the absolute-coordinate dependence / orientation bug so the fitter is
   translation-equivariant. Implement whatever T1 proved, not a guess.
2. Keep it MINIMAL and general (AD-2): fix the geometry at its source; NO
   `5:ne->8:nw`- or flat-specific branch; reuse existing helpers; no new
   abstractions.
3. If (and only if) the fix touches `routeFlatEdgeFaithful`'s step-size line, also
   correct `stepx`/`stepy` to `Multisep/(cnt+1)` per C (findings-diagnosis.md
   §latent). Otherwise leave it.
4. Flip the tripwire: change the T1 `it.fails(...)` equivariance test to a normal
   passing `it(...)`; it must now pass (outputs are +27 translates; `5:ne->8:nw`
   knot tail-side).

## Boundaries
- **Always do:** keep the change minimal and at the pinned line; functions ≤30
  lines / CCN ≤10 / ≤5 params (lizard).
- **Never do:** add edge-type special-cases; rewrite the funnel/fit geometry
  wholesale; chase the +27 frame offset; revert the #241_0 curl/arrow fixes (AD-3).
- **Stop if:** the minimal fix flips out-of-`#241_0`-family curated goldens while
  iterating locally (that is T3's full gate, but if you see it, STOP and inspect —
  the fitter is global, so a broad flip means the fix is wrong).

## Write-set
- `src/common/splines-routespl.ts` and/or `src/pathplan/*` (Edit) — the pinned
  equivariance fix (exact file per T1).
- `src/common/splines-routespl.test.ts` (Edit) — flip equivariance test → passing.
- `src/layout/dot/splines-flat.ts` (Edit) — ONLY if T1's fix touches the step-size
  line (the `Multisep/(cnt+1)` correction).

## Read-set
- `decisions.md` (AD-2, AD-3); `findings-mirror-mechanism.md`; `findings-diagnosis.md`
- `src/common/splines-routespl.ts`; `src/pathplan/` (shortestPath, routeSpline)

## Acceptance criteria
- The equivariance test is GREEN (outputs are +27 translates; `5:ne->8:nw` knot
  internal x≈405); the `.fails` marker is removed.
- `npx tsc --noEmit` exit 0; `npx vitest run` 0 failures (full regression is T3,
  but the suite must not error and no out-of-family golden may flip here).
- `lizard` on changed files clean; `git diff --name-only` within write-set.

## Observability / Rollback
N/A offline lib. Reversible. One commit:
`fix(spline): make routeSplines translation-equivariant (closes #241_0)`. Body
cites the diagnosis + the pinned line (per `~/.claude/rules/commits.md`). Return to
the orchestrator: the exact change, the pinned line, and the green-test confirmation.
