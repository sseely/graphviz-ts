# T9 — end-to-end C-oracle verification + gap-fill (conditional)

## Context

graphviz-ts port; C at ~/git/graphviz/lib (15.0.0) is the spec;
installed dot is 15.0.0. Hook rule: smallest fix, ≤2 attempts per
file, then move on. M11 T5 is the precedent for this task shape.

Batches 1–3 landed full html-label machinery. This task is the AD5
checkpoint: the 0.4pt divergence on the node-html path was
hypothesized to be downstream of the font-flag bug (regular-vs-bold
measurement). If the hypothesis holds, html output now matches C at
deterministic (0.01) tolerance.

## Task

1. Probe each case end-to-end vs `dot -Tsvg` with
   test/golden/compare.ts compareSvg at 'deterministic'
   (.probes/m11-combined-check.ts is the reusable pattern):
   - per-slot: node html main label, node html xlabel, edge html
     label / xlabel / headlabel / taillabel, graph html label,
     cluster html label
   - feature cases: nested fonts `<b><i><font color point-size>`,
     table styling (BGCOLOR solid, SIDES, RULES, HR/VR), anchor
     (HREF), IMG-missing (no ImageSizer vs C nonexistent file)
2. For each divergence, localize. Inside the mission blast-radius
   table (README write-sets union) → port the gap faithfully (@see
   cites, journal entry; conditional write-set). Outside → STOP per
   mission stop conditions.
3. AD5 rule: residual divergence tracing to the metric model itself
   (LUT vs FreeType widths with flags correct) → STOP; the tolerance
   call is Scott's. FMA rule applies (M7).
4. SVG element ORDER matters (cgraph head-seq iteration,
   .agent-notes/fdp-fma-oracle-2026-06.md).

## Write-set (conditional — only what divergences require)

Files in the mission blast-radius table only (batch 1–3 write-sets);
co-located tests for anything ported; .probes/* (untracked). Anything
else: STOP and report.

## Read-set

test/golden/compare.ts; .probes/m11-combined-check.ts (pattern);
divergence-dependent C files per localization.

## Interface contract

Per-case PASS/divergence report consumed by the orchestrator for T10
golden selection. T10 mints ONLY cases T9 passed.

## Acceptance criteria

- Given all per-slot + feature probes, then a per-case PASS/FAIL
  table with first-diff detail for any FAIL
- Given a ported gap, then @see cites + its own tests
- Given the suite + 72 goldens, then 0 failed / conformant

## Observability / rollback

N/A — library; gates are the SLI. Reversible (commit only if code
changed; pure-PASS = report only).

## Quality bar

npx tsc --noEmit clean; npx vitest run 0 failed. Commit (orchestrator,
only if files changed): `fix(T9): port html emission gaps found by
C-oracle verification`
