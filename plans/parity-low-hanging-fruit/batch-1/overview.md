# Batch 1 — Triage (parallel, read-only)

Six independent read-only tasks, one per bucket (attr-or-tag split in two). NO
`src/` writes → all parallel. Batch 2 consumes the triage docs.

| ID | Bucket | Cases | Writes | Depends On | Done |
|----|--------|------|--------|------------|------|
| T1 | color-stroke | 9 | `plans/parity-low-hanging-fruit/triage/color-stroke.md` | — | [ ] |
| T2 | text-content | 7 | `plans/parity-low-hanging-fruit/triage/text-content.md` | — | [ ] |
| T3a | attr-or-tag (1/2) | 17 | `plans/parity-low-hanging-fruit/triage/attr-or-tag-1.md` | — | [ ] |
| T3b | attr-or-tag (2/2) | 16 | `plans/parity-low-hanging-fruit/triage/attr-or-tag-2.md` | — | [ ] |
| T4 | polygon-points | 3 | `plans/parity-low-hanging-fruit/triage/polygon-points.md` | — | [ ] |
| T5 | parser-gap | 10 | `plans/parity-low-hanging-fruit/triage/parser-gap.md` | — | [ ] |

## Shared triage methodology (all tasks)

For each case id `<id>` (input at `~/git/graphviz/tests/<path>` — the path is the
`path` field in `test/corpus/parity.json` for that id; usually `<id>.dot` or a
subdir like `graphs/<name>.gv`):

1. **Render port:** `renderSvg(readFileSync(input,'utf8'), engine)` from
   `src/index.js` (engine from the corpus manifest, default `dot`). Catch throws.
2. **Render oracle:** spawn `~/git/graphviz/build/cmd/dot/dot -Tsvg <input>` with
   `GVBINDIR=/tmp/gvplugins`.
3. **Diff:** find the first concrete difference (the bucket's `firstDiffPath` in
   `parity.json` points at it). Record the actual port value vs oracle value.
4. **Classify root cause** in one line (e.g. "hex color emitted verbatim, not
   lowercased"; "arrowhead polygon has 4 pts not 3"; "peggy rejects `=` in X").
5. **Verdict** per ADR-3: `simple` (localized ≤~30-line single-module fix) or
   `deep` (layout/routing/shape-port/charset infra). Name the **fix module**
   (the `src/...ts` file the fix would touch) and a **one-line fix plan**.

Use the in-repo probe pattern (write the `.mjs` at the REPO ROOT, not `/tmp` —
relative `./src/*.js` imports only resolve from the repo root; see the data-flow
diagram). Run via `npx tsx`. Do NOT modify any `src/` file in this batch.

## Output schema (per case, in the triage doc)

A markdown table, one row per case:

```
| id | engine | firstDiffPath | port value | oracle value | root cause | verdict | fixModule | fixPlan |
```

End each doc with a **summary**: counts of simple vs deep, and the simple cases
grouped by shared root cause (this grouping seeds the Batch 2 fix tasks).

## Gate after batch

`npm run typecheck && npm test && npm run build` (unchanged — no src edits), then
`git diff --name-only` lists only the six triage docs.
