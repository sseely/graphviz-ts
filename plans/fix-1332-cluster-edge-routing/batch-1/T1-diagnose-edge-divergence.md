<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — Diagnose the 1332 5-edge routing divergence

## Context
`~/git/graphviz/tests/1332.dot` (deep nested clusters, 91 nodes, 66 emitted
clusters, 117 port edges). Verdict `diverged` at `svg/g[1][childCount]`.
Measured 2026-07-01 (per-element, title-keyed): nodes 0 differing; edges 5:
- `c4251->c4253:In0` — ONLY-IN-PORT. The oracle fails it:
  `shortest.c:333 triangulation failed` → `Pshortestpath failed` →
  `Error: lost c4251 c4253 edge` (dot exits 1, still emits full SVG).
- `c3378:Out0->c4046:In1` — piece-count 22 vs 28 coords.
- `c6428:Out0->c6753:In0` — Δ126.31.
- `c6412->c6414:In0` — Δ2.59.
- `c4256->c4258:In0` — Δ1.57.
Diagnosis mode per `~/.claude/rules/diagnosis.md`: no fix before a stated
mechanism. Presumption: one shared cluster-corridor mechanism; verify.

## Prior observations (read first, do not re-derive)
- `.agent-notes/nan-edge-endpoint-diagnosis.md` — dump recipe (env-gated
  fprintf, `make gvplugin_dot_layout`, /tmp/ghl symlinks; revert + rebuild +
  byte-verify). compareSvg is blind past childCount — per-element only.
- Memory `cl-bound-cluster-corridor-done` — cluster-boundary clamp already
  ported in `maximal_bbox`; do not assume it is absent, verify its values.
- `plans/cluster-membership-derisk/root-cause.md` — defect lineage A–D;
  membership + ranking are FIXED (nodes are 0-differing), so the residual is
  routing-phase only.
- `plans/cluster-expansion-recursion/README.md` — agDeleteFromCluster fix.

## Task
Per decisions.md#d2:
1. Render port+oracle; confirm the residual set above (re-scope + journal if
   measured otherwise). Capture the oracle SVG despite exit 1.
2. Instrument C for the 5 edges: `dotsplines.c` (collected flags/ports,
   `maximal_bbox` boxes incl. `cl_bound` clamps, beginpath/endpath,
   completeregularpath box list), `routespl.c` (the exact polygon passed to
   `Pshortestpath` per edge), `shortest.c` (triangulation failure inputs for
   c4251->c4253). Mirror the same dumps in TS (temp, reverted before
   commit). Diff line-wise; walk each edge to its FIRST differing value.
3. State the mechanism(s); coalesce shared ones. For the lost edge, decide
   `lostEdgeVerdict`: `corridor-input` (port feeds a different polygon) |
   `triangulation-behavior` (same polygon, different outcome — locate the
   diverging primitive) | `irreducible-fp` (requires the forced-polygon
   experiment: feed C's dumped polygon to TS `shortestPath` and show the
   outcome flips/holds).
4. Revert C tree, rebuild plugin, byte-verify oracle output unchanged
   (compare emitted SVG bytes; oracle exit 1 is its normal state here).
5. Write the mechanism artifact to
   `.agent-notes/1332-edge-routing-diagnosis.md`; journal a summary row.

## Interface contract (consumed by T2/T3/T5)
```
mechanism = {
  cause: string,                    // 1-2 sentences per coalesced mechanism
  origin: "file:line",              // in the PORT
  causalChain: string,
  ruledOut: string[],               // with evidence (empty = not done)
  fixLocus: string[],
  perEdge: { [edgeTitle]: mechanismRef },
  lostEdgeVerdict: "corridor-input" | "triangulation-behavior" | "irreducible-fp",
  classification: "port-defect" | "irreducible"
}
```

## Write-set
`.agent-notes/1332-edge-routing-diagnosis.md`,
`plans/fix-1332-cluster-edge-routing/decision-journal.md`;
TEMPORARY `~/git/graphviz/lib/**` and TS dumps (both must end reverted).
No production `src/**` edits.

## Acceptance criteria
- Given the dumps, when diffed, then a first-divergence value exists per
  edge and the artifact is complete (empty `ruledOut` = not done).
- Given lostEdgeVerdict=irreducible-fp, when claimed, then the
  forced-polygon experiment is attached.
- Given T1 completes, when `git -C ~/git/graphviz status` runs, then the C
  tree is clean and the oracle render byte-matches pre-instrumentation.

## Observability / Rollback
N/A (no production surface). Reversible; C-tree revert is part of the task.

## Commit
`docs(T1): diagnose 1332 cluster-edge routing residual — mechanism + fix locus`
