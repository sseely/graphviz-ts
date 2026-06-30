# T1 — Generalize topBoxes/bottomBoxes + export flat helpers

## Context
Faithful TS port of C graphviz. Batch 2 will add a cnt-loop router that needs the
connecting-box builders to accept per-`i` offsets. Today `topBoxes(tlast, hlast,
stepx, stepy)` / `bottomBoxes(...)` hardcode one step pair. C's loop offsets the two
END boxes by `(i+1)·stepx` / `(i+1)·stepy` but keeps the MIDDLE box height at plain
`stepy` (findings-diagnosis.md). This task ONLY generalizes the signatures + exports;
NO behavior change. READ `../findings-diagnosis.md` and `../decisions.md` (AD-1, AD-2).

## Task
1. Generalize `topBoxes` and `bottomBoxes` in `src/layout/dot/splines-flat.ts` to take
   separate parameters: `endStepX`, `endStepY` (applied to the two end boxes — b0.UR
   and b2.LL, matching C's `(i+1)·step`) and `midStepY` (the middle box height,
   matching C's plain `stepy`). Keep the exact box arithmetic otherwise.
2. Update the single existing call in `routeFlatEdgeFaithful` to pass
   `(stepx, stepy, stepy)` (i.e. endStepX=stepx, endStepY=stepy, midStepY=stepy) so
   cnt=1 behavior is conformant.
3. Export (add `export`) the helpers Batch 2's new module needs:
   `topBoxes`, `bottomBoxes`, `makeFlatEndBox`, `flatSide`, `flatVspace`,
   `freshFlatPath`, `assembleFlatPath`. (`FlatEndParts` type too if referenced.)
4. Do NOT change `routeFlatEdgeFaithful`'s logic beyond the call-site arg shape; do
   NOT add the cnt-loop here (that is T2).

## Write-set
- `src/layout/dot/splines-flat.ts` (Modify)

## Read-set
- `../findings-diagnosis.md` (C box arithmetic, cnt=1 reduction)
- `../decisions.md#ad-1` (conformant), `#ad-2` (exports)
- `src/layout/dot/splines-flat.ts:370-404` (topBoxes/bottomBoxes),
  `:473-492` (routeFlatEdgeFaithful call site)

## Interface contract (consumed by T2)
```
topBoxes(tlast: Box, hlast: Box, endStepX: number, endStepY: number, midStepY: number): Box[]
bottomBoxes(tlast: Box, hlast: Box, endStepX: number, endStepY: number, midStepY: number): Box[]
// plus exports: makeFlatEndBox, flatSide, flatVspace, freshFlatPath, assembleFlatPath
```

## Acceptance criteria
- Given a cnt=1 flat edge, when rendered, then its spline is BYTE-IDENTICAL to before
  (vitest 1995 green; no curated golden flips).
- Given `topBoxes(t,h,s,s,s)`, when compared to the old `topBoxes(t,h,s,s)`, then the
  returned boxes are identical (the 3-arg→old behavior is preserved at the call site).
- `npx tsc --noEmit` exit 0; `lizard` on the file clean (≤30 lines / CCN ≤10 / ≤5
  params); `splines-flat.ts` stays <500 lines.

## Observability / Rollback
N/A — no new observable operations. Reversible (pure refactor).

## Boundaries
- **Never do:** add the cnt-loop or grouping here; change box arithmetic; alter
  `routeFlatEdgeFaithful` logic beyond the arg shape.
- **Stop if:** any curated golden flips (means the refactor changed behavior).

## Commit
`refactor(flat): split topBoxes/bottomBoxes end vs mid step; export helpers`
