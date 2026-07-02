<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — Diagnose the NaN 8-edge endpoint residual

## Context
`graphs/NaN.gv` family (also `share/`, `windows/` copies; `orientation=land;
ratio=compress; size="16,10"`): structural-match, maxΔ 18. All 76 node
reference points match C exactly. Residual: 8 straight edges — pairs
`Target↔TThread`, `Interp↔InterpF`, `Event↔Target`, `AtomProperties↔NRAtom` —
endpoints shift 6–14 pt, piece counts match. Doc candidates: (a) boundary
clip-point drift from spline approach angle, (b) residual port metric,
(c) compress x-simplex tie. Diagnosis mode per `~/.claude/rules/diagnosis.md`
applies: no fix proposal before a stated mechanism.

## Prior observations (read first)
- `.agent-notes/b15-per-entry-run-routing.md` — B15DUMP instrumentation
  recipe (env-gated fprintf in dotsplines.c; 8-slot name buffer gotcha;
  `make gvplugin_dot_layout`; /tmp/ghl symlinks it; revert+rebuild+byte-verify
  after). Also: compareSvg is blind past childCount mismatches — use
  per-element title comparison.
- `plans/fix-compress-xcoord/comparisons/nan-compress-xcoord.md` — the
  historical (now-stale) A2 analysis + forced-widths seam experiment shape.
- `docs/known-divergences.md` §A2 status note.

## Task
Per decisions.md#d3, C-first differential instrumentation:
1. Render port+oracle for `graphs/NaN.gv`; per-element diff to confirm the
   residual set (expect nodes 0, edges 8; re-scope if measured otherwise —
   log to journal).
2. Instrument C (`lib/dotgen/dotsplines.c` and, if clipping is implicated,
   `lib/common/splines.c`) with env-gated dumps for the affected edges:
   collected-entry flags/ports, `maximal_bbox`/pathend boxes,
   `beginpath`/`endpath` results, `clip_and_install` start/end parameters and
   final endpoint coords. Mirror the same dumps in TS. Diff line-wise.
3. Walk the divergence to the FIRST differing value; state the mechanism.
   Distinguish candidates (a)/(b)/(c) or establish a fourth with evidence.
4. If the first differing value traces to FP/libm: controlled experiment
   isolating the variable (e.g. force C's value at the TS seam and show
   exact reproduction) before classifying `irreducible`.
5. Revert C tree, rebuild plugin, byte-verify oracle output unchanged.
6. Write the mechanism artifact (below) to
   `.agent-notes/nan-edge-endpoint-diagnosis.md`; journal a summary row.

## Interface contract (consumed by T3/T5)
```
mechanism = {
  cause: string,                 // 1-2 sentences
  origin: "file:line",           // where it originates in the PORT
  causalChain: string,           // why 6-14pt endpoint shift follows
  ruledOut: string[],            // with the evidence that eliminated each
  fixLocus: string[],            // files a faithful fix must touch
  classification: "port-defect" | "irreducible"
}
```

## Write-set
`.agent-notes/nan-edge-endpoint-diagnosis.md`, `plans/fix-nan-a2-retire/
decision-journal.md`; TEMPORARY `~/git/graphviz/lib/**` (must end reverted).
No `src/**` edits in this task.

## Acceptance criteria
- Given the dumps, when diffed, then a first-divergence value is identified
  and the mechanism artifact is complete (empty `ruledOut` on a residual this
  old = not done).
- Given classification=irreducible, when claimed, then the controlled
  experiment is attached.
- Given `git -C ~/git/graphviz status`, when T2 completes, then the C tree is
  clean and the oracle render byte-matches the pre-instrumentation SVG.

## Observability / Rollback
N/A (no production surface). Reversible; C-tree revert is part of the task.

## Commit
`docs(T2): diagnose NaN edge-endpoint residual — mechanism + fix locus`
