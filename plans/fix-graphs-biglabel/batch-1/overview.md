# Batch 1 — diagnose (isolate the first divergence origin)

No `src/` change. Instrumentation + notes only. Sequential: T2 diffs T1's
oracle dump.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | Instrument C oracle; dump boxes + Proutespline in/out for `struct1:f2→struct3:here` | inline | `.agent-notes/graphs-biglabel-oracle-dump.md`, `decision-journal.md` | — | [x] |
| T2 | Instrument port at the same points; diff vs T1; produce root cause (mechanism/origin/chain/ruled-out) | inline | `.agent-notes/graphs-biglabel-rootcause.md`, `decision-journal.md` | T1 | [x] |

## Write-set conflict check

Both write only to `.agent-notes/` (distinct files) + append `decision-journal.md`.
Sequential due to data dependency, not file contention.

## Gate after batch

No code gate (no `src/` change). Exit criterion: T2 yields a single
first-divergence `file:line` origin + stated mechanism, OR triggers the AD-5
escape (stop). If multiple independent origins → stop (mis-scoped).
