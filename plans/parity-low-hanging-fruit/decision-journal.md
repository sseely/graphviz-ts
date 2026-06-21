# Decision Journal

Appended during execution. Every non-trivial judgment call gets a row.

| Date | Batch/Task | Decision | Rationale |
|------|------------|----------|-----------|
| 2026-06-21 | planning | scope = 5 small buckets (62 cases): color-stroke, text-content, attr-or-tag, polygon-points, parser-gap; path-structure/element-count out of scope | user choice "all small buckets"; heavy buckets are deep routing/layout, not low-hanging |
| 2026-06-21 | planning | Batch 2 sequential (not parallel) | user choice; shared golden manifest + possible shared src modules; sequential avoids all write contention |
| 2026-06-21 | planning | baseline parity (post contain_nodes fix, dot 15.1.0): byte-match 237, structural 196, diverged 320, errored 19, timeout 9 | pre-flight measurement reference for the Batch 3 regression diff |
| 2026-06-21 | B1 startup | oracle (dot 15.1.0) + renderSvg recipe verified; shared `triage-probe.mjs` at repo root renders port+oracle to /tmp and reports first diff; seed fix confirmed (port `#1E1E1E` vs oracle `#1e1e1e` on 1896) | gives all 6 triage agents one known-good read-only probe; no src writes |
| 2026-06-21 | B1 plan | dispatch 6 parallel read-only agents (T1 color-stroke 9, T2 text-content 7, T3a attr-or-tag 17, T3b attr-or-tag 16, T4 polygon-points 3, T5 parser-gap 10); each writes only its triage doc | brief designs B1 as parallel read-only; non-overlapping write-sets; sonnet (mechanical investigation, not architecture) |
| 2026-06-21 | B1 done | 24 simple / 38 deep. Gate PASS: typecheck 0, test 2177 pass, build 0, no src/ changes. Triage docs committed. | all 6 agents pinned values against /tmp oracle SVGs |
| 2026-06-21 | B1 finding | 2682 (parser-gap simple) + 1990 (text-content simple) share the `dot.pegjs` QAtom implicit-concat rule → must be ONE grammar fix, sequenced once in B2 | avoid double-edit / write contention on the grammar |
| 2026-06-21 | B1 finding | AGSEQ id generation: T3b marks edge/cluster ids via AGSEQ as simple (triedds×3, b7); T3a marks cluster-numbering AGSEQ as deep (1453,2242,2592,705). Reconcile in B2-T8 before fixing — verify whether the simple AGSEQ fix also resolves/regresses the "deep" cluster-numbering ids | overlapping id-emission logic; sequential B2 avoids write contention but per-id deltas must be checked |
