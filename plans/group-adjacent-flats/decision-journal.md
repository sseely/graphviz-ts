# Decision Journal — group-adjacent-flats

Appended during execution (per `~/.claude/rules/autonomous-execution.md`).
One writer per row; parallel agents write their own findings file, the
orchestrator records the journal row after the batch.

| Task | Date | Decision | Rationale | Flagged |
|------|------|----------|-----------|---------|
| scope | 2026-06-20 | Brief authored from the merged `#241_0` diagnosis (7490f43). Fix = caller-side grouping of adjacent port-bearing flats into one `makeFlatAdjEdges(cnt=N)` call; aux internals already faithful. Locked AD-1 (pin C order — `edges[0]` must be the forward edge), AD-4 (regression gate: goldens byte-identical out-of-family + survey net-improve). Batch 1 = T1 derisk (pin order + red test); Batch 2 = T2 implement + T3 regression. | The ordering detail (`edges[0]`) and the shared-aux golden-risk are the two things that sank/feared prior missions — both locked before src edits. | no |
| T1 | 2026-06-20 | debugger agent pinned the C order (ephemeral instrumentation, restored clean) + wrote red test. **AD-1 REFINED, not contradicted:** C's auxt is set by a SEPARATE forward-normalized `e0` param (`tn=agtail(e0)=node2`), while the raw `edges[]` stays edgecmp-sorted with `edges[0]=3->2` (back). The port's `buildFlatAux` uses `edges[0].tail` for `otn`, so the AD-2-compliant rule is: **place a forward edge (tail=node2, the lower-order node) at group index 0.** I verified this against C `make_flat_edge:1512-1528` (`e=*edges; if(BWDEDGE) makefwdedge; …make_flat_adj_edges(g,edges,cnt,e,et)`). Port AGSEQ analog = `Edge.seq`, but all three 2↔3 edges share it; the discriminator is direction (forward-first). Red test `splines-flat-group.test.ts` RED (back 4≠7) + GUARD green (fwd 7). | AD-1 pin-by-C; the e0-vs-edges[0] distinction is the load-bearing detail T2 must honor. | no |
| gates-B1 | 2026-06-20 | Batch 1 gates: tsc 0; red test fails as intended (TDD red), guard green; C `dotsplines.c` clean (AD-5); lizard 0; write-set = red test + findings only. | Quality gates between batches; the one failing test is the deliverable. | no |
