# Batch 1 — Fix Issue 2: adjacent labeled-flat curve geometry

Make the port's `makeSimpleFlatLabels` route the representative labeled edge with
C's arc geometry instead of the current `[tp,tp,hp,hp]` straight stub. This is the
dominant 2368 divergence (maxΔ 65 on 376→76).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | Port C's `makeSimpleFlatLabels` rep-edge curve (+ extend flat-edge unit tests) | debugger | `src/layout/dot/splines-flat-labeled.ts` | T0 | [x] |

Execution rule: implement the geometry the T0 trace pinned, re-render 2368, then
run the full survey gate. Any conformant→worse is STOP + revert (AD-4). Batch
done = 376→76 / 196→376 / 256→436 path `@d` conformant C AND survey 0 regressions
AND 2368_1 + 1624 still conformant.
