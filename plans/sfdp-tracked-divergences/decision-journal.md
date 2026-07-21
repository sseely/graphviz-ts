# Decision journal — sfdp tracked divergences

Append one row per non-trivial judgment call or completed task. Include the
mechanism for every fix (per `~/.claude/rules/diagnosis.md`) and reference every
accepted divergence with its evidence pointer.

| Date | Task | Decision / Mechanism | Files | Gate result |
|------|------|----------------------|-------|-------------|
| 2026-07-21 | setup | Created `feature/sfdp-tracked-divergences`; committed brief + autonomous perms (native dot / POS_DUMP / otool). | .claude/settings.autonomous.json, plans/ | n/a |
| 2026-07-21 | T0.1 | Regenerated attribution (--fresh, oracle 8fdd1294). Tracked collapsed **57→17 not-cleared**; drift-exonerated 184→217; **harness-error 3→0** (pgram resolved, confirms space-named-node parser fix). Both attribution-sfdp.jsonl + derived .json committed (one harness run writes both). | test/corpus/attribution-sfdp.{jsonl,json} | committed f038ab0 |
| 2026-07-21 | T0.2 | Re-bucketed the 17. **B3 EMPTY** (rankdir_dot family all passing). **ADR-3 collapse does NOT apply** — the b106/b29/trapeziumlr/root stems are distinct inputs (proven by size+sha+injection behaviour), each its own representative. Buckets: B1=2 (graphs/share-b106, node-size/text-measure), B2=3 (42/241_0/2095, edge FP-tie), B4=4 (3×trapeziumlr+1855, ratio=fill scaling), B5=8 (RTree edge-label, accept-lean; 1652/2470 known). Discriminator = injection signature+inj/base, not firstDiff (which is the graph bg polygon for all). | batch-0/findings.md | committed (this row) |
