# T2 — Isolated render worker + survey runner

## Context

Same mission context as [T1-enumerate.md](T1-enumerate.md). T1 produced
`corpus-manifest.json` (applicable dot inputs). T2 builds the survey that renders
each applicable input through the native oracle and the port, diffs them, and
emits `parity.json`.

**The port can hang** (synchronous infinite loops, unkillable in-process) and
can throw on unported attributes. Every port render MUST run in a spawned
subprocess with a timeout (decisions.md AD-2). The survey records and continues;
it never crashes or hangs on a bad input.

## Task

1. `render-one.ts` — a tiny worker: read one input file + engine from argv,
   `renderSvg(source, engine)`, write the SVG to stdout. On throw, print the
   error to stderr and exit nonzero. This is the isolation unit.
2. `survey.ts` — the runner:
   - Read `corpus-manifest.json`; take `status == "applicable"`.
   - For each input:
     - **Oracle:** spawn `~/git/graphviz/build/cmd/dot/dot -Tsvg <input>`
       (`GVBINDIR=/tmp/gvplugins`, timeout). Cache the SVG under a gitignored
       dir (AD-3); reuse if present. Oracle failure → verdict `oracle-error`.
     - **Port:** spawn `npx tsx test/corpus/render-one.ts <input> dot` with a
       wall-clock timeout; kill on overrun. Throw → `errored` (capture stderr
       first line); timeout/kill → `timeout`.
     - **Diff** (both rendered): `compareSvg(portSvg, oracleSvg, "deterministic")`
       — pass → `byte-match`. If it fails, re-classify: all diffs numeric (no
       missing/extra node) → `structural-match`; any structural diff → `diverged`
       (record the worst `delta` and the first structural path).
   - Emit `parity.json`: `{ generatedWith, oracleVersion, total, counts:{...},
     results:[{ id, path, verdict, maxDelta?, firstDiffPath?, errMsg? }] }`.
   - Concurrency: run inputs with a bounded worker pool (e.g. 4–8) so the survey
     finishes in reasonable wall-clock; the cap is a constant.
   - Exit 0 even when inputs diverge/err (divergence is data); exit nonzero only
     on a harness fault (can't read the manifest, oracle binary missing).
3. If T2 discovers inputs that the parser legitimately rejects, record verdict
   `errored` with the parse message — do NOT modify the parser (AD-5); these
   feed T3's backlog.

## Write-set

- `test/corpus/render-one.ts` (Create)
- `test/corpus/survey.ts` (Create)
- (Generated, gitignored cache + `test/corpus/parity.json` committed by T3's run;
  T2 may write an initial `parity.json` — it is the survey output, fine to
  commit.)

## Read-set

- `test/corpus/corpus-manifest.json` (T1 output).
- `test/golden/compare.ts` (`compareSvg`, the `Diff` shape — `delta` vs
  structural), `test/golden/normalize.ts` (read-only reuse).
- `.probes/route-corpus.ts` — existing 25-case pattern (oracle spawn + parse +
  classify) to mirror; T2 generalizes + hardens it (file corpus, subprocess
  isolation, timeout).
- `../decisions.md` (AD-2 isolation, AD-3 cache, AD-5 no-fix).

## Interface contract (consumed by T3)

```jsonc
// parity.json
{ "oracleVersion": "dot 15.0.0", "total": 240,
  "counts": { "byte-match": 0, "structural-match": 0, "diverged": 0,
              "errored": 0, "timeout": 0, "oracle-error": 0 },
  "results": [ { "id": "graphs-abstract", "path": "graphs/abstract.gv",
                 "verdict": "byte-match" },
               { "id": "graphs-unix", "path": "graphs/unix.gv",
                 "verdict": "diverged", "maxDelta": 3.4,
                 "firstDiffPath": "svg/g[12]/path/@d" } ] }
```

## Acceptance criteria (Given/When/Then)

- **Given** an input that hangs the port, **when** surveyed, **then** the runner
  kills it after the timeout, records `timeout`, and continues — the survey
  still completes and exits 0.
- **Given** an input that throws (unported attr), **when** surveyed, **then**
  verdict is `errored` with the captured message; no survey crash.
- **Given** a byte-identical input, **when** surveyed, **then** verdict is
  `byte-match` (e.g. a simple digraph already in the 25-case corpus).
- **Given** the full applicable set, **when** `npx tsx test/corpus/survey.ts`
  runs, **then** it exits 0 and writes `parity.json` whose `counts` sum to
  `total`.
- **Given** the oracle binary is missing, **when** the survey runs, **then** it
  exits nonzero with a clear message (harness fault, not silent).

## Observability

N/A — dev/test infra.

## Rollback notes

Reversible — additive files under `test/corpus/`.

## Boundaries

- **Always:** isolate every port render in a subprocess with a timeout; record
  every input's verdict.
- **Never:** render the port in-process in the main survey loop; modify `src/`
  to make an input pass; commit oracle SVGs (cache is gitignored, AD-3).
- **Ask first / STOP:** if isolation proves insufficient (the runner itself
  hangs), per overview stop conditions.

## Commit

`feat(T2): subprocess-isolated dot parity survey runner`.

## Quality bar

`tsc --noEmit` 0; `vitest run` 0 failures + 128 goldens green; meta-gate
`npx tsx test/corpus/survey.ts` exits 0 + writes `parity.json`; `lizard` clean
on new files. Return only the structured result — no preamble.
