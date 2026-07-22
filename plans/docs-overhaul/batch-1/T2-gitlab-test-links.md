<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — Gitlab test-links + local-path scrub in dashboards

## Context

The generated parity dashboards leak the author's local machine paths. Example
from `docs-site/parity-circo.md` (mirrored from `test/corpus/PARITY-circo.md`):

```
| 1447 | oracle-error | Command failed: /Users/scottseely/git/graphviz/build/cmd/dot/dot -K circo -Txdot /Users/scottseely/git/graphviz/tests/1447.dot |
```

`test/corpus/dashboard.ts` already gitlab-links the corpus **root** via
`CORPUS_GITLAB = 'https://gitlab.com/graphviz/graphviz/-/tree/main/tests'` and
a `corpusRootMd()` helper — but per-id rows and error messages are emitted
verbatim. Fix: link each test id to its **gitlab blob** and scrub local
absolute paths from messages, across all dashboard generators.

## Task

1. **New shared module `test/corpus/corpus-links.ts`:**
   - `export const CORPUS_GITLAB_BLOB = 'https://gitlab.com/graphviz/graphviz/-/blob/main/tests';`
   - `export function gitlabTestUrl(corpusRelPath: string): string` — join to
     `CORPUS_GITLAB_BLOB`, normalizing separators; strip any leading corpus
     root so input may be `1447.dot` or `imagepath_test/base.gv`.
   - `export function testIdLink(id: string, corpusRelPath?: string): string` —
     markdown `[`id`](url)` when a path is known, else `` `id` `` verbatim.
   - `export function scrubLocalPaths(msg: string, roots?: string[]): string` —
     replace absolute paths under the oracle/corpus roots and `$HOME` with a
     stable form: rewrite a `…/tests/<rel>` occurrence to its gitlab blob URL,
     and replace the oracle binary path with `dot`. Defaults derive roots from
     `CORPUS_ROOT`/`GVBINDIR`/`os.homedir()` but must be **pure** given
     explicit `roots` (for testability).
   - SPDX header.
2. **Apply in the per-id tables** of: `test/corpus/parity-report.ts`
   (per-engine `PARITY-<engine>.md` roster), `test/corpus/dashboard.ts`
   (dot `PARITY-dot.md`), `test/corpus/json-dashboard.ts`,
   `test/corpus/map-dashboard.ts`, `test/corpus/xdot-dashboard.ts`:
   - Render the id column via `testIdLink(id, relPath)`.
   - Pass every embedded error/message string through `scrubLocalPaths()`
     before it enters a table cell.
   - Keep the existing `escText()` escaping — scrub first, then escape.
3. **Regenerate** the source reports so the committed `docs-site/parity-*.md`
   (mirrored by `copy-reports.mjs`) no longer contain `/Users/…`. Use existing
   summaries/JSON where a full re-sweep isn't needed; do **not** run a fresh
   corpus survey (out of scope). If a generator can rebuild its `.md` purely
   from existing `parity-*.json` / summaries, run that. Verify with
   `grep -rl "/Users/" docs-site/parity-*.md` → no matches.

## Read-set

- `test/corpus/dashboard.ts:22-40` (`CORPUS_GITLAB`, `corpusRootMd`) and its
  per-id/error-table emitters
- `test/corpus/parity-report.ts:1-40, 298-340` (engine md, roster rows, `escText`)
- `test/corpus/json-dashboard.ts`, `map-dashboard.ts`, `xdot-dashboard.ts`
  (find the id/message table emitters — grep `oracle-error`, `errMsg`, `escText`)
- `docs-site/copy-reports.mjs` (how PARITY-*.md → docs-site/*.md; do not edit)
- [decisions.md#gitlab-links](../decisions.md#gitlab-links)

## Interface contract

Pure helpers; no downstream task consumes T2's output programmatically.

## Acceptance criteria (Given/When/Then → tests in `corpus-links.test.ts`)

- Given `gitlabTestUrl('1447.dot')`, then it returns
  `https://gitlab.com/graphviz/graphviz/-/blob/main/tests/1447.dot`.
- Given `gitlabTestUrl('imagepath_test/base.gv')`, then the subdir is preserved
  in the URL.
- Given `scrubLocalPaths('… /Users/x/git/graphviz/tests/1447.dot', roots)`,
  then the local prefix is gone and a gitlab blob URL (or `tests/1447.dot`)
  remains; the oracle binary path collapses to `dot`.
- Given `testIdLink('1447','1447.dot')`, then it yields a markdown link;
  `testIdLink('1447')` yields inline-code `` `1447` ``.
- Given the regenerated dashboards, when grepping `docs-site/parity-*.md` for
  `/Users/`, then there are zero matches.

## Observability

N/A.

## Rollback

Reversible — revert the commit and regenerate.

## Quality bar

`npm run typecheck && npm test` green; new unit tests pass; the grep assertion
above is clean. Existing dashboard tests
(`test/corpus/*.test.ts`) still pass.

## Boundaries

- **Always:** keep helpers pure when `roots` is supplied.
- **Never:** run a fresh corpus survey; never edit `docs-site/parity-*.md` by
  hand (regenerate from source).
- **Ask first:** if a generator cannot rebuild its `.md` without a live oracle
  sweep, STOP and log it — do not trigger a sweep.

## Commit

`fix(T2): link corpus tests to gitlab, scrub local paths from dashboards`
