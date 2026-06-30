# T3 — Apply the faithful fix + unit test

## Context
T2 localized the first-divergence stage and named the C-faithful corrected
behaviour (see `decision-journal.md`). Apply it. The fix mirrors C
(`ns.c`/`position.c`); no honda-specific special-casing (ADR-3).

## Task
1. Remove any remaining env-gated port instrumentation from T2.
2. Apply the C-faithful fix at the site named by T2 (`@see` the exact C
   function/line in the code comment).
3. Add a focused unit test that pins the corrected behaviour — prefer a small
   synthetic graph with a weight=0 degeneracy (or honda-tokoro itself) asserting
   the specific node cy values / NS balance outcome. Co-locate as
   `<fixed-file>.test.ts` or extend an existing NS/position test.
4. Verify honda-tokoro: render port vs native, all node cy + all 29-ish edge
   `path/@d` conformant.

## Verify
```
export PATH="$HOME/.npm/_npx/fd45a72a545557e9/node_modules/.bin:$PATH"
npm run typecheck
npm test
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg \
  ~/git/graphviz/tests/graphs/honda-tokoro.gv 2>/dev/null > /tmp/ht_n.svg
tsx test/corpus/render-one.ts ~/git/graphviz/tests/graphs/honda-tokoro.gv dot > /tmp/ht_p.svg
diff <(grep -oE 'cy="[^"]*"|d="M[^"]*"' /tmp/ht_n.svg) \
     <(grep -oE 'cy="[^"]*"|d="M[^"]*"' /tmp/ht_p.svg)   # expect empty
```
NOTE: `/tmp/ghl` here still has T1 instrumentation, but the dumps are env-gated
so `-Tsvg` output is clean. Final clean-oracle validation is T4.

## Write-set
- The single file named by T2 (`ns.ts` | `position.ts` | `position-aux.ts` |
  `classify.ts` | an approved-expansion file).
- A `*.test.ts` next to it.

## Read-set
- `decision-journal.md` (T2's localized fix description)
- The matching C function in `ns.c` / `position.c`

## Acceptance criteria
- Given the fix, when honda-tokoro renders, then every node `cy` and every edge
  `path/@d` conforms to native.
- Given the fix, when `npm run typecheck` runs, then no errors.
- Given the fix, when `npm test` runs, then all pass (including the new test).
- Given the code, when reviewed, then the change is a faithful C port with an
  `@see lib/...` reference — no honda-specific branch (ADR-3).
- If honda matches but `npm test` shows a pre-existing NS/position test now
  fails → that test encodes prior (possibly wrong) behaviour; STOP and surface
  it (do not silently rewrite the assertion) per stop-condition 5.

## Observability
N/A.

## Rollback
Reversible — `git revert` the commit. Single logical change.

## Commit (end of T3, only after gates pass — but full survey is T4)
Hold the commit until T4 confirms 0 regressions. If committing incrementally,
use `fix(ns): …` / `fix(position): …` per the localized site.

## Boundaries
- Never do: special-case honda-tokoro, weight=0, or specific node names.
- Ask first: if the fix needs a SECOND file beyond T2's named site →
  write-set-expansion rule.
- Consecutive-fix stop: if the same site is changed 3× without honda matching,
  STOP and document.
