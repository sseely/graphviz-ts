# T10 — A1-Drift Class Acceptances

## Context

Batch-3's rounds have converged: every diverged id across
neato/fdp/sfdp is now `fixed`, `A1-drift-exonerated`,
`irreducible-accepted`, or `named-open-mechanism`. This task formalizes
the three `A1-drift` class entries added provisionally by batch-1's T2
and documents the class for future readers, mirroring how
`docs/known-divergences.md` already documents the twopi/circo `A1` and
`A9` per-id classes.

## Task

1. Confirm (re-run, don't trust stale state) that
   `attribution-{neato,fdp,sfdp}.json` are each fresh as of the end of
   batch-3 — re-run T1's harness once more per engine if batch-3's last
   round didn't leave a current one.
2. Finalize the `A1-drift` class entries in
   `test/corpus/accepted-divergences-engines.json` (added provisionally
   in batch-1/T2) — confirm the `attributionFile` pointers and `ref`
   anchors are correct.
3. Add an `## A1-drift (iterative engines)` policy section to
   `docs/known-divergences.md`, alongside the existing `A1`/`A9`
   sections. Cover: (a) class semantics — pre-routing position
   agreement implies the divergence is downstream numerical drift, not
   a port defect; (b) the platform caveat — cross-JS-engine and
   cross-CPU floating-point variance means exact class membership can
   shift between environments, this is expected and not itself a
   regression signal; (c) how membership is enumerated — computed at
   report time from `attribution-<engine>.json`'s `verdict ===
   'drift-exonerated'` rows, per D2, never hand-maintained.
4. Regenerate all parity reports (`PARITY-neato.md`, `PARITY-fdp.md`,
   `PARITY-sfdp.md`, and the cross-engine `PARITY.md` if it aggregates
   these) and read them once to confirm the class sections render
   correctly and no 400+-row table got inlined.
5. Run the full corpus guard-test suite.

## Write-set

- `test/corpus/accepted-divergences-engines.json`
- `docs/known-divergences.md`
- generated `PARITY-*.md` pages (regenerated output, not hand-edited)

## Read-set

- `docs/known-divergences.md` — existing `A1`/`A9` section structure,
  to match tone and format for the new section.
- `test/corpus/accepted-divergences-engines.json` — the provisional
  class entries from batch-1/T2.
- `decisions.md` D2 — exact class semantics to document.
- `batch-3/overview.md` — round protocol, to confirm the loop-stop
  condition was actually met before finalizing.

## Architecture decisions

D2 (class acceptance semantics — this task's `docs/known-divergences.md`
section is the canonical prose home for D2; the ADR itself stays in
`decisions.md`).

## Interface contracts

No new interfaces — this task finalizes and documents artifacts T1/T2
already defined.

## Acceptance criteria

- `docs/known-divergences.md`'s A1-drift section documents class
  semantics, the platform caveat, and the enumeration mechanism.
- All parity reports regenerate clean (no stale data, no broken links
  to `attribution-<engine>.json`).
- Corpus guard tests green against the finalized class entries.

## Quality bar

`npx tsc --noEmit` clean. `npx vitest run` green. Manual read-through
of the three regenerated `PARITY-*.md` pages.

## Observability

N/A — documentation and report-generation task, no new observable
runtime operations.

## Rollback

Reversible — `git revert`; no migrations.
