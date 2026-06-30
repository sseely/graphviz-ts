# Decision Journal

Appended during execution. Every non-trivial judgment call gets a row.

| Date | Batch/Task | Decision | Rationale |
|------|------------|----------|-----------|
| 2026-06-21 | planning | scope = 5 small buckets (62 cases): color-stroke, text-content, attr-or-tag, polygon-points, parser-gap; path-structure/element-count out of scope | user choice "all small buckets"; heavy buckets are deep routing/layout, not low-hanging |
| 2026-06-21 | planning | Batch 2 sequential (not parallel) | user choice; shared golden manifest + possible shared src modules; sequential avoids all write contention |
| 2026-06-21 | planning | baseline parity (post contain_nodes fix, dot 15.1.0): conformant 237, structural 196, diverged 320, errored 19, timeout 9 | pre-flight measurement reference for the Batch 3 regression diff |
| 2026-06-21 | B1 startup | oracle (dot 15.1.0) + renderSvg recipe verified; shared `triage-probe.mjs` at repo root renders port+oracle to /tmp and reports first diff; seed fix confirmed (port `#1E1E1E` vs oracle `#1e1e1e` on 1896) | gives all 6 triage agents one known-good read-only probe; no src writes |
| 2026-06-21 | B1 plan | dispatch 6 parallel read-only agents (T1 color-stroke 9, T2 text-content 7, T3a attr-or-tag 17, T3b attr-or-tag 16, T4 polygon-points 3, T5 parser-gap 10); each writes only its triage doc | brief designs B1 as parallel read-only; non-overlapping write-sets; sonnet (mechanical investigation, not architecture) |
| 2026-06-21 | B1 done | 24 simple / 38 deep. Gate PASS: typecheck 0, test 2177 pass, build 0, no src/ changes. Triage docs committed. | all 6 agents pinned values against /tmp oracle SVGs |
| 2026-06-21 | B1 finding | 2682 (parser-gap simple) + 1990 (text-content simple) share the `dot.pegjs` QAtom implicit-concat rule → must be ONE grammar fix, sequenced once in B2 | avoid double-edit / write contention on the grammar |
| 2026-06-21 | B1 finding | AGSEQ id generation: T3b marks edge/cluster ids via AGSEQ as simple (triedds×3, b7); T3a marks cluster-numbering AGSEQ as deep (1453,2242,2592,705). Reconcile in B2-T8 before fixing — verify whether the simple AGSEQ fix also resolves/regresses the "deep" cluster-numbering ids | overlapping id-emission logic; sequential B2 avoids write contention but per-id deltas must be checked |
| 2026-06-21 | T6 done | color-stroke: 5 fixes (A bgcolor svg-graph.ts; B1 setlinewidth + B2 FUNLIMIT style-resolve.ts; C edge colorscheme device.ts; D peripheries device-cluster.ts+device.ts). 4 cases conformant (b155,2325,2801,grdcluster); 1896/style/proc3d improved to PRE-EXISTING layout first-diff (verified via stash that viewBox/height unchanged by my edits → stale baseline parity.json, not a regression); 2470 oracle-errors. +5 goldens (manifest 140). Gate: tsc 0, 2184 tests, build 0. commit 229ceaf | per-id deltas: 0 regressions; faithful per C (emit_background, parse_style/gvrender_set_style, emit_edge, emit_clusters) |
| 2026-06-21 | T6 insight | baseline parity.json firstDiffPath is STALE vs current port (layout shifted since baseline); several "simple"-classified cases have a deeper pre-existing layout diff so they improve but don't reach conformant. Fixes still faithful + 0-regression. Golden chosen = a case that fully conforms to (or synthetic for setlinewidth). | guides T7-T10 golden selection + Batch 3 regression read (diverged→diverged ≠ regression) |
| 2026-06-21 | T7 done | text-content: gv_xml_escape port (new xml-escape.ts: escapeXml apostrophe+entity-passthrough; escapeXmlText {raw,dash,nbsp}), htmlEntityUTF8 decode in make-label.ts, QAtom drop-implicit-concat in dot.pegjs (regenerated dot.js/.d.ts). 1990/b81 text now match oracle; residual viewBox diffs pre-existing (b81 100→6 IMPROVED). Gate: tsc 0, 2195 tests, build 0. +2 goldens (142). commit e01d906 | faithful per gv_xml_escape/htmlEntityUTF8/grammar.y |
| 2026-06-21 | T7 grammar safety | full-corpus parse sweep before/after QAtom change: BEFORE 14 throwers, AFTER 12 — fixes 2682+2108, ZERO new parse failures. 1411/imagepath_test-base/share-b545 were PRE-EXISTING throwers (C-invalid constructs), not regressions. escaping changes can't regress conformant cases (any mismatching `-`/`'`/entity would already be a divergence). golden suite (142) + full suite (2195) green. | de-risks the highest-blast-radius change; full survey confirms in Batch 3 |
| 2026-06-21 | T7→T10 | QAtom fix (T7) also resolves the parser-gap simple case 2682 → T10 reduces to just the russian NAME char-class widening | per B1 cross-bucket finding; avoids double grammar edit |
| 2026-06-21 | T8 AGSEQ reconcile | AGSEQ-numbering cases DEFERRED DEEP: b7, 1453, 2242, 2592, 705. The port Graph model has no cgraph-compatible subgraph sequence; replicating AGSEQ (incl. anonymous subgraphs + name-reuse) is attribute/model infrastructure, not ≤30-line localized. Resolves T3a(deep)/T3b(simple) disagreement: b7 is the SAME AGSEQ mechanism → deep. triedds×3 are id= ATTR cases (S1), not AGSEQ. | ADR-3 cutoff; STOP-condition (infra) |
| 2026-06-21 | T8 id quirk | C getObjId uses the object's OWN `id` (agget returns the graph-id default for a subgraph ONLY if `id=` was declared before the subgraph — a cgraph decl-order quirk, verified: id-before→cluster inherits "boss", id-after→"boss_clust1"). Not modelled; svg-id uses own `id` (gid prefix supplies the root id separately). Correct for all corpus cases (ids set directly). class stays inherited (nodeAttr/clusterAttr) — class defaults are declared-before. | faithful-for-corpus; full quirk is deep |
| 2026-06-21 | T8 done | new svg-id.ts centralizes getObjId/svg_print_id_class (id own-attr+gid-prefix; class inherited+appended; stylesheet PI in svgBeginGraph). Wired node/edge/cluster/graph ids+anchors+gradients (job.objId, job.drawingId). 2497+2563 conformant; rest improve to pre-existing layout/anchor diffs (0 regr). Removed dead graphGroupId. Gate: tsc 0, 2198 tests, build 0. +3 goldens (145). commit 8731c28 | faithful per getObjId/svg_print_id_class/svg_begin_job |
| 2026-06-21 | T10 done | widened NAME/NameContinue char class `\x80-\xFF`→`\x80-￿` (BMP) in dot.pegjs; regenerated dot.js/.d.ts. graphs-russian now parses (Cyrillic text matches oracle; residual = font-metric layout). 2682 already fixed by T7. Parse sweep 8 throwers (was 14 @T6), 0 new. SIDE-EFFECT: 1367/share-Latin1/windows-Latin1 now parse (U+FFFD replacement chars fall in widened class) but stay deep-charset (garbage text) → errored→diverged, not a regression. Gate: tsc 0, 2202 tests, build 0. +1 golden (146). commit 68185ec | faithful per scan.l byte>=0x80; BMP since Peggy class rejects \u{10FFFF} |
| 2026-06-21 | B2 deep | 38 deep cases each given a comparison page (comparisons/<id>.md + grouped README), 10 root-cause groups (arrowhead dot/odot 13, crow/vee 3, AGSEQ 4, charset 8, binary+charset 4, html-entities 1, html-table 2, tooltip 1, outputorder 1, shapefile 1). commit c019616 | CLAUDE.md completeness gate satisfied |
| 2026-06-21 | T11/B3 done | regenerated parity.json+PARITY.md (commit 7ace78c). conformant 237→**245 (+8)**, structural 196→**219 (+23)**, diverged 320→295, errored 19→13. Per-id diff: **37 improvements, 0 REGRESSIONS** (HARD GATE PASS). New conformant: 2325 2497 2563 2801 graphs-b155 graphs-grdcluster + bonus 1879-2 graphs-sr_circle. errored→renders: 2682 1367 share-Latin1 windows-Latin1 graphs-russian. Deferred-audit: all deep cases have comparison pages. Gate: tsc 0, 2202 tests, build 0. | success metric (ADR-6) met: conformant up, 0 regressions |

## Mission summary (2026-06-21)

**Result: SUCCESS.** conformant **237 → 245** (+8), structural-match **196 → 219**
(+23); matched-equal **433 → 464** (+31 of 796); errored **19 → 13**. Per-id
regression diff vs the pre-fix baseline: **37 improvements, 0 regressions**.

Batches: B1 triage (6 read-only docs, 24 simple / 38 deep). B2 fixes (5 commits):
T6 color-stroke (bgcolor resolve, setlinewidth, FUNLIMIT, edge colorscheme,
cluster peripheries=0); T7 text-content (gv_xml_escape port + escapeXmlText,
htmlEntityUTF8 decode, QAtom no-implicit-concat); T8 attr-or-tag (getObjId
id/class + gid prefix + stylesheet PI via new svg-id.ts); T9 polygon-points
(0 simple — all crow/vee arrowhead geometry → deep); T10 parser-gap (NAME
char-class widening). B3 regenerate + 0-regression verification.

Goldens: 135 → **146** (+11 conformant with). 38 deep cases deferred with
comparison pages across 10 root-cause groups (arrowhead geometry, AGSEQ id
numbering, charset/latin1, HTML entities/tables, tooltip anchor, outputorder,
shapefile). Heavy buckets (path-structure 158, element-count 109) out of scope.

Key insight: the committed baseline parity.json firstDiffPath was stale vs the
current port (layout shifted since baseline), so several "simple"-classified
cases had a deeper PRE-EXISTING layout diff — fixes were still faithful and
0-regression, reaching byte/structural-match where the fix was the sole diff.
