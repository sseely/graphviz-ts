<!-- SPDX-License-Identifier: EPL-2.0 -->

# Architecture decisions

All locked for this mission. A conflicting constraint discovered during
execution → stop and log to `decision-journal.md`.

## AD-1 — Instrument C before hypothesizing (faithfulness-first)

**Context:** The repo's standing rule (memory `instrument-c-before-quarantine`)
and two prior mincross/NS bugs (`leaveEdge` pivot inflation; `accumCross`
geometric-vs-VAL tiebreak) show divergences are usually the port doing *more
work* than C, not raw slowness.

**Decision:** The diagnosis MUST dump actual C intermediate values (per-pass
`ncross()`, reorder/transpose pass counts, `accumCross` comparison counts) and
diff them against the port BEFORE proposing any fix. The default assumption on a
gap is "the port differs from C — find where," not "JS is just slow."

**Consequences:** Batch 1 is not complete until C and port counters sit
side-by-side in `findings.md`.

## AD-2 — Two fix paths, decided by the counts

**Context:** The cause is one of two kinds.

**Decision:**
- **Iteration-count gap** (port runs more passes / counts more crossings than
  C): fix the specific divergence — `ncross()` value, convergence ratio
  `Convergence=.995`, `MinQuit`/`maxthispass`, or a crossing-count tiebreak —
  to match C exactly. This both speeds up *and* stays correct, because C
  produces the same SVG with fewer passes.
- **Per-op constant factor** (counts already match C): apply representation /
  per-op optimizations to `reorderInner` / `accumCross` (e.g. the crossing-count
  data structure, hoisting hot `.info` reads, removing per-iteration
  allocation) WITHOUT changing the iteration count.

**Consequences:** The fix is chosen by evidence, not guessed. Iteration-count
fixes are preferred (bigger, safer wins).

## AD-3 — Byte-identical, zero regressions

**Context:** This is a perf/faithfulness change to a correct pipeline.

**Decision:** Output must not change. Gate = full vitest green, `tsc` clean, and
a survey where **no byte-match or structural-match case regresses** and **no
per-id verdict changes** (mincross order changes ripple into positions/splines,
so any verdict change is a real regression). Capture `parity-baseline.json`
before; diff after. A faithfulness fix that matches C's iteration count must
still yield identical SVG (C yields that SVG); if it does not, the fix is wrong —
stop.

**Consequences:** Hard, objective gate. A single changed verdict = stop.

## AD-4 — Open write-set with an ask-gate (not a closed set)

**Context:** The human directed: assume mincross files are touched, allow
creating files, and **ask** to add other files rather than closing the set.

**Decision:** The standing write-set is `src/layout/dot/mincross*.ts` (+ their
`*.test.ts`) and anything new under `src/layout/dot/` or
`plans/mincross-perf-derisk/`. If discovery shows the fix must touch a file
outside that (e.g. `fastgr.ts`, `mincross-utils.ts` if not already counted,
`nodeInfo.ts`, a shared geom util), the executor **pauses, names the file and
the reason, and requests permission** — it neither hard-stops the mission nor
silently expands scope.

**Consequences:** Scope stays controlled but discovery-friendly. Expect at least
one such ask (the human expects "you'll learn a lot in discovery").
