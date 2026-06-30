<!-- SPDX-License-Identifier: EPL-2.0 -->

# Mission: dot hangs & crashes

## Objective

Eliminate the `timeout` (7) and `errored` (5) verdicts in the dot parity
survey. The hangs are **not infinite loops** — they are per-operation cost in
the network-simplex hot path plus one V8 stack overflow on deep recursion. The
fixes are **conformant internal refactors** that make the port *more*
faithful to C (C uses a flat value-struct DFS stack and a larger native stack).
The crashes are fuzzer-corrupted inputs the strict peggy parser rejects.

**Success bar:** each rescued `timeout` case renders **within ~3× native dot**
(hard floor: under the 20s survey budget so it flips out of `timeout`); 2108
renders without `--stack-size`; **zero parity regressions**; output unchanged.

## Branch

`feature/dot-hangs-crashes` (merge commit to main — preserves per-task IDs).

## Key findings (from investigation, 2026-06-23)

- Survey renders **every input with engine `dot`** and a **20s** timeout
  (`RENDER_TIMEOUT_MS`, default 20000). Oracle also uses `dot`.
- Profiling 2471: `dfsRange` = **40% total / 67% non-library** time. It runs
  **384M frame-steps** (59,861 calls). C runs the identical 384M steps in 0.5s
  via a flat `LIST(dfs_state_t)`; the port heap-allocates a `{v,par,lim,toI,tiI}`
  object **per frame** → ~55× per-frame overhead.
- 2108 throws **"Maximum call stack size exceeded"**; `--stack-size=2000` makes
  it render → pure recursion-depth issue (`rerank` recurses O(V); V8 ~1MB stack,
  C ~8MB). Must be iterative for browser safety.
- The 5 `errored` cases are fuzzer garbage (mojibake bytes). Native's lenient
  yacc recovers; peggy is strict. Low yield — fix only a clean common pattern.

### Native vs port timings (target = within ~3× native)

| id | native | port now | cause |
|---|--:|--:|---|
| 2471 | 0.5s | 29s | dfsRange (384M frames) |
| 2475_2 | 5s | 24s | dfsRange (53M) + 6MB SVG |
| graphs-b100 / b104 | 9.9s | ~36s | dfsRange |
| 1718 | 13.7s | 29s | dfsRange (415M); heavy for native too |
| 2108 | 14s | **crash** | rerank recursion + perf |
| 2222 | — | 16s* | borderline; survey overhead tips past 20s |

\* standalone bundle time; survey + tsx startup pushes it over 20s.

## Constraints

**Stop and ask the human when:**
- Any conformant or structural-match count **drops** in the survey (regression).
- A "fix" changes emitted SVG for any currently-passing case.
- 2108 still overflows after every O(V) recursion in the dot path is iterative
  (signals a missed recursion — find it; do **not** mask with `--stack-size`).
- Two consecutive validation-gate failures on the same check.
- A perf change would require altering the *algorithm* or iteration count
  (forbidden — only the representation/per-op cost may change).

**Push forward with judgment on:**
- Frame-representation choice (parallel arrays vs typed-array pool).
- Which accessor reads to inline in hot loops.
- Comparison-page formatting.
- Whether T3 (mincross) is needed (decide from T1's measured timings).

## Quality gates (run between every batch)

| command | pass | on_fail |
|---|---|---|
| `npm run typecheck` | exit 0 | fix_and_rerun |
| `npm test` | exit 0 | fix_and_rerun |
| `npm run build:js` | exit 0 | fix_and_rerun |
| `npx tsx test/corpus/survey.ts` | **0 regressions** vs pre-mission parity.json | stop |

Regression check: compare `test/corpus/parity.json` conformant + structural
counts before vs after. They must never decrease. See `decisions.md#AD-4`.

## Batches

| Batch | Tasks | Status |
|---|---|---|
| [batch-1](batch-1/overview.md) | T1 NS hot-path · T4 parser recovery | [x] |
| [batch-2](batch-2/overview.md) | T2 recursion→iterative · T3 mincross (cond.) | [x] |
| [batch-3](batch-3/overview.md) | T5 validation + dashboard | [x] |

## Mission summary (2026-06-23)

**Outcome: correctness + browser-safety goals met; the <20 s perf goal not met
for the 7 timeout cases (premise revised mid-mission).**

Commits on `feature/dot-hangs-crashes`:
- `8c7c1e8` `perf(ns)` — flat SoA `dfsRange` stack + iterative `rerank` (T1, AD-1/2/3)
- `27463a0` `perf(model)` — NodeInfo shape-stabilization, the real perf lever (T1)
- `88ff118` `fix(acyclic)` — iterative back-edge DFS, browser-safe deep chains (T2)

What shipped:
- **2108 renders at the default V8 stack** (was a stack overflow) and a synthetic
  **50k-node path renders** without overflow — browser-safe. ✓
- **NodeInfo shape-stabilization**: 2471 27.5 s → 18.1 s in `dist` (~1.5×),
  **conformant**. Benefits every layout path and production consumers.
- **Zero parity regressions**: final survey byte 312 / struct 256 / timeout 7,
  **0 changed verdicts** vs baseline; output unchanged. ✓
- **T4**: 5 `errored` cases triaged → fuzzer corruption, won't-fix (no code change).

What did NOT happen (documented in `comparisons/timeout-cases.md`):
- **AD-1's allocation premise was falsified by profiling** (GC 0.3%; `dfsRange`
  still 47% after the SoA change; 386M steps identical to C). The bottleneck was
  slow-mode `n.info` access, fixed by shape-stab — but the residual is
  constant-factor JS-vs-C overhead on the *same* step count.
- **timeout stays 7.** The conformant wins are real but don't cross the 20 s
  **survey** budget, which is measured against the slower `tsx` harness; some
  cases (2222/2475_2/2108) are SVG-emission-bound, a separate subsystem.
- **T3 (mincross) skipped** — ~12% of 2471; cannot bridge the gap (human chose
  "document rest" over deeper optimization).

Follow-on (own missions): NS-local typed-array `ND_*` mirror for full per-op
parity; SVG-emission perf for the 6–23 MB outputs.

## Index

- [decisions.md](decisions.md) — AD-1…AD-5
- [decision-journal.md](decision-journal.md) — appended during execution
- [diagrams/component-map.md](diagrams/component-map.md)
- [diagrams/data-flow.md](diagrams/data-flow.md)
- Batch overviews + task specs linked in the table above.

## Repro recipes

```bash
# Time a case (port), generous cap
timeout 300 npx tsx test/corpus/render-one.ts \
  /Users/scottseely/git/graphviz/tests/2471.dot dot >/tmp/out.svg

# Native oracle time
dot -Tsvg /Users/scottseely/git/graphviz/tests/2471.dot >/dev/null

# 2108 stack-overflow repro (default stack throws; large stack renders)
npm run build:js
node            dist-harness 2108   # throws "Maximum call stack size exceeded"
node --stack-size=2000 dist-harness 2108   # renders ok  → confirms depth
# (dist-harness = a 3-line ESM that imports dist/index.js renderSvg; see T1/T2)
```
