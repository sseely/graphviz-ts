# Batch 1 — pin the FLATEDGE box-x line

Read-only to `src/`. Single diagnosis task: instrument C `beginpath`/`endpath`
(FLATEDGE) for `1:se->6:sw`'s end boxes, pin the exact port line + the correct
x-reference, confirm it is FLATEDGE-gatable.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Instrument C beginpath/endpath (FLATEDGE) for node1 tail box + node6 head box of `1:se->6:sw`; dump box x + the coord.x-vs-(coord.x±rw/lw) reference; pin the exact port line in splines-path-begin.ts/-end.ts; confirm FLATEDGE-gatable | opus | `decision-journal.md` | — | [ ] |

## Interface (Batch 1 -> Batch 2)
T1 appends a journal row:
`{ divergentFn (file:line), cRef (C file:line), correctXref (e.g. "coord.x"),
  gatable: boolean }`.

## Known starting point (from flat-edge-routing-241 diagnosis, on main)
- C end box `1->6`: tlast=[99,109], hlast=[395,403] (LL.x at node CENTRE 99/395).
- Port end box: tlast=[126,136], hlast=[422,430] (LL.x at node EDGE = centre+rw).
- Port begin-side helpers (`splines-path-begin.ts`) reference `coord.x + rw`
  (line ~56) / `coord.x - lw`; the end-side mirror is in `splines-path-end.ts`.
- vspace/stepx/stepy already MATCH C (36/9/18) — NOT the bug.

## Stop conditions
Per README. AD-4/AD-5: if the x-reference is shared with regular edges and not
gatable -> STOP, report.

## Quality gates
No `src/` change in Batch 1. Snapshot `parity.json` before Batch 2. Restore the
clean C plugin to `/tmp/gvplugins` after instrumenting (oracle must stay native).
