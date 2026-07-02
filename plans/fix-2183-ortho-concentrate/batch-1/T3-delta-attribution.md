<!-- SPDX-License-Identifier: EPL-2.0 -->
# T3 — Attribute the numeric deltas (maxΔ 248)

## Context
Shared elements differ numerically. Deltas may be downstream of the T1/T2
structural gaps (lost edges change the maze; labels change cluster bbox),
independent defects, or the documented ortho corridor tie-break class.

## Task
Using T1/T2 mechanisms, class every delta: (a) expected-downstream — will
be re-measured after Batch 2; (b) independent defect — becomes a new
gated finding (ask before expanding scope); (c) maze tie-break — ONLY
with equal-cost evidence per D3 (show the two route costs).

## Depends on: T1, T2.

## Acceptance criteria
- Given the classification, then every delta bucket has evidence, and
  bucket (c) shows equal costs, not assertion.

## Observability / Rollback
N/A. Reversible. Journal-only output (part of the gate report).

## Commit
folded into the gate report commit if no standalone artifact.
