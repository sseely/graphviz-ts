# Batch 2 — Fixes (SEQUENTIAL)

Depends on ALL of Batch 1. Runs **sequentially** (T6 → T7 → T8 → T9 → T10) so the
shared golden `manifest.json` / `suite.test.ts` count and any shared `src/`
module never contend. Each task fixes its bucket's **confirmed-simple** cases.

| ID | Bucket fixes | Reads | Writes (primary) | Depends On | Done |
|----|--------------|-------|------------------|------------|------|
| T6 | color-stroke | `triage/color-stroke.md` | `src/render/color-resolve.ts` (+ test, goldens) | B1 | [ ] |
| T7 | text-content | `triage/text-content.md` | text-emit module (+ goldens) | T6 | [ ] |
| T8 | attr-or-tag | `triage/attr-or-tag-1.md`, `-2.md` | per triage (+ goldens) | T7 | [ ] |
| T9 | polygon-points | `triage/polygon-points.md` | poly/arrow module (+ goldens) | T8 | [ ] |
| T10 | parser-gap | `triage/parser-gap.md` | `src/parser/dot.pegjs` (+ `dot.js`, goldens) | T9 | [ ] |

`Writes` is finalized by each agent FROM its triage doc. If a fix needs a module
already written by an earlier sequential task, that is fine (sequential) — but it
must STILL be a faithful, localized change (ADR-3).

## Shared fix methodology (all tasks)

For each **confirmed-simple root-cause group** in the bucket's triage doc:

1. **Implement** the faithful, localized fix (ADR-3, ≤~30 lines, single module).
   Read the C source under `~/git/graphviz` for the correct behavior — "the C is
   the spec." Cite it in a JSDoc `@see`.
2. **Oracle-pin:** verify the port output now byte-matches native `dot -Tsvg`
   for the affected cases.
3. **Add ONE golden** per group (ADR-4): copy the representative input to
   `test/golden/inputs/<id>.dot`, generate the ref with the native oracle to
   `test/golden/refs/<id>.svg`, add a `manifest.json` entry, and bump the count
   assertion in `test/golden/suite.test.ts`. Follow the existing golden pattern
   (see commit history for `dot-cluster-external-edge`).
4. **Unit test** the fix where it has logic (e.g. a color-normalize unit test).
5. **Gates:** `npm run typecheck && npm test` green before committing.
6. **Commit** one per root-cause group: `fix(<scope>): <root cause> (parity)`.

For each **deep** case: create a comparison page at
`plans/parity-low-hanging-fruit/comparisons/<id>.md` (port vs oracle first-diff +
why it is deep + which follow-on bucket it belongs to). Reference it in the
decision journal. Do NOT attempt the deep fix (STOP condition).

## Regression rule (hard)
After each fix, no previously byte-matching or structural case may regress. If a
fix trades one case's improvement for another's regression, STOP and reconsider
(memory: "bucket-fix re-bucketing" — judge per-id deltas, not aggregate counts).

## Gate after batch
`npm run typecheck && npm test && npm run build` exit 0; golden suite green; every
deep case has a comparison page; `git diff --name-only` matches the union of the
fix write-sets + added goldens + comparison pages.
