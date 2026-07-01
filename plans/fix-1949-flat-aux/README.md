# Mission: fix the flat-adjacent aux-spline geometry (1949 byte-match)

## Objective
Root-cause and fix the **coupled aux-spline-routing defect** in
`make_flat_adj_edges` that keeps corpus `1949.dot` from byte-matching native
graphviz. The orientation half is already fixed (commit `480b34a`, 0
regressions); this mission closes the remaining geometry defect. Diagnostic-
first: instrument C's aux graph vs the port's, pin the divergence, then apply
the minimal faithful fix in `splines-flat.ts` only.

## Symptom (post-orientation-fix)
The `structParty:S -> structDefaultAuto` / `structDefaultAuto -> structParty:N`
flat compass-port pair (both rank 4, adjacent) routes with wrong spline
geometry: the `:S` edge starts at the wrong endpoint (x≈158.3 =
structDefaultAuto vs native 176.5 = structParty) and loops the wrong direction
→ graph height 315 vs native 282, **maxDelta 101.57**. `transformf`, `del`,
aux flip-inversion, and `repositionFlatAux` are all verified faithful to C.

## Prime suspect
`buildFlatAux` omits C's `subg = agsubg(auxg,"xxx"); agset(subg,"rank",
"source")` pin on `auxt` (dotsplines.c ~1170). Secondary: the aux
`dot_sameports`/`dot_splines_` producing a different curl. **Confirm by
instrumentation before changing code** (see decisions.md, diagnosis rule).

## Branch
`fix/1949-flat-aux-geometry` (cut from current `docs/reconcile-divergences`).

## Constraints (stop / push-forward)
**STOP and check with the human when:**
- The fix would need to touch any file other than `splines-flat.ts` +
  `splines-flat.test.ts` (esp. `sameport.ts`) — locked scope (AD-3).
- The survey gate shows **any** regression or clip-regression.
- The same aux-routing location is changed 3× without pinning the cause.
- `rank=source` turns out inert (2-node case) — the real cause is elsewhere;
  re-diagnose, don't force a rank=source change.
- C instrumentation still won't compile after a clean rebuild.

**PUSH FORWARD (decide autonomously):**
- Choice of temp `fprintf`/`console.error` dump format.
- Clean-rebuild vs targeted object deletion for the C build (AD-1).
- Purely mechanical test structure matching existing `splines-flat.test.ts`.

## Quality gates
- `command: npx tsc --noEmit` — pass: exit 0 — on_fail: fix_and_rerun
- `command: npx vitest run src/layout/dot/ src/common/` — pass: exit 0 —
  on_fail: fix_and_rerun
- `command: npm run survey && npm run survey:gate` — pass: 0 regressions AND
  0 clip-regressions; 1949 maxDelta drops toward 0 — on_fail: stop

## Batches
| Batch | Focus | Status |
|-------|-------|--------|
| [Batch 1](batch-1/overview.md) | Instrument C oracle + port aux graph; pin root cause | [x] — cause pinned; prime suspect DISPROVEN |
| [Batch 2](batch-2/overview.md) | Apply minimal faithful fix + regression test + survey | [ ] BLOCKED — STOP (out of scope, see below) |

## Batch-1 result — STOP, mission needs re-scoping (2026-07-01)
Diagnosis pinned the first divergence and **disproved the prime suspect**:
- rank=source is **inert** — the port's aux already ranks `auxt` at rank 0.
- Real root: `collectAdjacentFlatGroup` (`edge-route.ts:311`) bundles both
  distinct user edges into one `cnt=2` aux; C keeps them in separate `cnt=1`
  calls (`getmainedge` grouping, `dotsplines.c:357`). The co-routed aux reverses
  the `:S` spline → +33px height. Secondary: lead-edge makefwdedge normalization
  and the structParty `:N`/`:S` port-cell y (±35.20 port vs ±24.40 C).
- **Fix locus is OUTSIDE `splines-flat.ts`** (edge-route.ts + likely
  sameport/htmltable) → AD-3 STOP. Full artifact: `.agent-notes/1949-diagnosis.md`.

## Index
- [decisions.md](decisions.md) — AD-1/2/3 (instrumentation, rank=source, scope)
- [batch-1/overview.md](batch-1/overview.md) · [T1](batch-1/T1-instrument-c-oracle.md) · [T2](batch-1/T2-instrument-port-and-diff.md)
- [batch-2/overview.md](batch-2/overview.md) · [T3](batch-2/T3-apply-fix-and-verify.md)
- [diagrams/aux-pipeline.md](diagrams/aux-pipeline.md)
- [decision-journal.md](decision-journal.md)
- Prior context: `.agent-notes/1949-diagnosis.md`, `plans/fix-1949/`
