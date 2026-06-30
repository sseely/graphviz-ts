# T1 — ND_xlabel creation in nodeinit.ts

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz; C source
at ~/git/graphviz/lib (tag 15.0.0) is the spec. Vitest, strict TS,
JSDoc @see cites per ported block. Suite baseline 1217/0, 67 goldens.
Hook rule: if a pre-commit/length/CCN hook complains, smallest fix, at
most 2 attempts per file, then move on.

Node main-label creation already exists: commonInitNode
(src/common/nodeinit.ts:219) → initNodeFromLabel (nodeinit.ts:150) →
buildNodeLabel (poly-init.ts:91) → makeLabel (make-label.ts:42).
What is missing is the xlabel block that follows it in C.

## Task

Port utils.c:443-447 into commonInitNode/initNodeFromLabel at the C
position (immediately after ND_label creation): if the node has a
non-empty `xlabel` attribute, build `n.info.xlabel` via makeLabel
(plain text only, per decisions.md D2 — add a comment) using the SAME
fontinfo (fontsize/fontname/fontcolor) already resolved for the main
label, and set `NODE_XLABEL` on has_labels.

has_labels scoping (locked constraint): C sets
`GD_has_labels(agraphof(n)) |= NODE_XLABEL`. Find how the port's
existing label-bit writers scope this (edge-label-init.ts:107 uses
g.info.has_labels) and match the C reader sites — cite utils.c:447 in
a comment. NODE_XLABEL is exported from src/layout/dot/rank.ts (1<<4,
added in M10).

TDD: failing tests first.

## Write-set

src/common/nodeinit.ts, plus its co-located test file (create
src/common/nodeinit.test.ts if none exists; extend if it does).
Nothing else.

## Read-set

~/git/graphviz/lib/common/utils.c:430-455; src/common/nodeinit.ts;
src/common/poly-init.ts:91-104; src/common/make-label.ts;
src/layout/dot/rank.ts:28-36 (label bits)

## Interface contract (consumed by T4/T5)

`n.info.xlabel?: TextlabelT` (same shape as n.info.label; set=false
until addXLabels places it); root has_labels gains NODE_XLABEL.

## Acceptance criteria

- Given `A [xlabel="nx"]`, when commonInitNode runs, then
  n.info.xlabel is a TextlabelT with measured dimen and
  has_labels & NODE_XLABEL is set
- Given no xlabel attribute or an empty string, then n.info.xlabel is
  absent and the bit unset (C guards `str[0]`)
- Given the existing suite + 67 goldens, then 0 failed and goldens
  conformant (no label attrs → no behavior change)

## Observability / rollback

N/A — library; gates are the SLI. Reversible (single commit).

## Quality bar

npx tsc --noEmit clean; npx vitest run 0 failed. Commit (orchestrator):
`feat(T1): create node xlabel in common node init`
