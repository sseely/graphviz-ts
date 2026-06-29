# Decision journal

| When | Task | Decision / observation | Rationale |
|------|------|------------------------|-----------|
| start | — | Branch `feature/2368-byte-match` created off `main`. Pre-existing working-tree changes (settings + untracked notes) left untouched; task commits scoped to declared write-sets only. | Protocol startup. |
| start | — | Executing batches directly (orchestrator acts as debugger) rather than spawning per-batch subagents. | Batches are strictly sequential with heavy context carryover (each consumes prior's pinned divergence); a blank-slate agent per batch loses the thread and I retain findings anyway. Deviates from brief's "Agent: debugger" label; justified by sequentiality + the instrument-c method rule needing retained C ground-truth. |
| B0 | T0 | **Issue 2 pinned**: C `make_flat_adj_edges` groups adjacent no-port flats by the **unordered** {tail,head} set. FGEOM trace: {76,376}=cnt3 [invis, from1, to1], {376,196}=cnt2, {436,256}=cnt2. `edgelblcmpfn` → wide `from1` = earray[0] straight; narrow `to1` = earray[1] **down-arc**. Port's `collectAdjFlatGroup` keys ORDERED (tail,head) → opposing `to1`/`to2` become cnt=1 groups drawn straight. Diff sig: 376→76 / 376→196 / 256→436 COORD-COUNT C=14 port=8. | Instrumented C (FGEOM-gated), reverted clean. Target geometry in flat-geom-trace.md. |
| B0 | T0 | **Issue 1 NOT independent**: inter-rank node spans identical (top→bottom 117.8 both); only bbox/translate differ (Δ ty 4.95). `flat_edges` stores only label WIDTH for adjacent flats (FIX comment: height not accounted). So 4.95 = bbox growing to include omitted down-arcs+labels. Hypothesis: Batch 1 (drawing arcs) resolves Issue 1 → Batch 2 likely no-op. Verify empirically after Batch 1. | Matches AD-2 rationale. |
| B0 | T0 | Gates: tsc exit 0. No source/geometry change (C reverted) → 17-min survey not required for diagnostic-only batch. Write-set = test/diagnostic/{flat-geom-trace.md,flat-geom-diff.mjs}. | Per gate note "run after each geometry change". |
| B1 | T1 | Fixed Issue 2: `collectAdjFlatGroup` now groups the UNORDERED {tail,head} set; `groupTnHn` picks tn=lower-order/hn=higher-order; new `installFlatLeg` reverses points + ignoreSwap for a right-tail leg (mirrors makeFlatLabeledEdge idiom — port's clipAndInstall stores points verbatim, unlike C which reverses internally). | Opposing legs (to1/to2) were drawn straight as cnt=1 e0; now earray[1] down-arcs. |
| B1 | T1 | **Issue 1 auto-resolved by Batch 1** (height Δ5→0, ty Δ4.95→0): drawing the down-arcs+labels grew the bbox to include them, as hypothesized in T0. **Batch 2 / T2 will be a no-op.** | Confirms AD-2 rationale; node spans were always identical. |
| B1 | T1 | First survey FAILED: 1 regression 2476 (structural→diverged maxΔ2.9). Root cause: unconditional unordered grouping merged 2476's opposing pair (Cobra↔Meerkat, labeled+unlabeled, NO concentrate) which C does NOT group. C instrumentation (FGEOM+ED_adjacent): 2476 = two cnt=1 calls (different getmainedge); 2368 {76,376} = one cnt=3 (concentrate merges class). | C dispatch groups by shared getmainedge, not just the pair. |
| B1 | T1 | Fix: gate grouping on `getMainEdge(f) === getMainEdge(e)` (faithful to C dispatch). Verified: 2476 opposing leg back to straight (matches C); 2368 still cnt=3 arcs; opp8 (both-labeled opposing, no concentrate) still arced (matches C — getMainEdge unifies); same-direction parallels still group (17 flat tests pass). | getMainEdge is C's exact discriminator. |
| B1 | T1 | 2368 residual after B1: height byte-match; width Δ4 + arc Δ (376→76=11.22) all downstream of pre-existing x-NS node deltas (Issue 3): equal-shift pairs (256→436, both Δ4) match C modulo shift; differential-shift {76,376} (76 Δ0/376 Δ2) distorts the box → spline amplifies. Added opposing-pair unit test. tsc+2468 vitest pass. | 2368 byte-match blocked only by Issue 3 (Batch 3, AD-3 conditional). |
| B1 | T1 | GATE PASS: stable=690 (↑1), improvements=1 (2368 diverged→rules-match), regressions=0, clip-regressions=0. Committed 307d28f. | AD-4 hard invariant held. |
| B2 | T2 | **NO-OP** (per AD-2 / T0 hypothesis, now confirmed). Issue 1 (vspace) was a consequence of Issue 2, fully resolved by Batch 1: every 2368 node Y byte-matches C (top group line7/136 at -140.35; height 148; ty 144.35). No `flat.ts`/`position-ycoords.ts` change needed. No code change → no survey. | Batch-2 vspace target (608×148 height, top group at C's Y) achieved by B1; remaining width Δ4 is Issue 3. |
| B3 | T3 | Issue 3 (x-NS) was NOT the deep 2371 optimal-face slack — FDIST instrumentation pinned it to a LOCALIZED missing `ED_dist` accumulation: the port set flat-label dist per-edge; C (flat.c:319-322) MAX-accumulates label width onto the class REP via the to_virt chain in the `other`-list loop. The {76,376} concentrate rep had dist=0 (invis), so make_LR_constraints reserved 90 not 92. | Localized + low-risk (flat-edge domain) → pursued per AD-3, not deferred. |
| B3 | T3 | Fix: rewrote flat.ts flat_edges dist pass faithful to C — `processFlatOutLabel` (dist on rep) + `processOtherLabel` (resolve rep via to_virt, copy adjacency, MAX dist onto rep, rank/self guards), both gated on flat_out existing. RESULT: 2368 bbox byte-match (608×148) + EVERY node x byte-match C; 256→436/376→196 down-arcs now byte-identical. GATE PASS: stable=690, 0 regressions. | Huge improvement; far beyond AD-3's "≤1pt residual" target. |
| B3 | T3 | Residual: ONLY 376→76 (maxΔ10.22) + 196→376 (0.14). C-instrumented (FGEOM box+ps dump, reverted): 376→76 & 256→436 down-boxes are TRANSLATIONALLY IDENTICAL (Δ274, perfectly symmetric about ctrx) yet C's Pshortestpath routes them as MIRROR images (376→76 dips left/touches right notch corner; 256→436 dips right). Port routes both translation-consistently (matches C on 256→436, not 376→76). | Deep core-pathplan Pshortestpath symmetric-box funnel tie-break — position-dependent in C; out of labeled-flat scope, high-risk (would touch the 25/25 route corpus). Documented residual per AD-3. |

## Session summary

**Tasks completed:** T0 (instrument), T1 (Issue 2 fix), T2 (no-op — Issue 1
auto-resolved), T3 (localized ED_dist fix), T4 (validate + baseline refresh).
All 5 tasks done; 4 commits (T0, T1, T2-docs, T3) + T4.

**Result:** 2368 diverged maxΔ65.25 → structural-match maxΔ10.22 (rules-match).
bbox (608×148), every node, every label, and all edges except `376->76`
byte-match C. Survey: stable 689→691, 0 regressions across all batches.

**Decisions of note:**
- Issue 1 (vspace) and Issue 2 (arcs) had ONE root cause (missing arcs → bbox
  short); fixing Issue 2 resolved Issue 1, making Batch 2 a no-op.
- Grouping gated on `getMainEdge` (not raw unordered pair) to match C's dispatch
  and avoid the 2476 regression (mixed-label opposing pair, no concentrate).
- Issue 3 was a localized `ED_dist` rep-accumulation bug, NOT the deep 2371 x-NS
  optimal-face — pursued (AD-3 localized+low-risk) rather than deferred.

**Known residual (out of scope):** `376->76` maxΔ10.22 — a core `Pshortestpath`
symmetric-box funnel tie-break (C is position-dependent; the port is
translation-consistent). Fixing it means deep pathplan work risking the 25/25
route corpus. Documented per AD-3 + stop-condition 5.

**Quality gates (final):** `tsc --noEmit` exit 0; `vitest` 2468 pass / 1 skip;
survey GATE PASS (0 regressions); write-sets matched each task.
