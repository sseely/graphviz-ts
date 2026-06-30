# T10 — Fix parser-gap simple cases

Follow the shared fix methodology in [overview.md](overview.md). Read
`triage/parser-gap.md` first. Depends on T9.

## Task
Implement each confirmed-simple grammar gap. The fix is in the peggy grammar
`src/parser/dot.pegjs`; **regenerate** `src/parser/dot.js` from it (peggy is a
devDependency — `npx peggy …`; check `package.json`/existing build steps for the
exact invocation). One commit per root-cause group; one golden per group.

Per ADR-5, the Latin1/russian charset cases (`share-Latin1`, `windows-Latin1`,
`graphs-russian`) are **deep** — comparison page, defer.

For issue-numbered cases (`1308_1`, `1367`, …), consult the graphviz GitLab issue
+ closing MR for intended behavior before porting (memory: "Issue-numbered tests
→ consult the MR"): `git -C ~/git/graphviz log --all --grep '<num>'`.

## Write-set
- `src/parser/dot.pegjs` (modify) + `src/parser/dot.js` (regenerated) + parser test
- golden add (per group)
- `plans/parity-low-hanging-fruit/comparisons/<id>.md` (per deferred case)

## Acceptance criteria
- Given each simple case, when parsed, then it no longer throws and the rendered
  SVG conforms to the oracle (promoted from errored).
- Given `dot.pegjs` change, then `dot.js` is regenerated and the full parser test
  suite stays green.
- Given Latin1/russian cases, then each has a comparison page (deep).
- Given the golden suite, then green; 0 per-id regressions.

## Observability / Rollback
N/A. Reversible.

## Quality bar
`npm run typecheck && npm test` exit 0. Commit(s):
`fix(parser): accept <construct> (parity)`.
