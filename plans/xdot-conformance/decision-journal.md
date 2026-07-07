# Decision Journal — xdot-conformance

Append one row per non-trivial judgment call or completed fix. Include the
mechanism for every fix (per `~/.claude/rules/diagnosis.md`) and reference every
accepted divergence.

| Date | Item/Task | Decision / Mechanism | Files | Gate result |
|------|-----------|----------------------|-------|-------------|
| 2026-07-07 | plan | Brief generated from `/plan-mission`. Comparator=semantic, deliverable=both modes, irreducibles=accept-and-continue (user, Phase 3). | plans/xdot-conformance/ | n/a |
| 2026-07-07 | T1 | render-one-xdot.ts mirrors render-one.ts; `render(parse(decode(buf)),'xdot')` in a group-killed subprocess. | test/corpus/render-one-xdot.ts | tsc 0, smoke ok |
| 2026-07-07 | T2 | Semantic comparator. Reuses the port `parse()` for envelope extraction (verified it round-trips `_draw_/_ldraw_/_hdraw_/…` on graph/cluster/node/edge) + `parseXDot` per draw string. Objects keyed `[graph]`/`cluster:<n>`/`node:<n>`/`edge:<t>-><h>#<i>`. Colors canon→`#rrggbb[aa]` via colorxlate; fonts canon case/ws-only (keeps `Times,serif`≠`Times-Roman` so F4 surfaces). Positional pos/bb/width/height numeric @0.01. | test/golden/compare-xdot.ts(+.test.ts) | tsc 0, 11/11 green |
| 2026-07-07 | T3 | Walker: conformant set from parity.json, size-sorted small→large; oracle `dot -Txdot` GVBINDIR=/tmp/ghl cached by sha1(bin,GVBINDIR,xdot,mtime); default stop-on-first (exit 1) / `--survey` (xdot-parity.json). Reuses survey.ts spawn/kill/budget model. | test/corpus/xdot-walk.ts, accepted-divergences-xdot.json | tsc 0, smoke stops at 2285 (F4) |
| 2026-07-07 | T4 | Dashboard: PARITY-XDOT.md from xdot-parity.json; buckets by (object-kind · draw-attr · diff-shape). | test/corpus/xdot-dashboard.ts | tsc 0, wrote md |
| 2026-07-07 | Batch 1 baseline | **0/759 xdot-conformant** (758 diverged, 1 oracle-error=1652 which is oracle-error under SVG survey too). Two dominant buckets: (a) 678 `graph·<object>·missing-object` = F4 graph background omitted; (b) 80 `[parse]` = port emits UNQUOTED ids with special chars (`FTC/BTC`, `Base (FTC) holding`) → invalid DOT (new bug, not in pre-diagnosed F1–F4). npm test 2780/2780. | — | baseline recorded |
