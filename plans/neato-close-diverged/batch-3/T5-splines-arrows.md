<!-- SPDX-License-Identifier: EPL-2.0 -->

# T5 · B2+B5 — edge splines & arrowheads

## Context

Largest and riskiest residual. **B2** (edge `_draw_ unfilled_bezier`, pre-B1: 37)
+ **B5** (edge `_hdraw_`/`_hldraw_` arrowhead polygon/text, pre-B1: `2801`,
`windows-viewfile`, `share-grammar`). Arrowheads sit at spline endpoints, so B5
is effectively a tail of B2 — one task. Neato edge routing is in
`src/layout/neato/{splines,multispline,multispline-router}.ts`. **Many pre-B1 B2
items are cascades of mislaid nodes and should be gone after T1** — work only the
residual in `residual-tracker.md`.

## Task (diagnosis-first, triage-heavy)

1. Run in a **git worktree**.
2. Sort residual B2/B5 by `nDiffs`. For each distinct graph (dedupe mirror
   copies `share-`/`windows-`/`linux.*`/`nshare-`):
   - Confirm endpoints (node coords) now match post-B1. If a node still differs,
     it is a B1 miss → journal and route back (do not "fix" it in the spline
     layer).
   - If endpoints match but the bezier interior differs, that is a genuine neato
     spline defect — diagnose at origin (multispline router / port routing).
3. Classify the catastrophic ids (`nshare-root_circo` 22549, `1332` 1049,
   `graphs-grdshapes` 439, `graphs-mode` 474) explicitly: `fix` /
   `cascade-of-known-parent` / `accept-drift` (only if proven irreducible with a
   controlled experiment, per the diagnosis rule — a large nDiffs is NOT by
   itself proof of drift).
4. Relevant prior lessons: `~/.claude` memory "multispline + GTS-faithful CDT",
   "bezier_clip is DIRECTION-dependent", "edge routing order", "FMA ccw
   EMULATED", "setEdgeType macro vs function" (neato `splines=` honored?).

## Write-set

- `src/layout/neato/splines.ts`
- `src/layout/neato/multispline.ts`
- `src/layout/neato/multispline-router.ts`

Must NOT overlap T3/T4. If a fix requires `src/layout/pack/*` or neato/index
(shared with T1/T3 base), that is a signal it is really a B1/B3 concern — stop
and journal rather than editing a foreign write-set.

## Read-set

- `residual-tracker.md` (B2 + B5 rows) · `decisions.md#closed`
- `src/layout/neato/splines.ts`, `multispline*.ts` · `src/pathplan/*`
- C: `~/git/graphviz/lib/neatogen/{multispline,neatosplines}.c`, `lib/pathplan/*`

## Acceptance criteria

- **Given** each residual B2/B5 id, **when** re-rendered, **then** it passes at
  0.5pt OR is classified (fix / cascade / accept-drift) with a
  `known-divergences.md` entry for any accept-class.
- **Given** a `cascade-of-known-parent` classification, **then** the parent node
  whose move explains it is named in the journal.
- **Given** `bash test/golden/gates.sh` in the worktree, **then** exit 0.
- **Given** the broad sweep in the worktree, **then** 0 previously-passing ids
  regress (BY ID).

## Observability / Rollback

N/A / Reversible.

## Commit

One commit per proven cause: `fix(T5): <mechanism> in neato edge routing`.
