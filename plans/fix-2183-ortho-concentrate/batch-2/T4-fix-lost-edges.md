<!-- SPDX-License-Identifier: EPL-2.0 -->
# T4 — Faithful fix: lost edges

## Context
Mechanism from T1 (.agent-notes/2183-lost-edges.md). Provisional locus:
ortho-adapter.ts buildEdges concentrate dedup.

## Task
Mirror C behavior at the origin (conc.c / lib/ortho ref per T1). Add a
regression test colocated with the fixed file asserting 2183's edge
retention (or a minimal repro distilled from it).

## Acceptance criteria
- Given 2183, when rendered, then 21 edge groups incl. a->b and o->r.
- Given the 2361 dedup goldens + ortho tests, when `npx vitest run` runs,
  then green.
- Given the fix, then it cites the C ref in a @see comment.

## Observability / Rollback
N/A — library layout code. Reversible.

## Commit
`fix(T4): <mechanism> — 2183 lost edges`
