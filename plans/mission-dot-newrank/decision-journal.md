# Decision Journal — DOT-newrank

Appended during execution (per ~/.claude/rules/autonomous-execution.md).

| Task | Date | Decision | Rationale | Flagged |
|------|------|----------|-----------|---------|
| Batch1 | 2026-06-17 | Run T1/T2/T5 as 3 parallel opus agents; disjoint write-sets (cgraph-ops.ts / fastgr.ts / position.ts+leafset.test). | parallelism.md: independent, no shared writes. Baseline tsc clean. | no |
| T2 | 2026-06-17 | `remove_from_rank` lives in `dotinit.c:234`, not `mincross.c` as the brief's read-set states. Ported from dotinit.c. | Brief read-set pointer corrected against actual C source. | no |
| T5 | 2026-06-17 | Port `expand_leaves` reproducing the verbatim upstream bug `d = ND_rank(aghead(e)) - ND_rank(aghead(e))` (position.c:1025) — head minus head, ALWAYS 0, so the loop body (zapinlist/fast_edge) is unreachable; net effect = `make_leafslots` only. | "C source is sacred": the oracle binary is built from this exact tree (dormant bug since 2004 initial revision), so faithful d==0 matches oracle. The brief's prose ("head-rank delta") predates noticing the bug; sacred-C overrides. | **yes — review** |
| T5 | 2026-06-17 | `ND_ranktype = LEAFSET` is NEVER assigned anywhere in upstream graphviz (only read at position.c:985, rank.c:486) — the leaf-collapse path is absent in this version. Kept faithful (A) impl (`expandLeaves` = `makeLeafslots`); pinned oracle parity on a 13-node leaf-heavy graph (max delta 0.0pt) instead of faking LEAFSET. No `comparisons/leafset.md` — parity proven by passing test. | LEAFSET unreachable is a spec property, not a porting gap; AD-4 comparison-page requirement met by the oracle-pinned test. | yes — note |
| Batch1 | 2026-06-17 | Gates GREEN: tsc 0; vitest 1831 pass / 0 fail; golden suite 122 byte-identical; lizard 0 warns. Commits 5537a0a (T1), 5f91a2d (T2), 87333d5 (T5), each within write-set. Brief says "115 goldens" but suite has 122 (brief undercount; invariant "no golden moves" holds). | Autonomous protocol quality gates between batches. | no |
