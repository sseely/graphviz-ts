# Batch 1 — Triage (parallel, read-only)

Six independent read-only tasks, one per bucket (attr-or-tag split in two). NO
`src/` writes → all parallel. Batch 2 consumes the triage docs.

| ID | Bucket | Cases | Writes | Depends On | Done |
|----|--------|------|--------|------------|------|
| T1 | color-stroke | 9 | `plans/parity-low-hanging-fruit/triage/color-stroke.md` | — | [x] |
| T2 | text-content | 7 | `plans/parity-low-hanging-fruit/triage/text-content.md` | — | [x] |
| T3a | attr-or-tag (1/2) | 17 | `plans/parity-low-hanging-fruit/triage/attr-or-tag-1.md` | — | [x] |
| T3b | attr-or-tag (2/2) | 16 | `plans/parity-low-hanging-fruit/triage/attr-or-tag-2.md` | — | [x] |
| T4 | polygon-points | 3 | `plans/parity-low-hanging-fruit/triage/polygon-points.md` | — | [x] |
| T5 | parser-gap | 10 | `plans/parity-low-hanging-fruit/triage/parser-gap.md` | — | [x] |

## Triage result (2026-06-21)

24 simple, 38 deep across the 62 cases. Simple groups → Batch 2 fix tasks:
- **T6 color** (9): graph bgcolor resolve (`svg-graph.ts`); `setlinewidth(N)` +
  FUNLIMIT=64 (`style-resolve.ts`); edge fontcolor colorscheme (`device.ts`);
  cluster `peripheries=0` (`device-cluster.ts`).
- **T7 text** (2): QAtom implicit-concat + XML-escape apostrophe/entity-decode
  (`dot.pegjs`, `make-label.ts`, svg escape helper). 1990 + b81.
- **T8 attr** (7+4): DOT `id=`/`class=`/`stylesheet=` emission (svg id/class
  helpers) + edge/cluster AGSEQ ids (`svg-id.ts`). Reconcile AGSEQ vs T3a "deep".
- **T9 polygon** (0): all deep (crow/vee + dot/odot arrowhead geometry).
- **T10 parser** (2): QAtom drop-rest (shared w/ T7) + widen NAME char class
  (`dot.pegjs`). 2682 + russian.

Cross-bucket: 2682 (T10) and 1990 (T7) both touch `dot.pegjs` QAtom →
single grammar fix, sequenced once. AGSEQ id generation spans T3a/T3b.

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
