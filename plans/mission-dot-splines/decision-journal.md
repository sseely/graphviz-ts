# Decision Journal — dot-splines (DOT-1)

Appended during execution (per ~/.claude/rules/autonomous-execution.md).

| Task | Date | Decision | Rationale | Flagged |
|------|------|----------|-----------|---------|
| T1 | 2026-06-16 | Added a default-OFF `FaithfulForceMode` switch (`off`/`adj`/`mr`/`all`) in `edge-route.ts` + harness `.probes/dot-splines-faithful-measure.ts` to measure faithful-all routing. | Non-invasive measurement (T1 step 2). Mode lets the harness attribute shifts to adj-plain vs mr-plain without model introspection. Flag OFF ⇒ goldens byte-identical (verified 1800/0). | No |
| T1 | 2026-06-16 | **Discovery:** faithful path declines EVERY plain regular edge. Root cause: `boundMissing` (edge-route-faithful.ts) checks only `ED_spl(e)` one level deep, but C `getsplinepoints` walks the `to_orig` chain — a bound edge's spline lives on its `to_orig` original. So `completeRegularPath`→`pathBoundsReady` fails and the edge falls back to the fitter. | Verified by probe: `topBound` returns a VIRTUAL bound (edge_type=1, spl undef) whose `to_orig` (NORMAL) holds the spline. C `splines.c:1363 getsplinepoints` loops `to_orig`. | **Refines T2** |
| T1 | 2026-06-16 | Measured the inventory WITH a one-line `boundMissing` chain-walk fix applied, then REVERTED it (it lives in edge-route-faithful.ts, outside T1's write-set). The fix is T2's first sub-task. | Measure-first needs the real post-fix numbers; keeping the fix would fail T1's write-set gate (`git diff` must be within harness+journal+edge-route.ts). | No |
| T1 | 2026-06-16 | **Scope: GO.** Faithful-all shifts only **3** dot goldens (≤0.36pt, all adj-plain), far below the >20 STOP threshold, and FIXES 5 broken corpus cases. Migration is low-risk; proceed to T2. | See inventory below. | No |

## T1 divergence inventory (2026-06-16)

Harness: `.probes/dot-splines-faithful-measure.ts`. Measured WITH the T2
`boundMissing`→getsplinepoints chain-walk fix applied (then reverted; see table
above). Goldens compared vs stored C reference at deterministic 0.01pt; corpus
vs the live dot 15.0.0 oracle at 0.5pt. Mode `all` forces every plain forward
adjacent + multi-rank edge through the faithful pathplan path.

**Goldens that shift under faithful-all** (the set Batches 2/5 must re-close):

| golden | category | worstΔ(all vs C-ref) | notes |
|--------|----------|----------------------|-------|
| dot-rankdir-lr | adj-plain + rankdir | 0.22 | breaks byte-identical; close in T2 (T5 verifies) |
| dot-rankdir-rl | adj-plain + rankdir | 0.22 | breaks byte-identical; close in T2 (T5 verifies) |
| dot-node-penwidth-edge-clip | adj-plain | 0.36 | breaks byte-identical; close in T2 |

Of 47 dot goldens with edges: **44 no-op** (faithful output identical to the
fitter ≤0.01pt), **0 migrated-matches**, **3 diverge** (above). Max Δ(all vs
C-ref) across ALL goldens = 0.36pt. All 3 are `adj-plain`; none are `mr-plain`.
The deltas are sub-pixel → minor box/clip corrections in T2, not structural.

**Corpus parity — faithful-all vs dot oracle** (does faithful fix the known
divergences from `.agent-notes/dot-splines-reverification.md`?):

| case | source | offΔ | allΔ | verdict |
|------|--------|------|------|---------|
| fanout | `a->{b..f}` | 102.05 | 0.00 | FIXED |
| merge5 | `{b..f}->z` | 102.05 | 0.00 | FIXED |
| fan7 | `a->{b..h}` | PTCNT | 0.00 | FIXED |
| rankdir-lr | LR `a->b->c;a->c` | 8.33 | 0.30 | FIXED |
| lr-long | LR `a->b->c->d;a->d` | 10.55 | 0.30 | FIXED |
| lr-fan | LR `a->{b..f}` | PTCNT | 0.76 | improved (residual > 0.5pt) |

All other corpus cases (chain/tree/diamond/parallel3/cluster/backedge/longspan/
edgelabel/dense/wide/fan2/fan3) are already correct under both modes (Δ=0).

### Refinements to downstream batches

- **T2 (adjacent fwd → faithful):** FIRST sub-task is the `boundMissing`
  getsplinepoints chain-walk fix (one function in edge-route-faithful.ts) — it
  unblocks the whole category. After it, close the 3 sub-pixel golden shifts
  (dot-rankdir-lr/rl 0.22, dot-node-penwidth-edge-clip 0.36) so they stay
  byte-identical. Pin fanout/merge5/fan7 oracle tests (the FIXED cases).
- **T3 (multi-rank fwd → faithful):** `routeMultiRankEdgeFaithful` already
  engages for plain TB chains (longspan matches dot, no golden shift) and for LR
  (lr-long FIXED 0.30). No multi-rank golden diverges — T3 may be near no-op once
  the boundMissing fix lands; verify and pin.
- **T4 (back + non-forward):** NOT exercised by the T1 switch — it only reroutes
  forward adj+mr edges; the faithful back/non-forward path is unported. T4 must
  wire those categories through the faithful pipeline, THEN re-run the harness
  (extend it with back/nonfwd modes) to measure their inventory.
- **T5 (rankdir LR/RL/BT):** dot-rankdir-lr/rl carry the only rankdir golden
  shifts (0.22, shared with T2's adj-plain fix). lr-fan has a 0.76pt residual >
  tol — quarantine candidate (AD-5) if T2/T5 cannot close it.
