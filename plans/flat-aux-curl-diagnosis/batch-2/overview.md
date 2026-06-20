# Batch 2 — Structural dump → name the divergent line

One task. Uses T1's harness and T2's suspect list to land the dump three prior
sessions deferred, then names the exact divergent structural decision.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Stage-by-stage aux rank/chain dump (C vs port) on the suspect; name the first divergent decision; confirm on #241_0 | debugger | `plans/flat-aux-curl-diagnosis/findings-structural-dump.md` | T1, T2 | [x] |

Dependency: needs T1's validated harness (interface contract) and T2's
suspect-ranked input list.

Possible early exit (push-forward): if T2 already isolates the cause by source
reasoning (e.g., the `rank=source` subgraph is absent **and** the port's `dotRank`
cannot honor a source constraint), T3 collapses to a **single confirming dump**
(show the rank gap closes when the pin is conceptually present) rather than a
full stage sweep. Log the collapse in the journal.

Exit criteria for the batch:
- The first pipeline stage at which C and port aux structures diverge is named
  (e.g., "after `dot_rank`: C `auxh.rank=2`, port `auxh.rank=1`"), with the
  responsible C line and port line.
- A one-paragraph fix hypothesis for the **next** mission, explicitly scoped as
  *not done here* (AD-1).
