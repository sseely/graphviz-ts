<!-- SPDX-License-Identifier: EPL-2.0 -->

# Dot corpus parity survey

A **differential parity survey** over the real graphviz **dot** test corpus.
It renders every dot-targetable input through the native `dot` oracle and
through graphviz-ts, diffs the two SVGs, and reports a parity dashboard plus a
triaged divergence backlog.

This is a **report, not a gate**. Hundreds of inputs legitimately diverge — that
is the data. It is intentionally **separate** from the curated must-pass golden
suite (`test/golden/suite.test.ts`): the survey never adds inputs to, or turns
red, that suite (mission decision AD-1). All survey code is Node-only under
`test/corpus/` and is never imported by `src/index.ts`.

> Mission brief: `plans/mission-dot-corpus-harness/`.

## Pipeline

| Stage | Script | Output |
|-------|--------|--------|
| T1 enumerate + classify | `enumerate.ts` | `corpus-manifest.json` |
| T2 **rules survey** (headless oracle vs port `EstimateTextMeasurer`) | `survey.ts` (+ `render-one.ts`) | `parity-rules.json` |
| T2-gate no-regression check | `rules-gate.ts` | exit 0/1 |
| T3 dashboard + triage | `dashboard.ts` | `PARITY.md` |

```
enumerate.ts ──▶ corpus-manifest.json ──▶ survey.ts ──▶ parity-rules.json ──▶ dashboard.ts ──▶ PARITY.md
```

The **rules survey** is the canonical layout survey (mission `fix-xcoord-position`,
ADR-3). It diffs the port (default `EstimateTextMeasurer`) against native `dot`
run **headless** (core + dot_layout plugins only → `estimate_textspan_size`), so
it is deterministic and font-stack-independent on every platform. The older pango
baseline (port `LutTextMeasurer` vs native dot + pango) is **retired**: its
incidental kerning/charset coverage now lives in the Batch-2 measurement tests
(`src/common/textmeasure.bundled-font.test.ts`). It stays runnable as
`survey:baseline` for diagnosis only — see `rules-known-divergences.md`.

## Running it

```sh
# T1 — classify every .gv/.dot under the corpus root, write corpus-manifest.json
npx tsx test/corpus/enumerate.ts [corpusRoot]

# T2 — build the headless oracle GVBINDIR, then render + diff every applicable
#      input against it, writing parity-rules.json (the primary survey)
npm run survey

# T2-gate — fail if any graph REGRESSES vs the retired pango baseline
npm run survey:gate

# T3 — render the parity report into the PARITY.md dashboard
npm run survey:dashboard

# Legacy pango baseline (port LutTextMeasurer vs native dot + pango); diagnosis only
npm run survey:baseline
```

## Performance dashboard (speed, peer to parity)

PARITY tracks *correctness*; **PERF** tracks *speed* — warm in-process
`renderSvg()` time vs native `dot`, against the **≤3× native** fidelity target.
Unlike the survey (one cold `tsx` subprocess per render), the bench loads the
shipped **bundle** once in a pool of resident, JIT-primed worker threads and
times the pure render, so the numbers reflect the warm steady state a long-lived
consumer (e.g. plantuml-js) actually sees.

| Stage | Script | Output |
|-------|--------|--------|
| P1 bench (warm port vs native) | `bench.mjs` (+ `bench-worker.mjs`) | `perf.json` |
| P2 perf dashboard | `perf-dashboard.mjs` | `PERF.md` |

```sh
npm run build:js                       # bench times the dist bundle
node test/corpus/bench.mjs             # warm pool of floor(cpus/2) workers
node test/corpus/perf-dashboard.mjs    # render perf.json -> PERF.md
```

Light graphs run at the full pool; heavy graphs (native > 2s) are timed serially
by default for contention-free numbers (concurrent big renders inflate the single
sample materially). Set `BENCH_HEAVY_POOL>1` for a faster, noisier scan. A
per-render cap (`BENCH_CAP_MS`, default 180s) SIGKILLs a true hang.
Env: `BENCH_POOL`, `BENCH_CAP_MS`, `BENCH_IDS`, `BENCH_LIMIT`, `BENCH_HEAVY_MS`,
`BENCH_HEAVY_POOL`, `BENCH_BUDGET_MULT`.

### Configuration (env / argv)

| Variable | Default | Meaning |
|----------|---------|---------|
| `CORPUS_ROOT` (or `enumerate.ts` argv[1]) | `~/git/graphviz/tests` | Corpus input tree to walk. |
| `DOT_BIN` | `~/git/graphviz/build/cmd/dot/dot` | Native oracle binary (15.0.0). |
| `GVBINDIR` | `/tmp/gvplugins` | Oracle plugin dir. |
| `ORACLE_CACHE` | a `/tmp` dir | Gitignored cache of oracle SVGs (AD-3). |
| `RENDER_TIMEOUT_MULT` | 3 | Port budget = `max(MULT × native, FLOOR)`. |
| `RENDER_TIMEOUT_FLOOR_MS` | 180000 | Lower bound on the port budget (3 min). |
| `ORACLE_TIMEOUT_MS` | 300000 | Oracle cap — generous so slow-but-valid natives finish. |

The port's budget is **`max(3× native, 3 min)`**, not a flat wall clock: a graph
that is merely slow-but-valid (e.g. 2108 renders in ~70s, native ~12s) is *not* a
timeout. Native time is read from the canonical `native-timings.json` when present
(see the perf section) so the budget is stable run-to-run.

Oracle reference SVGs are generated on demand by the local native binary into a
**gitignored** cache and reused across runs. They are **never committed** — only
the manifest, `parity.json`, `PARITY.md`, and the harness code are (AD-3).

## Classification (T1)

`enumerate.ts` walks the corpus root, collects every `*.gv` / `*.dot` file, and
classifies each with cheap structural checks (no rendering — that is T2):

- **applicable** — a single default-engine DOT graph; the survey renders it.
- **quarantined** — recorded with an explicit `reason`, **not** surveyed this
  mission:

| reason | meaning |
|--------|---------|
| `engine-deferred` | selects a non-dot engine via `layout=neato\|fdp\|sfdp\|circo\|twopi\|osage\|patchwork` (dot-first scope, AD-4). A follow-on mission extends the harness to force engines. |
| `multi-graph` | file defines more than one top-level graph (a CLI multi-document concern). |
| `gvpr` | gvpr script / graph-stream transform (out of scope). |
| `include` / `non-graph` | `#include`, shape file, or not a DOT graph. |
| `raster-only-ref` | only meaningful against a raster format the port does not emit. |
| `parse-unsupported` | the parser legitimately rejects the input (usually surfaced by T2 as `errored`; feeds the parser-gap backlog). |

### Current totals

Run `npx tsx test/corpus/enumerate.ts` to regenerate. As of the last run over
`~/git/graphviz/tests` (corpus 805 files):

- **applicable: 796**
- quarantined: `engine-deferred` 6, `multi-graph` 3

## Verdicts (T2)

Each applicable input gets one verdict in `parity.json`:

| verdict | meaning |
|---------|---------|
| `byte-match` | port SVG matches oracle within the `deterministic` tolerance (0.01). |
| `structural-match` | same element tree; only numeric coordinate diffs above tolerance. |
| `diverged` | a structural difference (missing/extra node, wrong tag, text mismatch). |
| `errored` | the port threw (e.g. unported attribute, parser gap) — message captured. |
| `timeout` | non-erroring, but ran past `max(3× native, 3 min)` — a true runaway, not merely slow. |
| `oracle-error` | the native oracle failed to render — excluded from port scoring. |

The survey isolates every port render in a **spawned subprocess with a timeout**
(AD-2): the port has no CLI and some inputs trigger synchronous infinite loops
that cannot be interrupted in-process. One bad input can never abort the survey
— it is recorded and the survey continues, exiting 0 even when inputs diverge
(divergence is data; only a harness fault — missing oracle, unreadable manifest
— exits nonzero).
