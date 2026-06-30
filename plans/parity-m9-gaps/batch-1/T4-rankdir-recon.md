# T4 — rankdir recon: locate the port's existing TB translation

## Context

graphviz-ts port. C's lib/common/postproc.c gv_postprocess translates
ALL layouts (rankdir=TB included: rotation 0°, offset = bb.LL) — yet
the port passes 57 goldens with NO postprocess pass. Therefore an
equivalent TB-case translation exists somewhere in the port (suspects:
src/render/ or src/common/emit*, viewBox computation, or a per-engine
translate). T6 (batch 2) will port gv_postprocess and needs to know
exactly what to replace (AD2: prefer faithful replacement; hard gate =
conformant port output for existing goldens).

## Task

READ-ONLY recon. Find where the port currently normalizes/translates
coordinates for SVG emission: the mechanism (which function, what
offset math, where bb comes from), every engine that flows through it,
and whether it is equivalent to C's TB case of map_point/
translate_drawing (rotation 0). Then recommend per AD2: can the ported
gv_postprocess cleanly REPLACE it (option A), or must it be applied
conditionally for rankdir ≠ TB (option B)? Identify exactly which code
would be deleted/bypassed under option A.

Write findings to .agent-notes/rankdir-tb-translation-2026-06.md using
the observation format (Context/Finding/Impact/Confidence), including
file:line cites and the A-vs-B recommendation with rationale.

## Write-set

.agent-notes/rankdir-tb-translation-2026-06.md ONLY (no source changes)

## Read-set

~/git/graphviz/lib/common/postproc.c:90-180, 599-693 (what TB-case
equivalence means); src/render/**; src/common/emit*.ts; src/gvc/**;
src/layout/dot/index.ts (pipeline end); test/golden/compare.ts (how
SVG numbers are compared)

## Interface contract (consumed by T6)

The notes file: existing-translation mechanism (file:line), engines
affected, option A/B recommendation, list of code to delete/bypass
under A.

## Acceptance criteria

- Given the notes file, when T6 starts, then it can locate the
  existing translation without re-searching (file:line precision)
- Given the recommendation, then it cites concrete evidence for A or B

## Observability: N/A. Rollback: N/A (no source changes).

## Quality bar

No source/test changes; gates trivially pass. Commit:
`docs(T4): recon notes — port's existing TB coordinate translation`
