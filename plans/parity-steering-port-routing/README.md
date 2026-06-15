# Mission — steering-port routing (faithful routesplines for dot)

**Objective:** Make dot's regular-edge routing use the faithful
`beginPath → routeSplines → endPath → clipAndInstall` pipeline (the real
`routesplines_`), so edges with a side-mask port (compass exiting *away*
from the head, lateral `e`/`w` bulges, record/HTML ports) route through
proper box corridors instead of the simplified monotonic-corridor fitter.
This unblocks the cases the parity-edge-ports mission left as T6b (see that
mission's journal + [[active-fitter-no-loop-corridors]]).

**Key finding that shapes this mission:** the faithful path is **already
ported and proven** — `routeSplines`/`checkPath`/`limitBoxes`
(`src/common/splines-routespl.ts`), `beginPath`/`endPath`
(`splines-path-begin.ts`/`-end.ts`), `newSpline`/`clipAndInstall`
(`splines-clip.ts`), and `Proutespline`/`Pshortestpath`
(`src/pathplan/route.ts`,`shortest.ts`). neato, pack, and ortho route
through it today. **dot does not** — `routeOneEdge` (edge-route.ts) and the
partial `makeRegularEdge` (splines-route.ts) both use the simplified
`buildRankCorridor` + `computeSpline`, whose channel builder
(`boxesToPolygon` → `shortestPath`) assumes a *monotonic* rank corridor and
**truncates** the non-monotonic L-shaped loop corridor a steering port
needs.

So this is an **integration + validation** mission (wire dot to the proven
faithful path), not a from-scratch port. Blast radius is high — it changes
dot's core edge router — so rollout is staged and golden-gated.

Recon evidence: [SCOPE.md](SCOPE.md). Architecture decisions:
[decisions.md](decisions.md). Append-only log:
[decision-journal.md](decision-journal.md).

## Branch

`feature/steering-port-routing` off `main` (parity-edge-ports T6a/T8 merged).
Merge back with a **merge commit** on Scott's go-ahead.

## Canonical rules (carried)

- C source `~/git/graphviz/lib/` (tag 15.0.0) is the spec; refs only from
  the installed 15.0.0 `dot` binary. C function boundaries + `@see` per
  ported block.
- NEVER modify existing refs/manifest/tolerances — additions APPEND
  (AD-C1). Re-read this README + decision-journal.md after every compaction.
- One commit per task. Hook limits: 30 lines/fn, CCN 10, 5 params,
  500 lines/file — smallest fix, ≤2 attempts/file, then move on. Lizard
  miscounts inline object-type params and regex literals: use a named
  interface / `new RegExp('...')` (see parity-edge-ports T6a journal).
- No browser-hostile APIs in src/. EPL-2.0 SPDX header.
- Excluded/quarantined case ⇒ not "complete" until a side-by-side
  comparison page exists and is referenced in the decision journal.

## Quality Gates (after every task)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0 AND failed == 0 AND passed >= <baseline at mission start>
  on_fail: fix_and_rerun
- command: OUTDIR=/tmp/spr-x npx tsx .probes/render-all.ts + diff vs the
  pre-task render baseline
  pass: see AD3 — NO-PORT goldens byte-identical until the planned switch;
        ported-edge renders change only as intended
  on_fail: stop
- command: git diff --name-only HEAD~1..HEAD
  pass: within the task's declared write-set
  on_fail: stop
```

Capture the real baseline (tests passed, golden count) in the journal at
mission start — do NOT trust numbers written here.

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 — recon spike (de-risks 2–4) | [SR1 map the two dot routers + the faithful path's input contract](batch-1/SR1-recon-spike.md) → [findings](batch-1/SR1-findings.md) | [x] **GO** — PoC proved `routeSplines` routes the loop corridor; AD1 revised (seam=`routeOneEdge`; `makeRegularEdge` is dead code); key risk: begin/route/end never assembled before |
| 2 — wire ported edges through the faithful path (hybrid) | [SR2 build the BeginPath/EndPath context from a dot edge](batch-2/overview.md), SR3 route ported-with-side regular edges via routeSplines+clipAndInstall, SR4 oracle-validate the four sides | [x] **DONE** — SR2 assembled the faithful pipeline; SR3 wired side-port edges live; SR4 oracle-validated all 6 required cases ≤0.5pt vs dot 15.0.0 (`A:s->B:n` + record `A:f0:n->B` exact; T8's 11pt blocker cleared). Compound `A:n->B:s` excluded ([comparison page](comparisons/An-Bs-double-steering.md)). 115 goldens byte-identical; 1767/0 tests |
| 3 — broaden coverage | SR5 flat-edge (FLATEDGE) ports, SR6 self-edge ports, SR7 multi-rank virtual-chain ports (each gated; journal exclusions) | [x] **DONE** — SR5 flat box-branch (A:n->B:n exact, A:e->B:w 0.25pt; bottom-tail + adjacent excluded). SR6 self-edges already faithful (validation+pin; e/w lateral excluded). SR7 multi-rank chain (A:n->C/A:e->C/A:n->D ≤0.32pt; left-bulge + straight-mode excluded; fixed Splinesep=nodesep/4). 115 goldens byte-identical; 1775/0 tests; 5 comparison pages for exclusions |
| 4 — goldens + decide on full switch | SR8 mint steering-port goldens vs dot 15.0.0; SR9 evaluate routing ALL dot regular edges through the faithful path (the 115-golden re-validation question, AD3) | [x] **DONE** — SR8 landed the edge-`<title>` fix (ports + `&#45;` + compass-replaces-field; all 10 oracle cases match) and minted 4 steering-port goldens (aligned/e/w/record, ≤0.5pt + 0.01pt portRef pins; count 115→119); bbox-divergent steering cases comparison-paged. SR9 evaluated the full switch → **recommend KEEP HYBRID** (simplified fitter is byte-exact to dot 15.0.0; full switch perturbs 4/68 with no fidelity gain; no re-mint). 1779/0 tests |

Batch 1 is a **spike**: its output finalizes the batch-2/3/4 task files
(which are intentionally specified at overview level until recon resolves
the integration seam and the beginPath input contract).

## Stop conditions

- Change outside the active task's write-set.
- 2 consecutive gate failures on the same check; same location/approach
  changed 3+ times for one failure.
- Implementation contradicts AD1–AD5 ([decisions.md](decisions.md)).
- A divergence from the C oracle traces to `Proutespline`/`Pshortestpath`
  numeric internals (FMA/libm-class) — journal with disassembly-or-stop per
  the `src/common/fma.ts` precedent; do not chase.
- Routing ALL dot edges through the faithful path is found to perturb the
  existing 115 goldens beyond 0.5pt in a way not explainable as a faithful
  improvement — STOP and surface the hybrid-vs-switch decision (AD3) before
  re-minting any ref.

## Push-forward conditions (journal each)

- Hook-forced module splits; C boundaries + `@see` preserved.
- Probe design under `.probes/` (untracked).
- Test-fixture repairs in files the task owns.
- Golden tolerance 0.5pt when a steering port moves geometry >1pt vs the
  no-port baseline (html-label/T6a precedent).

## Key references

- [SCOPE.md](SCOPE.md) — recon: the two dot routers, the faithful path's
  symbols + input contract, the loop-corridor truncation evidence.
- C: `lib/dotgen/dotsplines.c:make_regular_edge` (the orchestrator to
  mirror); `lib/common/routespl.c:routesplines_` (294); `splines.c:beginpath`
  (378) / `endpath` (575) / `clip_and_install`.
- TS faithful path (ported, proven via neato): `src/common/splines.ts`
  (re-export hub), `splines-routespl.ts`, `splines-path-begin.ts`,
  `splines-path-end.ts`, `splines-clip.ts`, `src/pathplan/route.ts`,
  `src/pathplan/shortest.ts`.
- TS dot active router (to integrate): `src/layout/dot/edge-route.ts`
  (`routeOneEdge`), `edge-route-routing.ts` (`buildRankCorridor`,
  `computeSpline` seam), `splines-route.ts` (`makeRegularEdge`, partial).
- Predecessor: `plans/parity-edge-ports/` (T6a shipped attachment points;
  T6b journal documents this mission's necessity).
- Memory: [[active-fitter-no-loop-corridors]].
