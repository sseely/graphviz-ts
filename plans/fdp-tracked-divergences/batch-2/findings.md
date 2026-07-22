# Batch 2 findings — B2 force-drift → A1 (SKIPPED, bucket EMPTY)

**Batch skipped.** T0.2's fresh attribution (against the restored oracle) put
every force-drift id — the unix genealogy family (unix, lsunix1-3, size,
unix2/2k, weight, crazy) and all other large multi-kind residuals — in the
**142 drift-exonerated** set. None appear in the 4 not-cleared ids
(graphs-fdp, graphs-b145, 241_0, 2095). The July-17 attribution that suggested a
tracked force-drift bucket was an artifact of the broken oracle (0 dump lines
for `-Kfdp`).

Per the mission's push-forward rule ("a bucket empties after Batch 0's fresh
attribution → skip it, log why"), no per-id work is required. fdp force-drift is
covered by the computed **A1-drift class** (membership derived from
`attribution-fdp.json`, not enumerated), exactly as for sfdp/neato.

## T2.1 confirmation

The 142 drift-exonerated ids each injected to `injectedDiffs === 0` (force
layout differs, but the oracle's exact node positions collapse the divergence).
Spot-checked representative unix-family members are in that set. No id in this
bucket survived injection, so none escalates to B1/B3.

Batch 2: **no code changes, no registry entries** (A1 membership is computed).
