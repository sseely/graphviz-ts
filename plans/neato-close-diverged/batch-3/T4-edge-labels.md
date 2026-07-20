<!-- SPDX-License-Identifier: EPL-2.0 -->

# T4 · B4 — edge-label `_ldraw_` text placement

## Context

**B4 bucket** (pre-B1: `share-nhg`, `windows-train11`, `2476`, `share-b29`,
`windows-b29`, `1652`, `2470` — confirm residual in `residual-tracker.md`).
Symptom: edge label text position diverges, e.g. `share-nhg`: `edge:2->1#0
_ldraw_ …text[1]: 58.94 vs 42.14`; `2470`: `text[0]: 6930.… ` (large — likely a
cascade of a moved node, verify first). The `_ldraw_` op is the edge label
glyph-run placement; its anchor is the edge label position (`lp`) computed during
neato edge routing / label placement.

## Task (diagnosis-first)

1. Run in a **git worktree**.
2. For each residual B4 id: is the divergence the label **anchor** (`lp`) or the
   per-glyph **x/y within** the run (text-measure/justify)? Compare oracle vs
   port `_ldraw_` T-op and the owning edge's `lp`.
3. Locate the neato edge-label placement site (grep `ldraw`/`lp`/`label` under
   `src/layout/neato/` and the shared label emitter; the module is not pre-named
   here — identify and declare it in the journal before editing). Relevant prior
   lessons: `~/.claude` memory "edge-lp spline gate", "1652 timeout rescue"
   (EdgeInfo), non-ASCII text-measure UTF-8 byte iteration (for `2470`/`b29` if
   labels are non-ASCII).
4. Fix at origin. Mark any pure-cascade item `cascade-of-known-parent`.

## Write-set

- the neato/shared edge-label placement module located in step 3 (declare in
  journal before first edit). Must NOT overlap T3's cluster region or T5's
  spline modules — if the label anchor turns out to be set inside
  `splines.ts` (shared with T5), coordinate per the batch-3 file-ownership rule
  (one writer per file).

## Read-set

- `residual-tracker.md` (B4 rows) · `decisions.md#closed`
- `src/layout/neato/splines.ts` (edge label anchor gate) + shared label emitter
- C: `~/git/graphviz/lib/common/labels.c`, `lib/neatogen/*` edge-label path

## Acceptance criteria

- **Given** each residual B4 id, **when** re-rendered, **then** it passes at 0.5pt
  OR is classified with a `known-divergences.md` entry.
- **Given** `bash test/golden/gates.sh` in the worktree, **then** exit 0.
- **Given** the broad sweep in the worktree, **then** 0 previously-passing ids
  regress (BY ID).

## Observability / Rollback

N/A / Reversible.

## Commit

`fix(T4): <mechanism> in neato edge-label placement`.
