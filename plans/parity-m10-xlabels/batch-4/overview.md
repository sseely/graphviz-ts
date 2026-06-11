# Batch 4 — placement algorithm + postprocess integration (parallel)

T4 and T5 run in parallel; the interface contract between them is the
C header `lib/label/xlabels.h` (placeLabels signature + xlabel_t /
object_t / label_params_t shapes), fixed before either starts.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T4 | xlabels.c placeLabels port ([T4-xlabels.md](T4-xlabels.md)) | sonnet | src/label/xlabels.ts (new), src/label/xlabels.test.ts (new), src/cdt/* (AD4 conditional, minimal) | T3 | [x] |
| T5 | addXLabels + helpers in postproc; EdgeLabelsDone wiring ([T5-addxlabels.md](T5-addxlabels.md)) | sonnet | src/common/postproc.ts, src/layout/dot/splines.ts, src/common/postproc.test.ts, src/model/graphInfo.ts (field only) | T3 (header contract only) | [x] |

Conflict check: T4 owns src/label/xlabels* (+ conditional src/cdt);
T5 owns postproc/splines/graphInfo. Disjoint. Batch gate (full suite +
golden probe) runs after BOTH land, since T5 imports T4's placeLabels.
