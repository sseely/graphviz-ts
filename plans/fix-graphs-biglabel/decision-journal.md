# Decision Journal

| # | Batch/Task | Decision | Rationale |
|---|---|---|---|
| 0 | planning | 2-batch diagnosis pattern; AD-1…AD-5 approved | Diagnosis-first mission; write-set of the fix is pinned by Batch 1 (T2), not pre-assumed |
| 1 | T1 | Instrumented C via /tmp/ghl symlink (rebuilt dot_layout plugin), not a separate /tmp/gvplugins | /tmp/ghl already symlinks the build's dot_layout dylib, so rebuilding the plugin updates the survey oracle in place — lighter than AD-1's literal recipe, same ground truth. Reverted + rebuilt pristine after capture. |
| 2 | T2 | Root cause = unported record `pboxfn` (`record_path`); NOT AD-5 escape | struct3 g[4] byte-identical + head-port resolution identical ruled out sizing/port; C box2 = record_path channel, port box2 = maximal-bbox fallback (RECORD_FNS.pboxfn=null). Genuine algorithmic defect → proceed to Batch 2. |
| 3 | T2 | Fix will touch 3 files (record-port.ts, shapes.ts, splines-path-begin/end.ts) — one mechanism | AD-2 origin is the record pboxfn; faithful wiring = begin/endPath look up ND_shape(n).fns.pboxfn internally (as C splines.c:389/586). Shared-primitive (AD-4) → gate is the guard. Batch-2 write-set updated accordingly. |
