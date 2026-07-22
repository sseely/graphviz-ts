# Architecture / policy decisions (pre-made)

## ADR-1: Restore fdp injection via the documented native dump site, then rebuild
**Context:** `GVTS_POS_DUMP` emits 0 lines for `-Kfdp` today (patch is in
`spline_edges`; fdp uses `spline_edges1`). The July-17 attribution proves the
dump once worked for fdp (`2095` base 8256 → inj 52). The port comment at
`src/layout/fdp/index.ts:84-90` names the native site: `fdp_layout`, between
`fdpLayout()` and `neato_set_aspect()` (`lib/fdpgen/layout.c` ~:1062).
**Decision:** Batch 0 first confirms fdp reaches no existing dump hook, then adds
the env-gated `GVTS_POS_DUMP` at that site (dump `ND_pos` per node to stderr),
rebuilds `dot`, and verifies `GVTS_POS` fires for `-Kfdp`. Port inject is already
correct — no port harness change expected.
**Consequences:** working fdp attribution; a native rebuild (new oracle sha1).

## ADR-2: Rebuild changes the oracle sha1 but not the render — regen fdp only
**Context:** the env-gated dump is stderr-only; the xdot render is byte-identical.
**Decision:** after rebuild, regenerate `attribution-fdp.{jsonl,json}` fresh
against the new sha1. Leave the committed sfdp/neato attributions as-is (their
verdicts are render-based and unaffected); a future sfdp/neato regen will just
need `--fresh` (D4 sha1 re-stamp). This mission does NOT re-sweep sfdp/neato.
**Consequences:** minimal blast radius; a documented sha1-drift note for the
other iterative engines' attribution D4 guards.

## ADR-3: Fix aggressively; accept only on a controlled-experiment FP floor
**Context:** user chose aggressive fixing (same as the sfdp mission).
**Decision:** every non-drift bucket gets a real fix attempt. An accept is
allowed ONLY with a controlled experiment: A9 → `otool -tvV` fmadd disasm or a
native-vs-V8 libm ULP probe; A1 → injection of exact native positions collapses
the diff to 0 (drift-exonerated). Never "this is hard".
**Consequences:** any accept is defensible; higher effort on the tail.

## ADR-4: Reuse the per-engine accept registry (fdp key); finalize batch owns it
**Context:** `accepted-divergences-engines.json` already carries `A1-drift` class
entries per iterative engine and per-id A9 entries (sfdp.42/241_0/2095).
**Decision:** fdp accepts are added as an `fdp` block — an `A1-drift` class entry
(computed from `attribution-fdp.json`) plus per-id A9 entries with evidence refs.
Batch-final is the SOLE writer of the registry + `known-divergences.md` +
`PARITY*.md` (avoids multi-batch write conflicts). Batches 1-3 propose entries in
their `findings.md`.
**Consequences:** one owner for the registry; the accept test validates every
per-id accept has an evidence pointer.

## ADR-5: Every fix re-verified by a FRESH scratch-jsonl fdp sweep, 0 regressions
**Context:** the sfdp mission's postprocess fix rippled across many ids; a fix
that helps one can shift another.
**Decision:** each fix task ends with a fresh fdp engine-walk to a scratch jsonl,
verdict-diffed vs the committed baseline; 0 `pass->diverged` required. If a fix
touches a shared primitive (pack, splines, set-aspect, postproc), re-sweep every
engine that uses it. Cross-engine isolation is otherwise proven by
`git diff main --name-only -- src/`.
**Consequences:** slower per-fix; no silent regressions.

## Rollback classification
Every task is **Reversible** — pure library/test/doc artifacts, plus a native
env-gated dump line that is git-tracked in `~/git/graphviz` and render-neutral.
Roll back by reverting the task commit (and re-reverting the native dump line).
No data model, no migration, no production surface. No irreversible changes.
