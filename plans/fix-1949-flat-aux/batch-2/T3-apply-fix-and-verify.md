# T3 — Apply the minimal faithful fix + verify

## Context
T2 pinned the exact first divergence between the port's and C's aux graph in
`make_flat_adj_edges`. Apply the smallest change in `splines-flat.ts` that
makes the port's aux graph match C's at that field, per the faithful-port
rule. Most likely (AD-2): pin `auxt` to a rank=source subgraph in
`buildFlatAux`. Do NOT touch any other file (AD-3).

## Task
1. Implement the fix at the `fixLocus` from T2's artifact, in
   `src/layout/dot/splines-flat.ts` only. Keep the change minimal and
   `@see`-annotated to the C origin.
2. Add a regression test in `src/layout/dot/splines-flat.test.ts` that builds
   the 1949 structParty `:S`/`:N` flat-adjacent pair (or a minimal LR repro)
   and asserts the routed geometry: the `:S` spline starts at `structParty`
   (not `structDefaultAuto`) and the graph height matches native.
3. Verify: `npx tsc --noEmit`; `npx vitest run src/layout/dot/ src/common/`;
   then `npm run survey && npm run survey:gate`.

## Write-set
- `src/layout/dot/splines-flat.ts`
- `src/layout/dot/splines-flat.test.ts`
- `.agent-notes/1949-diagnosis.md` (mark resolved)

## Read-set
- `src/layout/dot/splines-flat.ts:151-307` (buildFlatAux, reposition, copy)
- `~/git/graphviz/lib/dotgen/dotsplines.c:1165-1240` (subg rank=source + copy)
- T2 artifact in `decision-journal.md`
- `plans/fix-1949-flat-aux/decisions.md` (AD-2, AD-3)

## Interface contract
None (terminal task; installs splines on the original edges as before — no
signature change to `makeFlatAdjEdges`).

## Acceptance criteria
- Given the 1949 `:S` edge, when routed, then its spline starts at
  `structParty` (x≈176.5), not `structDefaultAuto` (x≈158.3).
- Given the graph, when laid out, then height = 282 (native), not 315.
- Given corpus 1949, when surveyed, then maxDelta drops from 101.57 toward 0
  (byte-match, or a documented irreducible libm/ULP residual).
- Given the full corpus, when surveyed + gated, then **0 regressions AND 0
  clip-regressions** vs baseline.
- Given `npx tsc --noEmit`, then exit 0.

## Observability
N/A — no new observable operations.

## Rollback
Reversible — revert the commit; pure layout geometry.

## Quality bar
One commit, message per `~/.claude/rules/commits.md` referencing the C origin.
Survey gate is the hard acceptance bar — a regression is a STOP, not a
proceed. If byte-match is unreachable due to platform libm ULP, document the
residual with evidence (per diagnosis.md valid stop condition 2).
