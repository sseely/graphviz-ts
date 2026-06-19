# T2 — Fix the spline-fit segmentation to match C

## Context
Same mission as [T1-diagnose.md](T1-diagnose.md). T1 identified the exact port
function whose spline-fit emits a different bezier control-point count than C,
with the C reference and ground-truth control points (see `decision-journal.md`).

## Task
Faithfully port the C spline-fitting branch so `graphs/jcctree.gv`,
`graphs/p2.gv`, `graphs/pm2way.gv` produce the SAME bezier segmentation as the
oracle. Implement exactly what C does (AD-1) — do not smooth/simplify. Add a
test that locks the corrected spline for these inputs.

1. Read the C function named in T1's findings (`cRef`) and its callees; port the
   exact control-point construction / segmentation logic into `divergentFn`.
2. Preserve side-effect order and edge cases; cite the C `file:line` in JSDoc.
3. Add a colocated `*.test.ts` asserting the fixed edge path for ≥1 input
   (assert the bezier command structure / control-point count, per
   `testing.md` assertion-quality).

## Write-set
- `src/layout/dot/<file from T1>` (Modify) — the divergent spline-fit function.
- `src/layout/dot/<file>.test.ts` (Create or extend) — lock the fix.
- If T1 shows the count diverges in emission (unlikely): `src/render/svg-helpers.ts`
  — only with a decision-journal entry justifying the out-of-T1-prediction edit.

## Read-set
- `decision-journal.md` (T1 row: `divergentFn`, `cRef`, `rootCause`).
- The C function at `cRef` (+ callees) in `~/git/graphviz/lib/dotgen/` /
  `lib/pathplan/`.
- `decisions.md#ad-1-match-c-exactly`, `#ad-3`.

## Architecture decisions (locked)
AD-1 match C exactly; AD-3 oracle-pinned, curated gate untouched.

## Acceptance criteria (Given/When/Then)
- **Given** `jcctree`/`p2`/`pm2way`, **when** rendered, **then** each edge `@d`
  byte/structural-matches the oracle (control-point count + coords).
- **Given** the survey, **when** re-run, **then** these inputs move
  `diverged → byte-match`/`structural-match`, and the per-id diff vs the pre-task
  snapshot shows **0 regressions**.
- **Given** the curated suite, **when** `npx vitest run`, **then** the 128
  goldens are byte-identical and all tests pass (incl. the new spline test).
- **Given** the changed files, **when** `lizard`/`tsc` run, **then** clean.

## Observability
N/A — dev/test fidelity.

## Rollback notes
Reversible — revert the commit.

## Boundaries
- **Always:** port C exactly; verify each input vs the oracle; keep goldens
  byte-identical.
- **Never:** modify `test/golden/manifest.json` / `suite.test.ts`; "improve" the
  bezier output; expand to large-delta routing cases.
- **STOP:** if matching C requires files outside the T1 write-set, or the same
  location is changed 3× without resolving.

## Commit
`fix(T2): match C bezier segmentation for dot edge splines`.

## Quality bar
tsc 0; vitest 0 failures + 128 goldens byte-identical; survey 0 regressions +
targets improved; lizard clean. Return only the structured result.
