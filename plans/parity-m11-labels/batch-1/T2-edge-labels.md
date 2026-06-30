# T2 — ED_label + ED_xlabel creation in edge-label-init.ts

## Context

graphviz-ts port; C at ~/git/graphviz/lib (15.0.0) is the spec. Suite
baseline 1217/0, 67 goldens. Hook rule: smallest fix, ≤2 attempts per
file, then move on.

src/common/edge-label-init.ts already ports the head/tail blocks of
common_init_edge (utils.c:533-547): initFontEdgeAttr,
initFontLabelEdgeAttr, initEdgeLabels (called from dotInitNodeEdge,
src/layout/dot/init.ts:224). The label= and xlabel= blocks that come
FIRST in C are missing.

## Task

Port utils.c:509-530 into initEdgeLabels at the C position (BEFORE the
head/tail blocks — preserve C statement order):

- `label=` non-empty → resolve fontinfo via the existing
  initFontEdgeAttr lazy pattern (C: `fi.fontname = NULL` then
  init-on-demand — match the laziness exactly; xlabel reuses fi if
  already initialized), build e.info.label via makeLabel (plain text
  per decisions.md D2, comment it), set EDGE_LABEL bit, and port
  ED_label_ontop: `e.info.label_ontop = mapbool(late_string(e,
  'label_float', 'false'))` (utils.c:522) — find the port's
  late_string/mapbool equivalents (search src/common for lateString /
  mapbool; M9/M10 ported them).
- `xlabel=` non-empty → e.info.xlabel via makeLabel with fi
  (initializing fi only if the label block didn't), set EDGE_XLABEL
  bit.

has_labels scoping (locked constraint): C sets on
`agraphof(agtail(e))` (utils.c:511 `sg`). Match what the existing
head/tail code does (edge-label-init.ts:107) ONLY if that matches C —
verify and cite; if the existing head/tail scoping diverges from C, do
NOT copy it: stop and report (it would be an M9 bug, outside your
write-set).

EDGE_LABEL/EDGE_XLABEL come from src/layout/dot/rank.ts.
e.info.label / e.info.xlabel fields already exist on edgeInfo.ts.

TDD: failing tests first in the module's co-located test file.

## Write-set

src/common/edge-label-init.ts + its co-located test file. Nothing
else.

## Read-set

~/git/graphviz/lib/common/utils.c:505-548; src/common/edge-label-init.ts;
src/common/make-label.ts; src/model/edgeInfo.ts:55-80;
src/layout/dot/rank.ts:28-36

## Interface contract (consumed by T4/T5; wakes dormant machinery)

`e.info.label?: TextlabelT` (set=false; placeVnlabel sets pos+set
during dotsplines), `e.info.xlabel?: TextlabelT` (set=false; addXLabels
places it), `e.info.label_ontop?: boolean`; root has_labels gains
EDGE_LABEL / EDGE_XLABEL. Setting EDGE_LABEL activates already-ported
edgelabelRanks (rank.ts:152) and classify.ts labelVnode — expected and
correct; do not suppress.

## Acceptance criteria

- Given `A -> B [label="el"]`, when initEdgeLabels, then e.info.label
  set with fontinfo fallback chain matching utils.c:515-522,
  EDGE_LABEL bit set, label_ontop defaults false
- Given `A -> B [xlabel="ex"]`, then e.info.xlabel set, EDGE_XLABEL
  bit set
- Given both on one edge, then fi is initialized exactly once (C
  laziness preserved)
- Given neither, then absent; suite 0 failed; 67 goldens
  conformant

## Observability / rollback

N/A — library; gates are the SLI. Reversible (single commit).

## Quality bar

npx tsc --noEmit clean; npx vitest run 0 failed. Commit (orchestrator):
`feat(T2): create edge label and xlabel in common edge init`
