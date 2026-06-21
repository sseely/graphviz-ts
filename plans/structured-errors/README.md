# Mission: Structured Errors

Give library consumers a small, stable, structured error contract — faithful
**detection** (what/where matches C) plus structured **delivery** (a lean
`GvError` shape). Seed: `plans/future/structured-errors-proposal.md`.

## Objective

Today `renderSvg` throws `ParseError` (not even exported from the public entry)
for parse failures and a bare `Error` for render-stage failures. Replace this
with a structured contract every consumer can branch on: a `GvError` interface
(`type`, `code`, `message`, `friendlyMessage`, `location?`, `expected?`), a
`RenderResult`, and a result-style `tryRenderSvg` alongside the throwing
`renderSvg`. Error **content stays C-faithful**; only the **delivery form** is
new (library API design, not a behavior divergence).

## Branch

`feature/structured-errors` — does not yet exist (create it). Merge with a
**merge commit** (preserves per-task commit IDs).

## Constraints

### Stop and wait for human input when
- A task needs to modify a file outside its declared write-set.
- Two consecutive quality-gate failures on the same check.
- Making `HtmlParseError` implement `GvError` requires changing its `(tag)`
  constructor signature (it must stay additive — 4 call sites depend on it).
- The same code location is changed 3+ times without resolving the same failing
  check.

### Faithfulness scope (relaxed for messages)
Error **message wording MAY diverge from C** — fidelity to the C oracle is not
required for error text (owner decision). What still matters for correctness:
`location` must point at the *real* error position, and `type`/`code` must
classify it correctly. `message` and `friendlyMessage` are library-UX text we
own.

### Push forward with judgment when
- Choice is purely stylistic / internal naming with no API effect.
- A friendly-message string's exact wording (it is non-localized prose; pick
  clear, approachable English).
- A task is simpler than estimated (log a one-line decision-journal entry).

## Quality gates (run after every batch)

```
- command: npx tsc --noEmit
  pass: exit 0 (baseline is already clean)
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx esbuild src/index.ts --bundle --format=esm --outfile=/tmp/se-bundle.js
  pass: exit 0, no Node-shim errors (browser-safe)
  on_fail: fix_and_rerun
- command: git diff --name-only
  pass: only files in the current batch's declared write-set
  on_fail: stop
```

New `src/*.ts` files target ≥90% line/branch/function coverage (`testing.md`).

## Batches

| Batch | Tasks | Theme | Status |
|-------|-------|-------|--------|
| [1](batch-1/overview.md) | T1 | Error type system + friendly-message seam | [x] |
| [2](batch-2/overview.md) | T2, T3 | Faithful detection → structured (parser, html) | [x] |
| [3](batch-3/overview.md) | T4 | Boundary wiring: `tryRenderSvg`, classify, exports | [x] |

T2 and T3 run in parallel (distinct files, both depend only on T1).

## Index

- [decisions.md](decisions.md) — architecture decisions (ADR-1..4) + final shape
- [batch-1/overview.md](batch-1/overview.md) · [T1](batch-1/T1-error-types.md)
- [batch-2/overview.md](batch-2/overview.md) · [T2](batch-2/T2-parse-error.md) · [T3](batch-2/T3-html-parse-error.md)
- [batch-3/overview.md](batch-3/overview.md) · [T4](batch-3/T4-render-api.md)
- [diagrams/data-flow.md](diagrams/data-flow.md) · [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)

## Session summary (2026-06-21)

**Completed: 4/4 tasks** (T1–T4), one commit each on `feature/structured-errors`:

- `4da2b08` feat(errors) — T1: `GvError`/`RenderResult`, 7-code union, `FRIENDLY_MESSAGES` + `friendlyMessageFor`, `RenderError`. `errors.ts` is a runtime leaf.
- `ae2f648` feat(parser) — T2: `ParseError implements GvError` (type/code/location/expected); `line`/`column` getters; `isPeggyError`/`offsetToLineCol`/`findEdgeOp` surface `offset`/`expected`/`found`.
- `6c92409` feat(common) — T3: `HtmlParseError implements GvError` additively (`(tag)` ctor + message unchanged; 4 call sites unrippled).
- `a53d2b4` feat(api) — T4: `tryRenderSvg` (svg XOR errors[1]), `classifyError` → plain JSON-serializable `GvError`, render-stage wrap (always throws `GvError`), public exports.

**Quality gates (final, feature branch):** `tsc --noEmit` exit 0 · `vitest run` 2090/2090 pass (156 files) · esbuild ESM browser bundle exit 0 (no Node shims) · each batch's `git diff` limited to its declared write-set.

**Coverage:** new files at 100% counted branch coverage. T4's unknown-throw/non-Error normalizers are unreachable via the public API (parse only throws `ParseError`; the render wrap normalizes every render-stage throw) but mandated by ADR-3 — isolated into `v8 ignore`d helpers and documented inline + in the decision journal.

**Decisions:** see [decision-journal.md](decision-journal.md) — 3 entries (direct execution over subagents; token-error test input; the unreachable-defensive-branch coverage treatment).

**Known follow-ups / not done:** merge to `main` left to the owner — per the Branch section, use a **merge commit** (preserves the four per-task commit IDs). No behavior divergence introduced; error *content* stays C-faithful, only *delivery form* is new. Reversible: revert the merge commit.
