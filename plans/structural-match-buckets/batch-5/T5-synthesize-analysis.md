<!-- SPDX-License-Identifier: EPL-2.0 -->
# T5 — synthesize the equivalence-class analysis

## Context

Batch 4 produced one `analysis/bucket-<kind>.md` per element-kind, each with a
machine-greppable sub-cluster summary table (columns: sub-cluster, ids, count,
family, tractability, ref). This task rolls them up into the mission's headline
deliverable: a ranked list of equivalence classes = candidate fix missions.

## Task

Write `analysis/README.md`:

1. **Roll-up table** across all buckets, one row per **family** (not per
   sub-cluster): `family · total cases · buckets touched · tractability ·
   representative ids · primary ref`. Sum from the Batch-4 summary tables.
2. **Ranked candidate missions** — order families by `count × tractability`
   (known-mechanism > needs-C-instrumentation > accepted-portability). For each,
   one paragraph: the mechanism (cite the `.agent-notes/`/memory anchor), the
   cases it would move to conformant, and the expected fix locus if known.
3. **Accepted / won't-chase** — families that are portability constraints
   (hypot-ULP / libm) with a note that they belong in `accepted-divergences.json`,
   not a fix mission.
4. **Coverage check** — assert the union of all bucket case-lists equals the 163
   structural-match ids in `parity.json` (list any unaccounted id). This is the
   mission's completeness gate.
5. **Link** from the mission `README.md` "Docs" section and note in the decision
   journal that the analysis index exists (satisfies the project rule: a mission
   is not complete until its comparison/analysis artifact is referenced there).

## Write-set

- `plans/structural-match-buckets/analysis/README.md`.

## Read-set

- All `analysis/bucket-*.md` (their summary tables).
- `test/corpus/parity.json` (for the coverage check).

## Interface contract

Coverage check must be explicit: `covered N / 163; unaccounted: [ids]` (empty on
success).

## Acceptance criteria

- **Given** all `bucket-*.md` exist, **when** `analysis/README.md` is written,
  **then** the roll-up family counts sum to 163 and the coverage line shows
  `unaccounted: []`.
- **Given** the ranked list, **when** reviewed, **then** each candidate mission
  cites a concrete mechanism anchor or is explicitly marked NOVEL/needs-C.
- **Given** completion, **when** the decision journal is read, **then** it links
  `analysis/README.md`.

## Observability / Rollback

N/A / reversible (docs only).

## Quality bar

Coverage `unaccounted: []`. One commit: `docs(T5): synthesize structural-match
equivalence-class analysis + ranked missions`.
