<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

| date | batch/task | decision / finding |
|---|---|---|
| 2026-07-02 | setup | Branch fix/attr-or-tag-bucket from main (f6c0614). Batch 1: T1 b69, T2 b15, T3 user_shapes, T4 escape tables. Main-loop sequential. |
| 2026-07-02 | B1/T3 | user_shapes mechanism: C bind_shape (shapes.c:3970) — non-empty shapefile + name!=epsf → shape="custom" = clone of Shapes[0] (box) with usershape=true; headless gvusershape_size fails → warning + plain box polygon at normal node dims (oracle stderr confirms 2 warnings/node). Port never reads shapefile → default ellipse. Fix locus: port shape binding. |
| 2026-07-02 | B1/T4 | Escape tables: C xml_core (util/xml.c:76-106) — titles/ids/class via gvputs_xml={dash,nbsp} (gvdevice.c:281); textspans+tooltips={raw,dash,nbsp}; hrefs={}. Port: node/cluster/graph titles use base escapeXml (NO dash/nbsp — the observed gap); escapeEdgeTitle hand-rolls dash but unconditional & and no nbsp. Fix: {dash,nbsp} variant at all 4 title emitters + svg-id id/class. |
| 2026-07-02 | B1/T1 | b69 mechanism PROVEN: per-orig bezier append order = routing order. Both sides collect [lead-in@r6, trunk@r7] with byte-equal edgecmp keys (seq=84, ti=81, comparator 0); C's libc qsort (Bentley-McIlroy, unstable) permutes the equal run (trunk routed first; 3 of 6 multi-path groups) while the port's stable Array.sort keeps collection order. Comparators line-equivalent; ONLY the sort algorithm differs. Fix: gvQsort (bsd-qsort.ts, cf. TB_balance) in dotSplines_. |
| 2026-07-02 | B1/T2 + GATE | b15/b69 node geometry byte-conformant ("1pt x-coord" note disproven). b15 = 5 record-port groups: perms + Δ70-132 + two piece-count diffs — plausibly downstream of the same routing-order mechanism (recover_slack order dependence). T2 classification completes after the T6 fix re-measure. GATE: proceeding to fixes. |
