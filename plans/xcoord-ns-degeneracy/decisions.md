# Architecture decisions & constraints

## ADRs (approved)

**ADR-1 — Primary suspect = `LR_balance` (x-coord balance mode 2).**
- Context: C runs x-coord NS as `rank(g, 2, …)` (position.c:142); mode 2 =
  `LR_balance`, which resolves degenerate (equal-cost) positions — the weight=0
  slack honda exhibits.
- Decision: Start at `lrBalance` (ns.ts:311) but **follow the oracle** — true
  first-divergence may be upstream (aux build in position.ts/position-aux.ts,
  feasibleTree, or enter/leave pivot order).
- Consequences: Fix may land in ns.ts or position*.ts; write-set provisional.

**ADR-2 — Oracle granularity: dump 4 stages, diff for first divergence.**
- Decision: Instrument C and port to emit, for honda's x-coord NS: (1) aux graph
  (nodes + aux edges with weight/minlen); (2) pivot sequence (enter/leave per
  iter); (3) pre-balance node x; (4) post-LR_balance final x. First differing
  stage localizes the fix.
- Consequences: Evidence-driven fix site, not guessed.

**ADR-3 — Faithful to C; no honda-specific hack.**
- Decision: Fix mirrors ns.c/position.c. Deterministic tie-breaks derivable from
  graph structure (node/edge order, ranks) allowed; replicating non-derivable C
  pointer/alloc identity is NOT.
- Consequences: If divergence stems from unreproducible C pointer-iteration
  order → STOP and report as candidate accepted-divergence (like 2371).

**ADR-4 — Replicate C's `connectGraph` + double-`rank` recovery exactly.**
- Context: position.c:142-148 calls `rank(g,2,…)`; if non-zero (disconnected aux)
  → `connectGraph(g)` then `rank` again.
- Decision: Verify port `setXcoords` control flow matches before touching balance
  internals.

**ADR-5 — Done = honda match + zero regressions; broader graphs stretch.**
- REQUIRED: honda byte/structural match, `npm test` green, 0 survey regressions
  (both baselines). STRETCH (must not regress): 2371 / compress / 1658.

## Stop conditions

### Write-set expansion rule (overrides default "stop on out-of-write-set file")
When the oracle shows a file outside the provisional write-set must change, **do
NOT stop**. Pause and present: (a) the file, (b) why the oracle points there,
(c) the specific change. Ask the user to approve expanding the write-set. On
approval, record in `decision-journal.md` and continue.

### STOP and wait when
1. Unreproducible divergence (ADR-3): non-derivable C pointer/alloc/hash order.
2. 2 consecutive survey-gate failures on the same approach, OR same NS site
   changed 3× without converging.
3. Fix makes honda match but regresses ≥1 other graph with no C-faithful variant
   clearing both.
4. An ADR is contradicted by the oracle (e.g. divergence not in x-coord NS).
5. Matching C would require contradicting a verified-faithful ported invariant.

### PUSH FORWARD on judgment
- Instrumentation dump format/verbosity.
- Obvious faithful port of a C branch the oracle clearly implicates (log it).
- Adding/adjusting the focused unit test.
- Reverting instrumentation + clean oracle rebuild.
- Baseline refresh + dashboard regen mechanics.
- Minor scope reductions (log and proceed).

## Rollback
Reversible — single `git revert` of the fix commit restores prior layout. No
data migration. C instrumentation is reverted within the mission (T4).
