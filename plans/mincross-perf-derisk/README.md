<!-- SPDX-License-Identifier: EPL-2.0 -->

# Mission: mincross perf derisk + execute

## Objective

`2108.dot` renders in 84 s (native dot: 14 s; ~6×). Profiling shows it is
**mincross-bound**, not emission-bound: `reorderInner` 47% + `accumCross` 17%
+ `transposeStep`/`rcross`/`interclexp`/`cleanup1Virt` ≈ **80%** of runtime
(SVG emission is ~0.1%). This mission **diagnoses why** — an iteration-count
divergence from C (faithfulness bug) vs pure per-op constant factor — then
**executes the indicated byte-safe fix**.

The repo has precedent for both failure modes in mincross: `leaveEdge`
pivot-count inflation (network simplex) and an `accumCross` tiebreak that
counted crossings differently from C. The **primary hypothesis** is that the
port's `ncross()` diverges from C, so the convergence loop (`mincross.c:690`,
`Convergence=.995`, `MinQuit`, `maxthispass`) runs **more reorder/transpose
passes** than native.

## Success bar

- **Diagnosis (Batch 1):** a `findings.md` with side-by-side C-vs-port counts
  (reorder passes, transpose passes, `ncross()` per pass, `accumCross`
  comparisons) for 2108 + graphs-b100 + 2471(control), and a clear verdict:
  *iteration-count gap* or *per-op constant factor*, naming the target
  function(s) and the exact divergence.
- **Execution (Batch 2):** apply the byte-safe fix; **2108 render time drops
  meaningfully** (target: toward ≤3× native / under the 20 s budget if the gap
  is iteration-count); **zero parity regressions**; **output byte-identical**.
- If diagnosis shows the only lever is an algorithm change → STOP, report,
  do not implement.

## Branch

`feature/mincross-perf-derisk` (merge commit to main — preserves per-task IDs).

## Constraints

**Stop and ask the human when:**
- A fix would change emitted SVG for any currently-passing case (byte-identity
  is sacred — see `decisions.md` AD-3).
- Matching C's iteration count would require an actual **algorithm change**
  (forbidden — only representation / per-op / faithfulness-to-C may change).
- Diagnosis is **inconclusive**: counts match C *and* no clear per-op lever.
- Two consecutive validation-gate failures on the same check.

**Stop and ask to EXPAND the write-set (do not hard-close, do not silently
expand):**
- The fix needs a file **outside `src/layout/dot/mincross*.ts`** (e.g. a shared
  util, `fastgr.ts`, `nodeInfo.ts`). Pause, name the file + why, request
  permission, then proceed. New files may be **created** freely under
  `src/layout/dot/` and `plans/mincross-perf-derisk/`.

**Push forward with judgment on:**
- Instrumentation approach / counter placement (temporary, reverted).
- Which mincross-bound corpus cases to re-time.
- Comparison-page formatting.
- Batch 2 auto-proceeds if the fix is byte-safe and within the permitted
  write-set (human chose "auto-proceed if byte-safe").

## Quality gates (run between batches)

| command | pass | on_fail |
|---|---|---|
| `npm run typecheck` | exit 0 | fix_and_rerun |
| `npm test` | exit 0 | fix_and_rerun |
| `npm run build:js` | exit 0 | fix_and_rerun |
| `npx tsx test/corpus/survey.ts` | **0 regressions** vs `parity-baseline.json` | stop |

Regression check: byte-match (312) + structural (256) must never decrease;
diff per-id verdicts (0 changed for a pure perf fix). See `decisions.md#ad-3`.

## Batches

| Batch | Tasks | Status |
|---|---|---|
| [batch-1](batch-1/overview.md) | D1 instrument port · D2 instrument C · D3 diff+decide | [x] |
| [batch-2](batch-2/overview.md) | X1 execute fix · X2 validate + comparison page | [x] |

## Index

- [decisions.md](decisions.md) — AD-1…AD-4
- [decision-journal.md](decision-journal.md) — appended during execution
- [diagrams/component-map.md](diagrams/component-map.md)
- [parity-baseline.json](parity-baseline.json) — pre-mission verdicts
- Batch overviews + task specs linked above.

## Session summary (2026-06-23)

**Status: COMPLETE.** Tasks 5/5 (D1, D2, D3, X1, X2).

- **Verdict (Batch 1):** per-op constant factor, **not** an iteration-count gap.
  Port vs native-C counters are byte-identical — 2108 runs the *same*
  1,591,556,868 `reorderInner` iterations as C; per-pass `mincross:` Verbose
  trace identical. The primary hypothesis (port `ncross()` runs more passes) was
  **disproven**. Full side-by-side in `findings.md`.
- **Fix (Batch 2):** byte-safe per-op optimization of `reorderFindLp` /
  `reorderFindRp` / `reorderInner` (read-once `mval`, hoisted loop-invariant,
  allocation-free scratch). Commit `8d2ff15`. Test:
  `mincross-reorder-perf.test.ts`. No AD-4 write-set expansion needed.
- **Gates:** typecheck 0 · `npm test` 2334 pass (+5) · build 0 · survey
  **byte-match 312→312, structural 256→256, 0/796 changed verdicts** · 2108 SVG
  byte-identical before/after (direct `cmp`).
- **Timing (bundle, best-of-2):** 2108 83.6→72.3 s (−13.6%), b100 37.7→30.1 s
  (−20%), 1718 30.6→24.6 s (−20%), b104 33.2→29.9 s (−10%).
- **Decisions:** Used `dot -v` for C's pass trace (no recompile) + a rebuilt
  instrumented plugin for inner counters; reverted both. The ≤3× / under-20 s
  target was contingent on an iteration-count gap (README success bar) and is
  therefore N/A — 2108 remains >20 s because the reorder is a faithful O(W²) over
  a ~3700-node-wide rank, closable only by a forbidden algorithm change.
- **Known follow-up:** none actionable within the faithfulness contract. A future
  representation change (flat per-rank `mval`/order arrays kept in sync through
  `exchange`) could cut per-op cost further but is larger and riskier; not done.
- **Merge:** branch `feature/mincross-perf-derisk` left unmerged — awaiting the
  human's go-ahead for the merge-commit to `main`.

## Repro recipes

```bash
# Time 2108 (port, production bundle)
npm run build:js
node -e 'import("./dist/index.js").then(m=>{const fs=require("fs");\
  const t=Date.now();m.renderSvg(fs.readFileSync(process.argv[1],"utf8"),"dot");\
  console.error(Date.now()-t+"ms")})' ~/git/graphviz/tests/2108.dot

# Native oracle time
dot -Tsvg ~/git/graphviz/tests/2108.dot >/dev/null

# Profile (confirms mincross dominance)
node --prof <harness> 2108.dot && node --prof-process isolate-*.log
```
