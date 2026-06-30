# T3 — Structural dump → name the divergent line

## Context
T1 produced a validated (canary-green) harness that dumps the aux graph's ranks
+ virtual-node chains for a named same-rank edge, C and port. T2 produced a
suspect-ranked list of aux-construction input gaps (prime suspect: the missing
`rank=source` subgraph pinning `auxt`). This task lands the **stage-by-stage**
C-vs-port comparison those inputs feed into, and names the **first** point of
divergence — the deliverable three prior sessions never landed.

The whole `#241_0` residual reduces to this one decision (memory
`flat-edge-241-is-y-only`): C gives the reversed back edge a curl (aux size 7),
the port routes it straight (size 4). Everything downstream (bb.ll.y, the global
+7.88 up-shift, the cardinal `:e->:w` misses) follows from it.

## Task
Using T1's harness on the synthetic repro (AD-2), dump and compare **per stage**
on `auxg`, C vs port, for the reversed `3->2`:
1. **After `dot_rank`** — `ND_rank` of `auxt`, `auxh`, and every aux node;
   `GD_maxrank`. **This is the expected first divergence** (rank gap differs →
   different normalize). Confirm or refute.
2. **After normalize / `dot_mincross`** — the virtual-node chain inserted for the
   reversed edge (none in the port if rank gap = 1; present in C if gap > 1);
   per-rank node order.
3. **After `dot_splines_`** — aux `size` (the 7-vs-4 symptom), to close the chain
   from rank decision → spline.

Drive the comparison from T2's highest-`rankImpact` suspect: if the
`rank=source` pin is the named gap, show its presence/absence changes
`auxh.rank`. **Do not implement the pin** (AD-1) — demonstrate the rank
difference by dumping both sides as-is and reasoning from the C structure; if a
conceptual one-off probe is needed, keep it inside `test/diagnostic/`, never in
`src/`.

Then **confirm on `#241_0`**: run the harness on the real input and verify the
same first-divergence appears for `3:sw->2:se` (the synthetic repro generalizes).

Finally, write the **fix hypothesis for the next mission** — one paragraph,
explicitly *not implemented here*: which port construction/layout line to change,
and the predicted effect (`auxh.rank` 1→2 ⇒ virtual node ⇒ size 4→7 ⇒ `bb.ll.y`
drops ⇒ +7.88 up-shift restored).

## Write-set
- `plans/flat-aux-curl-diagnosis/findings-structural-dump.md` (Create)

Do **not** modify any file under `src/` (AD-1). Any C instrumentation is
ephemeral and reverted; the clean plugin + native oracle cache restored (AD-6).

## Read-set
- `decisions.md` (AD-1, AD-5, AD-6)
- `plans/flat-aux-curl-diagnosis/findings-harness.md` (T1 — harness interface)
- `plans/flat-aux-curl-diagnosis/findings-input-parity.md` (T2 — suspect order)
- `test/diagnostic/flat-aux-dump.ts`, `test/diagnostic/flat-back-port.dot`
- `lib/dotgen/dotsplines.c:1199-1232` (dot_rank/mincross/splines on auxg);
  `lib/dotgen/rank.c` (rank=source handling) in `~/git/graphviz`

## Interface inputs
From T1: the dump shape `{ edge, maxrank, nodes[], chain[], auxSize }` (C + port).
From T2: suspect-ranked input list `{ input, cReplicated, rankImpact, note }`.

## Acceptance criteria
- **Given** the synthetic repro and `3->2`, **when** T3 dumps per stage, **then**
  it names the **first** stage where C and port diverge, with both numeric values
  (e.g. "after dot_rank: C auxh.rank=2, port auxh.rank=1") and the C+port lines.
- **Given** `#241_0`, **when** the harness runs on `3:sw->2:se`, **then** the same
  first-divergence reproduces (synthetic repro generalizes), or the difference is
  documented.
- **Given** the divergence, **when** T3 closes the chain, **then**
  `findings-structural-dump.md` traces rank decision → virtual node → aux size
  4-vs-7 in ≤10 lines.
- **Given** the deliverable, **when** read, **then** it contains a one-paragraph
  fix hypothesis explicitly marked **NOT IMPLEMENTED — next mission** (AD-1).
- **Given** task end, **when** `git diff --name-only main` runs, **then** no
  `src/` file appears and no golden changed; the C plugin is restored to native.

## Observability
N/A — diagnosis.

## Rollback
Reversible — findings doc only; C instrumentation reverted (AD-6).

## Quality bar
`npx tsc --noEmit` exit 0 (harness still typechecks); goldens conformant;
`npx tsx test/corpus/survey.ts` shows `parity.json` unchanged (0 delta — no src
change). One commit: `docs(diag): name aux rank divergence for 3->2 + fix
hypothesis`.
