# Architecture Decisions

Confirmed with the user during planning (2026-06-21).

## ADR-1: Triage is read-only and oracle-pinned

**Context:** Fix write-sets are unknown until each case's root cause is known.
**Decision:** Batch 1 renders each case through the port (`renderSvg`) and the
native oracle (`dot -Tsvg`), captures the concrete first-diff, classifies the
root cause, and tags simple/deep — writing a triage doc per bucket. No `src/`
changes in Batch 1.
**Consequences:** Triage parallelizes safely (read-only); Batch 2 reads the
triage docs to assign fix write-sets.

## ADR-2: Fixes grouped by shared root cause, one commit per group

**Decision:** Cases sharing a root cause are fixed together as one commit (e.g.
all hex-case cases via one `color-resolve.ts` change). Batch 2 runs sequentially
so the shared golden `manifest.json` / `suite.test.ts` count never contends.
**Consequences:** Fewer, higher-leverage commits; no parallel write conflicts.

## ADR-3: "Simple" cutoff; deep cases deferred with a comparison page

**Decision:** Simple = localized emit/normalization/escaping/parser fix, ≤~30
lines, single module, faithful to C. Deep = needs layout/routing changes, a new
shape port, or charset/encoding infrastructure. Deep cases are NOT fixed; they
get a comparison page and a backlog note.
**Consequences:** Per CLAUDE.md, a batch with a deferred case is not complete
until that case's comparison page exists and is referenced in the journal.

## ADR-4: One golden per root-cause group

**Decision:** Each fixed root-cause group adds ONE representative case to the
golden manifest (`test/golden/`), with input + native-oracle ref. Not every
corpus case becomes a golden.
**Consequences:** The curated golden suite stays the must-pass regression guard;
the corpus survey remains the broad report (AD-1 of the corpus harness).

## ADR-5: Latin1/Symbol charset presumed deep

**Decision:** `graphs-Latin1`/`graphs-Symbol`/`share-Latin1`/`windows-Latin1`/
`graphs-russian` involve non-UTF8 input + the `charset` attribute; the survey
harness also reads files as UTF-8. Presumed **deep** — defer with a comparison
page unless triage proves a localized fix.
**Consequences:** Encoding infrastructure is a separate follow-on, not this
mission.

## ADR-6: Parity regeneration is the success metric

**Decision:** Batch 3 re-runs `survey.ts` + `dashboard.ts`; the committed
`parity.json`/`PARITY.md` conformant delta (with 0 per-id regressions) is the
measured outcome.
**Consequences:** Deterministic, oracle-grounded success criterion.

## Rollback classification

**Reversible.** Every fix is a localized code change + golden; `git revert` per
commit. No data/schema/migration. Sole regression vector: a fix that promotes
some cases but regresses others — guarded by the 0-per-id-regression gate (ADR-6)
and per-id delta judging (memory: "bucket-fix re-bucketing").
