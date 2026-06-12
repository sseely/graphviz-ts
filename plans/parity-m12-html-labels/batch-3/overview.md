# Batch 3 — emission completion (after batch 2)

T6 → T7 are SEQUENCED (both write htmltable-emit.ts). T8 runs in
parallel with them (disjoint file). Launch T6 and T8 together; launch
T7 when T6 lands.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T6 | Cell decoration emission ([T6-cell-decoration.md](T6-cell-decoration.md)) | sonnet | src/common/htmltable-emit.ts (+test) | T3, T5 | [ ] |
| T7 | IMG sizing+emission+ImageSizer ([T7-img.md](T7-img.md)) | sonnet | src/common/htmltable.ts, htmltable-emit.ts, + located plumbing file (+tests) | T3, T6 | [ ] |
| T8 | Emission unskip in live path ([T8-unskip.md](T8-unskip.md)) | sonnet | src/gvc/device.ts (+test) | T5 | [ ] |
