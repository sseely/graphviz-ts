# T3 — Guard tests for unported-path throws

## Context

The port guards unported C surfaces with `throw new Error(...)` so they
fail loudly instead of silently diverging. None of these guards has a
test, so a refactor could silently delete one. Recon located these (line
numbers approximate — verify with grep/serena before writing):

| Guard | Location | Trigger |
|-------|----------|---------|
| sfdp smoothing | src/layout/sfdp/init.ts (~140) | graph attr `smoothing` ≠ none |
| sfdp overlap | src/layout/sfdp/index.ts (~80) | graph attr `overlap` ≠ default prism0 |
| sfdp prism ntry>0 | src/layout/sfdp/spring-driver.ts (~280) | overlap="prism" with ntry>0 |
| sfdp beautify_leaves | src/layout/sfdp/spring-electrical.ts (~68) | ctrl.beautifyLeaves |
| fdp overlap mode | src/layout/fdp/xlayout.ts (~60) | overlap attr requesting removal |
| fdp compound | src/layout/fdp/layout.ts (~120) | clust-node + compound=true |
| ortho trap-query | src/ortho/trap-query.ts (~250) | degenerate endpoint case |

## Task

For each guard reachable from a public entry point (parse + layout/render
with a crafted graph attr): a test that asserts the throw (match a
distinctive substring of the message) plus a default-attrs control test
asserting no throw. For guards NOT reachable from public API (e.g. the
ortho trap-query default case, beautifyLeaves if no attr maps to it),
call the internal function directly with the triggering input — do not
invent an attr channel that C doesn't have. If a guard turns out to be
truly unconstructible, document why in the test file as a comment and
skip it (journal entry).

Place tests in NEW co-located files (e.g. src/layout/sfdp/guards.test.ts,
src/layout/fdp/guards.test.ts, src/ortho/trap-query.test.ts) — do not
edit existing test files.

## Write-set

src/layout/sfdp/guards.test.ts, src/layout/fdp/guards.test.ts,
src/ortho/trap-query.test.ts (new files only)

## Read-set

The 7 guard sites (grep `throw new Error` under src/layout/sfdp,
src/layout/fdp, src/ortho); test/golden/inputs/sfdp-simple.dot and
fdp-simple.dot as graph templates

## Acceptance criteria

- Given `smoothing="spring"` on an sfdp graph, when layout runs, then the
  guard error throws
- Given default attrs on the same graph, when layout runs, then no throw
- Equivalent trigger+control pairs for every reachable guard; direct-call
  tests for internal-only guards
- Given `npx vitest run`, then suite green with the new tests counted

## Observability: N/A. Rollback: Reversible.

## Quality bar

npx tsc --noEmit clean; npx vitest run green. Commit:
`test(T3): add guard tests for unported-path throws`
