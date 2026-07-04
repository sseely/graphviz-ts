# Mission: root-cause and fix the path-structure bucket (8 tracked diverged)

## Objective
Close the `path-structure` divergence bucket: 8 tracked diverged corpus ids
whose firstDiffPath is an edge `@d`. Pre-mission triage (2026-07-02) showed the
`@d` diff is mostly a **symptom**: 7 of 8 are layout divergences (ranking
extent or x-coordinate) upstream of spline routing; only 2620 is a true
routing-structure issue (already root-caused: ortho maze equal-cost corridor
tie-break). Diagnosis-first per `~/.claude/rules/diagnosis.md`: no fix before a
stated mechanism.

## The 8 ids (from test/corpus/parity.json, generated 2026-07-03)

| id | maxΔ | triage | task |
|---|---:|---|---|
| `2521` | 144 | bbox **height** Δ35 — y/ranking; 22-line repro, 3 clusters + cross-cluster rank=same | T1 |
| `1718` | 3726 | bbox **height** Δ3716 — grid graph w/ back edges | T1 |
| `2239` | 5287 | bbox **width** Δ5279 under rankdir=LR (rank axis) | T1 |
| `1879` | 876 | bbox Δ115×220 AND translate x 278.69 vs 4 (C extends left of origin) | T2 |
| `1447` | 192 | node x shifts 12–42px; splines=ortho downstream | T3 |
| `graphs-b51` | 1096 | x-NS residual after share-b51 labelVnode fix (d20df4d) | T4 |
| `2475_2` | 85 | x-NS class residual (post keepout fix) | T4 |
| `2620` | 3207 | KNOWN: ortho maze snode/adjacency insertion-order tie-break | F1 |

## Branch
`fix/path-structure-bucket` (cut from `main` @ 9032e52). Merge back with a
**merge commit** (mission-brief rule; squash destroys task commit ids).

## Constraints (stop / push-forward)
**STOP and wait for human when:**
- A fix needs files outside its declared write-set that no other task owns.
- 2 consecutive quality-gate failures on the same check.
- Implementation would contradict a decision in `decisions.md` (D1–D5).
- Same location/approach changed 3× without resolving the same failing check.
- An NS-core commit's full survey shows a verdict regression a revert doesn't
  cleanly explain.
- F1 (2620) needs more than build/insertion-order changes (D3).
- A fix requires changing the C oracle or survey-harness semantics.
- Any corpus id newly times out after a fix.

**PUSH FORWARD (log to decision-journal.md, continue):**
- A diagnosis proves two bucket ids share one mechanism → collapse fix tasks.
- A diagnosis lands in another task's instrumentation territory → record the
  hand-off, let the owning task's finding drive the fix.
- A fix is smaller than estimated (e.g., one-line calloc-zero coercion).
- Temporary gated instrumentation added and fully reverted within a task.
- A tracked-deep classification per D4, with the required evidence.

## Quality gates (after every batch)
- command: `npx tsc --noEmit`
  pass: exit 0
  on_fail: fix_and_rerun
- command: `npm run test`
  pass: exit 0
  on_fail: fix_and_rerun
- command: `npm run survey && npm run survey:gate`
  pass: 0 regressions vs committed HEAD parity baseline; target ids improve or
  are unchanged (never worse)
  on_fail: stop
- command: `git diff --name-only <batch-start>..HEAD`
  pass: only declared write-set files (+ notes/goldens)
  on_fail: stop

Survey recipe (memory: parity-json-recipe-estimate-ghl): Estimate measurer +
`GVBINDIR=/tmp/ghl`. Never LUT. Oracle cache is namespaced; rebuild the cache
if the C binary is rebuilt.

## Batches

- [x] **Batch 1 — parallel diagnosis** (T1–T4 complete, 4 mechanism notes)
- [x] **Batch 2 — fixes**: F1 (9933511), F2 (dd56749), F3 (stop→root cause,
      no commit), F4 (5cc7c6b re-land), F6 (0ce0a54), F7 (264484f),
      F8 (eb8cb97); D5/D6 diagnosis notes; F5 cancelled.
- [x] **Batch 3 — baseline refresh + wrap-up**: T9 (f6f5866)

## MISSION SUMMARY (2026-07-03)

**Tasks:** 13 executed (4 diagnosis + 2 mid-mission diagnosis + 6 fix tasks +
T9) vs 7 planned — the extra tasks came from mechanisms discovered en route
(D5, D6, F6 margin, F7 AGSEQ, F8 mincross-failure). One planned task (F5)
cancelled (D5 landed tracked-deep).

**The 8 bucket ids, before → after:**

| id | before | after | disposition |
|---|---|---|---|
| `graphs-b51` | diverged Δ1096.4 | **conformant** | F7 AGSEQ iteration (+F4 ufUnion) |
| `2521` | diverged Δ144 | **structural-match Δ7** | F4 ufUnion ND_id tie-break |
| `1879` | diverged Δ875.7 | diverged Δ875.7 (bbox now Δ0) | F2 pad + F6 margin closed the bbox/translate layer; the surviving maxΔ is the ltail pre-clip spline residual (tracked-deep, `.agent-notes/1879-ltail-chain-spline.md`) |
| `1447` | diverged Δ192.4 | diverged Δ192.4 | x-coord LR_balance degeneracy class — tracked (see xns note) |
| `2239` | diverged Δ5286.7 | diverged Δ5286.7 | LR_balance slack over feasible-tree state — tracked-deep (D6 note) |
| `2475_2` | diverged Δ85 | diverged | mix of rank-axis + x-axis degeneracy — tracked-deep (T4 note) |
| `2620` | diverged Δ3207 | diverged | ortho equal-cost tie-break; construction order EMPIRICALLY ruled out (F1) — tracked-deep |
| `1718` | diverged Δ3725.9 | diverged | per-rank spacing, mechanism still open; virtualNode-id candidate disproven (F4) |

Also improved outside the table: 1581 (A4 family) diverged Δ465 → diverged
Δ85 — F8 restored C's mincross-failure abort so the port now follows the
oracle's recovery shape instead of crashing.

**Bonus fixes beyond the bucket:** 1308 → conformant, 2082 + 2592 byte-match
(pad), partition DFS-order fidelity (F1), splines-clone fresh-id (F7
fallout), dotMincross failure propagation (F8, fixes the 1581 crash the
ufUnion fix exposed).

**Load-bearing discovery:** the "NS degenerate-optimum selection" class that
blocked 5 bucket ids (+ 2371) was NOT network-simplex pivot order — the NS
core is faithful. It was (a) ufUnion tie-breaking on AGID where C's ND_id is
never written under dot (F4), and (b) subgraph node iteration using Map
insertion order where C's agfstnode iterates AGSEQ (F7, 44 sites/15 files).
Memories saved: agseq-node-iteration-done, ufunion-ndid-tiebreak-done.

**Final gates:** tsc clean · 2606/2606 tests · survey gate 0 regressions,
0 clip-regressions · write-set audit clean.
**Final baseline (f6f5866):** 602 conformant / 163 structural-match /
12 diverged / 0 errored / 1 timeout / 11 oracle-error → 765/789 (97.0%)
structurally equal. Baseline was 600/163/14/0/0/12.
**Newly scored:** 1652 (oracle previously died; native now completes at 208s
near the 300s cap; port exceeds the timeout floor — slow-tail perf debt,
tracked, not a layout regression).

**Decisions:** 17 journal rows; flagged for review: the F4 re-land after
disproving the flaky 2646 timeout, the F7 scope expansion beyond F3's
write-set stop, and the survey's contention-sensitive timeout tail (2343/
2371/2646/graphs-b100/b104/graphs-in flipped verdicts across three runs on a
loaded machine — consider capturing canonical PORT times or lowering default
survey concurrency).

**Follow-up missions proposed:** (1) 1879 ltail pre-clip spline (needs
C-side instrumentation; recipe in the D5 note), (2) LR_balance degeneracy
family (1447/2239/2475_2 residuals — next layer after AGSEQ), (3) 2620
ortho tie-break (routing-order × updateWts or cost divergence), (4) 1718
per-rank spacing, (5) slow-tail perf (1652, 2646, 2343, 2371 at 3-5×
native).

## Key docs
- [decisions.md](decisions.md) — locked architecture decisions D1–D5
- [decision-journal.md](decision-journal.md) — append during execution
- [diagrams/component-map.md](diagrams/component-map.md)
- [diagrams/data-flow.md](diagrams/data-flow.md)

## Prior knowledge (read before diagnosing — do not re-investigate)
- `.agent-notes/2361-ortho-maze-corridor-tiebreak.md` — 2620/2361 class root
  cause + C route-dump repro (`-Godb=r`).
- `.agent-notes/b51-blok60-is-xcoord-ns-selection.md` — XNSDBG paired
  instrumentation method; labelVnode lw fix already landed (d20df4d).
- `.agent-notes/2371-is-xcoord-ns-solution-selection.md` — x-NS degenerate
  optimum class; fast-repro toolkit.
- `.agent-notes/hang-2475-2` context lives in memory
  (hang-2475-2-xcoord-ns): keepout_othernodes rankGet fix already landed.
- Triage repro for every id:
  `GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/<id>.dot`
  vs `GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts
  ~/git/graphviz/tests/<id>.dot dot`, diffed with
  `node test/diagnostic/flat-geom-diff.mjs <c.svg> <port.svg>`.
