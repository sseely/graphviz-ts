<!-- SPDX-License-Identifier: EPL-2.0 -->

# T4 — Parser recovery / triage (5 errored)

## Context

The parity survey lists 5 inputs as `errored` — the **port's peggy parser throws**
where the native oracle produced an SVG. All five are **fuzzer-corrupted**
(mojibake bytes, stray punctuation, truncated tokens):

| id | first bad token (survey message) |
|---|---|
| `1308_1` | `"}"` after garbage `������subgraph` |
| `1474` | `"L"` (stray `ialn` / `a:wheadcli`) |
| `1489` | `"õ"` (binary bytes in `size="6�6"`) |
| `1494` | `","` (corrupt HTML-ish label soup) |
| `1676` | `","` (corrupt `newrank=` / binary) |

Native's yacc parser has error recovery and limps through, emitting (largely
garbage) SVG. peggy (PEG) fails at the first unparseable token. Read
`decisions.md#ad-5` — the grammar's integrity for **valid** DOT is
non-negotiable; this is explicitly a triage task with won't-fix as an acceptable
outcome.

## Task

1. For each of the 5 inputs, reproduce the throw:
   `npx tsx test/corpus/render-one.ts <path> dot` and capture the exact
   peggy failure location.
2. Classify: is the failure a **clean, general** gap (a valid DOT construct
   peggy mishandles) or **input corruption** (bytes no sane grammar should
   accept)?
3. If — and only if — one low-risk grammar change in `src/parser/dot.pegjs`
   fixes ≥1 case **without** changing how any valid input parses (the survey
   gate proves this), apply it: edit `.pegjs`, regen with
   `npm run parser:regen`, add a focused parser unit test.
4. For every case that remains corruption-only, **document it as won't-fix** in
   `decision-journal.md`: the id, the corrupt byte/token, and confirmation that
   native's output is itself garbage (run `dot -Tsvg <path>` and note it).
   Leave its survey verdict as `errored`.

Do **not** add broad "skip unknown tokens" recovery to the PEG — that would
silently mis-parse valid graphs. Per-construct fixes only.

## Write-set

- `src/parser/dot.pegjs` — only if a clean per-construct fix is found
- `src/parser/dot.js` — regenerated via `npm run parser:regen` (never hand-edit)
- `src/parser/*.test.ts` — a test per applied fix

## Read-set

- `decisions.md#ad-5`
- `src/parser/dot.pegjs` (the grammar)
- The 5 inputs under `~/git/graphviz/tests/` (`1308_1.dot`, `1474.dot`,
  `1489.dot`, `1494.dot`, `1676.dot`)
- Memory note: prior triage already classified these as fuzzer garbage —
  corroborate, don't blindly re-derive.

## Acceptance criteria

- **Given** all 5 inputs, **when** triaged, **then** each is either fixed (with a
  passing parser test) or documented won't-fix with native-output evidence.
- **Given** the full survey, **when** re-run after any grammar change, **then**
  **zero** previously byte/structural-matching inputs regress (AD-4).
- **Given** `npm run parser:regen` was run, **when** committing, **then**
  `dot.js` is the regenerated artifact (not hand-edited) and `tsc` is clean.

## Observability

N/A.

## Rollback

Reversible. If a grammar change shows any regression in the survey, revert it and
fall back to won't-fix for that case.

## Quality bar

`npm run typecheck` + `npm test` exit 0. Commit per outcome:
`fix(parser): <construct>` if fixed, or no code commit (journal-only) if all 5
are won't-fix. Do not commit a `.pegjs` change without regenerating `dot.js`.
