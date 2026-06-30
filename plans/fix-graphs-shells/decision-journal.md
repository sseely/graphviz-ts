<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution. Batch 1 (T1) writes the mechanism artifact here
(Mechanism / Origin `file:line` / Causal chain / Ruled-out), which T2 consumes.

| date | batch/task | decision / finding |
|---|---|---|
| 2026-06-30 | pre-mission | Diagnosis: graphs-shells `diverged` is a mincross within-rank flat-order swap on 3 ranks (POSIX/ksh-POSIX, System-V/ksh, esh/vsh), NOT the reported edge spline. Ranks all match. Siblings share/windows-shells identical. See `.agent-notes/graphs-shells-flat-order-divergence.md`. |
| 2026-06-30 | B1/T1 | **MECHANISM PINNED (gated STOP — no fix applied).** Origin = `left2right` over-constraint: port reads BOTH flat-matrix directions, C reads ONE. See artifact below. |
| 2026-06-30 | gate | Human confirmed: proceed to Batch 2 with the **GD_flip-gated** single-cell fix. |
| 2026-06-30 | B2/T2 | Applied fix at `mincross-cross.ts:left2right` (single GD_flip-gated `matrixGet`, returns 1/0). Updated b58 test (its reverse=-1 assertion encoded the bug) + 2 new regression tests (single-direction; GD_flip gating). typecheck 0; vitest `src/layout/dot` 478 pass; shells renders `vsh esh`/`ksh System-V`/`ksh-POSIX POSIX`. Commit `dacbb20`. |
| 2026-06-30 | B2/T3 | `survey:gate` PASS — **0 regressions**, 3 improvements. graphs/share/windows-shells diverged → **conformant**. Totals conformant 536→539, diverged 48→45. Baseline + PARITY.md refreshed. Commit `9d9dff8`. |

## Mission summary (complete)

**Outcome:** All three `*-shells` variants `diverged → conformant`, **0 net parity
regressions**. Tasks completed 3/3 (T1, T2, T3); both batches done.

**Root cause (one line):** the port's `left2right` read both flat-matrix directions
(±1) where C reads a single `GD_flip`-gated cell (`bool`); the spurious reverse hit
(`left2right(KornShell, rc)` = -1 vs C's 0 for edge `rc→KornShell`) marked a rank-7
pair `muststay`, perturbing the crossing trajectory so `save_best` captured the
opposite equal-cost (1-crossing) orientation of the three 0-cost symmetric flat ranks.

**Fix:** `src/layout/dot/mincross-cross.ts` `left2right` →
`matrixGet(flat, flip ? wLow : vLow, flip ? vLow : wLow) ? 1 : 0` (mirrors
mincross.c:575-578). Single origin file (AD-2 honored); reversible (AD-4).

**Quality gates:** typecheck exit 0 · `vitest src/layout/dot` 478 pass ·
`survey` + `survey:gate` 0 regressions · 3 shells L-R order matches oracle ·
`git diff --name-only` = declared write-set only.

**Decisions of note:** chose the GD_flip-gated variant over forward-only (faithful
for LR/flip graphs too, not just shells/TB). Corrects the prior memory
`flatorder-enforce-left2right-low-done`'s claim that the both-direction read /
`GD_flip` swap was "inert" — it was an over-constraint.

**Known follow-up:** none for shells. The pre-existing 45 diverged ids are unrelated
tracked gaps. All temporary C+port instrumentation reverted; C rebuilt clean.

## T1 mechanism artifact (Batch 1 — gated; STOP for confirmation before Batch 2)

### Mechanism
The port's `left2right(v,w)` reads **both** flat-adjacency matrix cells and returns
±1 (`matrixGet(vLow,wLow)?1 : matrixGet(wLow,vLow)?-1 : 0`). C's `left2right`
returns a **`bool` from a single cell** `matrix_get(flatindex(v),flatindex(w))`
(with `v,w` pre-swapped iff `GD_flip(g)`; shells is TB so `GD_flip`=false → C reads
the forward cell only). The port's extra reverse-direction read makes it report a
flat constraint where C reports none, so a pair with a flat edge in the *opposite*
direction is wrongly treated as `muststay` (swap-blocked) in `reorder`/`transposeStep`
(both test `left2right(...) !== 0`).

### Origin (`file:line`)
- **Port (fix origin):** `src/layout/dot/mincross-cross.ts:101-102` — the second,
  reverse-direction read `if (matrixGet(flat, wLow, vLow)) return -1;` inside
  `left2right` (function body lines 82-104). The stale justifying comment at lines
  96-98 ("port checks BOTH directions … that swap is subsumed") is the wrong claim.
- **C spec:** `~/git/graphviz/lib/dotgen/mincross.c:578`
  `return matrix_get(M, flatindex(v), flatindex(w));` (single cell; direction
  selected by the `GD_flip` swap at :575-577), declared `static bool` at :557.

### Causal chain (instrumented, paired C+port on `shells`, all tracing reverted)
1. Init agrees: after `build_ranks` + `flat_reorder`, all ranks (incl. the 3 flat
   ranks **and** rank r=7 `1988 rc KornShell Perl`) match C exactly. Divergence is
   entirely in the `mincross_step` iteration trajectory.
2. First divergence: **pass0-iter1**, inside `reorder(r=7)` call #2 (up-pass,
   reverse=true). Reorder **input is byte-identical** to C (same order, same mvals:
   1988=0, V=512, rc=-1, KornShell=512, Perl=513, V=768, V=512). The only differing
   primitive in the whole reorder is one `left2right` call:
   `left2right(KornShell, rc)` → **C returns 0**, **port returns -1**. (Flat edge is
   `rc→KornShell` from the invis chain `1988->rc->KornShell->Perl`; cell (KornShell.low=3,
   rc.low=5)=false but reverse cell (5,3)=true → port's 2nd read returns -1.)
3. Port's `reorderFindRp` treats `-1 !== 0` as `muststay` → blocks differently than C
   → r=7 transiently reorders to `1988 KornShell rc Perl` (C keeps `rc KornShell`).
   This is a crossing-affecting rank, so the port's per-iter crossing **trajectory**
   diverges (C reaches cur_cross=1 at pass0; port only at pass2-iter4).
4. The 3 reported flat ranks (esh/vsh, ksh/System-V, POSIX/ksh-POSIX) are
   **0-cost symmetric pairs** (swapping them changes 0 crossings). Their final
   orientation is decided by *which* iteration `save_best` last captures
   (`cur<=best`). C's last best-capture is pass2-iter7 (order `vsh esh / ksh System-V
   / ksh-POSIX POSIX`); the port's is pass2-iter3 (the reverse on all three). The
   perturbed trajectory from step 3 is what shifts the captured iteration → the
   visible swap.

### Crossing-count parity → bug class
- C `best_cross = 1`; port `best_cross = 1` → **final crossing counts are EQUAL**.
- C's order under the **port's** crossing counter = 1 (the experiment below renders
  C's exact order and the port's `ncross` agrees), ruling out a counting-function
  divergence.
- ⇒ **bugClass = tie-break / stability** (not a heuristic miss). The defect is a
  *spurious extra constraint* in `left2right`, not a `< vs <=` operator or a worse
  heuristic; it changes which equal-cost (1-crossing) order is captured.

### Confirming experiment (temporary, reverted)
Gating the port's reverse read off (forward-only, matching C non-flip) made the port
render **all** `shells` ranks in C's exact order — the 3 flat ranks become
`vsh esh` / `ksh System-V` / `ksh-POSIX POSIX`, identical to the oracle. Confirms
this single primitive is the whole divergence.

### Ruled out (with evidence)
- **Initial seed / build_ranks / flat_reorder:** identical C↔port at all init dumps.
- **medians / mval values:** reorder(r=7) input mvals byte-identical C↔port.
- **reorder/transpose logic itself:** identical given identical `left2right`; the
  only differing call is `left2right(KornShell,rc)`.
- **Crossing function (`ncross`/`rcross`/`in_cross`/`out_cross`):** both reach
  best=1; C's order scores 1 under the port counter.
- **`low`-vs-`order` matrix indexing** ([[flatorder-enforce-left2right-low-done]]):
  correct and unchanged — `low` reads are right; the bug is the *number of cells read*.
- **GD_flip swap "inert" claim** (same prior memory): **false** — which cell is read
  changes the boolean (here fwd=false, rev=true), so the both-direction read is an
  over-constraint, not a sign-only difference.

### T1 → T2 interface contract
```
{ originFile: "src/layout/dot/mincross-cross.ts",
  originLine: 102,                 // the reverse-direction read; whole fn 82-104
  cPrimitive: "mincross.c:578 left2right returns bool from a SINGLE matrix_get(flatindex(v),flatindex(w)); direction chosen by GD_flip swap (:575-577). Port must read one cell, GD_flip-gated, not both.",
  bugClass: "tie-break" }
```
Single origin file (`mincross-cross.ts`) ⇒ within AD-2 scope (no re-scope needed).
**Gated STOP: awaiting human confirmation before Batch 2 (T2 fix + test, T3 survey).**
