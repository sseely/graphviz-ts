# Batch 0 — Instrument + pin the ordering divergence

Build the C-vs-port trace of `ordering` enforcement so Batch 1 consumes a pinned
first-divergence (AD-1). Diagnostic only — no layout behavior change.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T0 | Instrument C `do_ordering_node`/`ordered_edges` + the per-rank order after each mincross pass; instrument the port's `doOrderingNode`/`doOrderingAddFlatEdges` + post-pass order; diff on `graphs/b58.gv` (+ `ordering_dot1`); pin the first divergence. Fix `flat-geom-diff.mjs` ellipse blind spot. | debugger | `test/diagnostic/ordering-trace.md`, `test/diagnostic/flat-geom-diff.mjs` | — | [x] |

Notes:
- C instrumentation in `~/git/graphviz/lib/dotgen/mincross.c` is **temporary**:
  gate every print by an env var (e.g. `ORDDBG`), rebuild `gvplugin_dot_layout`,
  regen `/tmp/ghl`, capture, then `git -C ~/git/graphviz checkout -- <files>`
  and rebuild clean.
- Port instrumentation is env-gated and **removed** before the batch closes —
  only the harness docs under `test/diagnostic/` are committed.
- The `flat-geom-diff.mjs` fix: it currently reads only `<polygon points>` for
  nodes, so ellipse nodes (default shape) compare as empty→0.00 (it falsely
  reported b58 nodes as matching during triage). Add `<ellipse cx/cy/rx>`
  extraction so node deltas are real for ellipse graphs.
- Output of T0 = the pinned divergence (which function, which value, whether it
  is constraint construction vs preservation through passes) that Batch 1
  consumes, recorded in `ordering-trace.md`.

Execution: this batch makes no `src/` layout change, so the 17-min survey is not
required for T0 (run tsc only). Commit = the two `test/diagnostic/` files + plan
doc updates.
