# T1 — Port poly_init size computation

## Context
graphviz-ts is a faithful TS port of C graphviz (`~/git/graphviz` is
the spec; see project CLAUDE.md). Node dimensions (`lw`/`rw`/`ht`)
currently come from fixed defaults (54×36) for plain-text labels; only
dot's record/html nodes are sized from content. C sizes EVERY node from
its label in `poly_init` (called via `common_init_node`'s
`ND_shape(n)->fns->initfn`).

## Task
Create `src/common/poly-sizing.ts` exporting a pure function that
computes node dimensions from label size + attrs, faithfully porting
the sizing portion of `poly_init`:

- label dimen + margin attr (inches) or PAD (16×8pt, GAP=4)
- `fixedsize`, `regular`, `width`/`height` attrs (inches, defaults
  0.75/0.5), orientation/`distortion`/`skew` only if poly desc needs it
- ellipse (sides < 3) expansion — port C's exact formula, do NOT assume
  plain √2 (validate against twopi-star: "center" @14pt Times →
  lw=rw=33.44); polygon (sides ≥ 3) inscribing math per C
- output: `{ lw, rw, ht }` in points (via gv_nodesize semantics,
  including `flip`)

Write `src/common/poly-sizing.test.ts` first (TDD): cases below.

## Read-set
- `~/git/graphviz/lib/common/shapes.c` — poly_init (sizing block only)
- `~/git/graphviz/lib/common/utils.c` — common_init_node, gv_nodesize
- `src/common/poly-init.ts` (existing partial), `src/common/record.ts`
  (recAttrSize/attrBool patterns), `src/layout/dot/init.ts:sizeNodeFromLabel`
  (the html shortcut this replaces)
- `test/golden/refs/twopi-star.svg` (ground truth: rx 33.44, ry value)

## Acceptance criteria
- Given label "center", Times 14pt, default ellipse, when sized, then
  lw = rw = 33.44 ± 0.01 (matches twopi-star ref)
- Given label "A" (small), default ellipse, when sized, then 27/27/36
  (defaults win — dot goldens depend on this)
- Given a box shape with a label wider than 38pt, when sized, then
  width = labelWidth + 16 (PAD), per C
- Given `fixedsize=true` with width/height set, when sized, then attr
  dimensions win regardless of label

## Quality bar
`npx tsc --noEmit` clean; `npx vitest run src/common/` green;
full suite failure count unchanged (nothing routed through it yet).
Functions ≤30 lines / CCN ≤10 (complexity hook); export helpers to
prevent lizard absorption.

## Observability / Rollback
N/A — pure function, no observable operations. Reversible (git revert).

## Commit
`feat(common): port poly_init label-driven node sizing`
