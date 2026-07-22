# Architecture / policy decisions (pre-made)

## ADR-1: Mission 0 regenerates attribution over ALL 234 diverged, not just the 50
**Context:** the tracked/accepted split is computed from
`attribution-sfdp.jsonl` drift-exonerated verdicts, dated 2026-07-14 —
pre-`bagInsert` and pre other session fixes. Some drift-exonerated may have
become not-cleared and vice versa.
**Decision:** re-run the injection-attribution harness over the full current
234-diverged set so both directions of reclassification are captured; the 3
pgram `harness-error` entries are expected to resolve (the space-named-node
parser bug is fixed, [[injection-parser-space-named-blindspot]]).
**Consequences:** authoritative fresh split; the 50 likely shrinks; costs one
full injection pass (native POS_DUMP already applied — no rebuild).

## ADR-2: Fix aggressively; accept only on a controlled-experiment FP floor
**Context:** user chose aggressive fixing over accept-first.
**Decision:** every surviving bucket gets a real fix attempt (fma / robust
predicate / RTree-structure / bb-computation), following `diagnosis.md` (state
mechanism at `file:line` before any change). An accept-registry entry is
allowed ONLY with a controlled experiment isolating the platform-FP variable
(e.g. `otool -tvV` disassembly showing fmadd, or a native-vs-V8 libm ULP
probe) — never "this is hard / good enough".
**Consequences:** higher effort, but any irreducible accept is defensible.

## ADR-3: Representative-driven analysis, verdict applied to all platform copies
**Context:** unix/crazy/b106/pgram/trapeziumlr each appear as
graphs-/share-/windows-/linux.i386-/nshare- copies of one byte-identical input.
**Decision:** analyze one representative per family; a fix or accept verdict
applies to every copy (they share the input, so the mechanism is identical).
Verify by re-sweep, not by re-analysis.
**Consequences:** ~50 ids collapse to ~20 distinct inputs to investigate.

## ADR-4: Accept-registry mechanism for not-cleared FP-ties (new class)
**Context:** the current A1 class = drift-exonerated only (attribution-driven,
`accepted-divergences-engines.test.ts`). A proven-irreducible id that injection
does NOT clear (e.g. a CDT incircle tie, a floor-boundary-rect amplification)
has no home.
**Decision:** extend the per-engine accept registry with explicit id-keyed
entries carrying a `class` (A9 FP-tie, A-fill scaling, A-rtree lossy) and an
`evidence` pointer to the controlled experiment. Batch 6 is the SOLE writer of
the registry file (avoids multi-batch write conflicts); Batches 1-5 propose
entries in their own `findings.md`.
**Consequences:** one owner for the registry; the accept test validates that
every accepted id has an evidence pointer.

## ADR-5: Every fix re-verified by a FRESH scratch-jsonl sweep, 0 regressions
**Context:** the xlabel/edge changes ripple through the lossy RTree; a fix that
helps one id can shift another (this session: bagInsert +4/0-regr only after a
full 7-engine sweep).
**Decision:** each fix task ends with a fresh sfdp engine-walk to a scratch
jsonl, verdict-diffed against the committed baseline; 0 `pass->diverged`
required to keep the fix. Cross-engine sweep deferred to Batch 6.
**Consequences:** slower per-fix, but no silent regressions.

## Rollback classification
Every task is **Reversible** — pure library port + test/doc artifacts; roll
back by reverting the task commit. No data model, no migration, no external
service, no production surface. No irreversible changes in this mission.
