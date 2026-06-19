# Architecture Decisions — dot-multiport (locked)

Treat each as locked. If a conflicting constraint surfaces, STOP and log it to
`decision-journal.md` — do not silently override.

## AD-1 — Faithful-first; confirm before editing

T1 produces a written C-vs-TS control-flow trace (`docs/dot-g2-trace.md`) and
confirms the divergence against the native oracle **before** any code change.
No mark-guard / output-matching patch. Per `CLAUDE.md` "the C source is sacred."

- Context: prior dot missions broke when a fix was applied before the C control
  flow was understood.
- Decision: diagnose, cite C lines, confirm runtime values, then fix.
- Consequence: T2 is a small, line-cited change; T1 may redirect scope (AD-4).

## AD-2 — Fix only `accumCross`; mirror C `in_cross`/`out_cross`

`src/layout/dot/mincross-cross.ts:accumCross` must compare `ND_order` first and
break ties by **`port.p.x`** (C `mincross.c:593,611`). Do **not** fold `p.x`
into the scaled `val()` (it can be ~27 and would corrupt the order scale);
compare order, then `p.x` on the tie, exactly as C does.

- The `val(node, port.order)` usage in `src/layout/dot/mincross-order.ts:85,87`
  ports a **different** C construct — the `VAL` macro (`mincross.c:1619`,
  `MC_SCALE*ND_order + port.order`) used by `build_ranks`/flat ordering — and is
  **correct**. It must NOT change.
- The `local_cross` port tiebreak already uses `p.x`
  (`mincross-cross.ts:239,245`, C `1500/1505`) and is correct.

## AD-3 — Every golden stays byte-identical

Non-ported edges have `port.p.x == 0`, so the tiebreak change is a no-op for
them. Any golden that churns is a porting bug, not a new-correct case → STOP and
diagnose. Goldens are generated from the C binary; the suite is the bar.

## AD-4 — Scope guard (re-scope trigger)

If T1 finds `tail_port.p.x` / `head_port.p.x` is **not** populated (still 0) at
mincross time — i.e. the real gap is port-resolution **timing** (compass ports
resolved late at spline time, not at edge-init `chkPort`), or node `lw`/`ht` is
unset when `chkPort` runs — then the comparator fix alone will not work. STOP
and re-scope: that is a different, larger blast radius (edge-init / shape-port
phase) and must not be force-fit into `accumCross`.

## Rollback classification

**Reversible** — revert the merge commit. No data model, schema, or API
migration. The mission touches one layout-internal function plus tests/docs.
