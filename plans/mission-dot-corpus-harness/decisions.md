# Architecture Decisions — dot-corpus-harness (locked)

Treat each as locked. If a conflicting constraint surfaces, STOP and log it to
`decision-journal.md` — do not silently override.

## AD-1 — Survey is SEPARATE from the curated golden gate

The harness must NOT modify `test/golden/manifest.json` or
`test/golden/suite.test.ts`, and must NOT add corpus inputs to them. Those are a
curated must-pass gate (128 cases). The survey is a differential **report**:
divergences are expected data, not test failures.

- Reuse `test/golden/compare.ts` (`compareSvg`) and `normalize.ts` read-only.
- All new code under `test/corpus/`.
- Consequence: a known divergence never turns the CI suite red.

## AD-2 — Subprocess isolation + timeout per render

The port has no CLI and can hang (synchronous infinite loops, unkillable
in-process). Each port render runs in a spawned subprocess (`npx tsx
test/corpus/render-one.ts <input> <engine>` or equivalent) with a wall-clock
timeout; the survey kills and records the verdict.

- Classify: clean SVG → compared; thrown error → `errored` (+ message);
  timeout/kill → `timeout`; nonzero non-throw exit → `errored`.
- The survey itself must never crash or hang on a bad input — it records and
  moves on.
- Oracle (`dot`) runs are also spawned with a timeout (defensive).

## AD-3 — Generate oracle refs on-demand; do NOT commit ~800 SVGs

Oracle SVGs are produced by the local native binary into a **gitignored** cache
(default a `/tmp` path), reused across runs if present. Committed artifacts are
only: `corpus-manifest.json` (classification), `parity.json` (verdicts),
`PARITY.md` (dashboard), and the harness code. Corpus root and cache dir are
configurable (arg/env), defaulting to `~/git/graphviz/tests` and a `/tmp` cache.

- Why: committing ~800 reference SVGs bloats the repo (the catalog notes refs
  dominate the graphviz tree's line count) and pins refs to one platform.
- Reproducible by anyone with the C tree built locally — same assumption the
  existing `.probes/route-corpus.ts` already makes.

## AD-4 — dot-first; force engines enumerated-but-deferred

Survey only dot-targetable inputs (default engine, no `layout=` override) this
mission. Inputs that select another engine, or are engine-specific, are
classified `quarantined: engine-deferred` in `corpus-manifest.json` and NOT
surveyed. A follow-on mission extends the same harness to force engines (the
`iterative` tolerance class already exists in `compare.ts`).

## AD-5 — Do NOT fix divergences (scope guard)

The mission builds the harness, runs it, and triages the output. It does **not**
modify any `src/` layout/render code to close a divergence. If a root cause is
obvious, record it as a backlog entry in the triage — do not fix it here. A fix
is a separate, oracle-pinned mission.

## Quarantine taxonomy (CLAUDE.md comparison-page requirement)

Every non-surveyed input must carry an explicit reason in `corpus-manifest.json`.
Allowed quarantine reasons:

- `engine-deferred` — selects/targets a non-dot engine (AD-4).
- `gvpr` — gvpr script / graph-stream transform (out of scope, catalog non-goal).
- `multi-graph` — file defines multiple graphs (CLI multi-doc concern).
- `include` / `non-graph` — `#include`, shape files, or not a DOT graph.
- `raster-only-ref` — only meaningful against a raster format we don't emit.
- `parse-unsupported` — input the peggy parser legitimately cannot accept
  (record the message; candidate for a parser-gap backlog entry, not a silent
  drop).
- `malformed` — input that parses AND renders, but whose reference geometry is
  degenerate, so parity comparison carries no spec signal (e.g. fuzzer input
  where native dot itself emits HTML parse errors and a multi-million-pt canvas
  from a nonsense attribute). Force-quarantined per-file via `MANUAL_QUARANTINE`
  in `enumerate.ts` after a recorded human triage decision — never an automated
  structural heuristic, since the input is structurally a valid DOT graph.

## Rollback classification

**Reversible** — additive dev/test infra under `test/corpus/`; revert the merge
commit. No data model, schema, API, or library-surface change.
