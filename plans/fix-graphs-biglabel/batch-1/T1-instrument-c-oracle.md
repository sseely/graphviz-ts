# T1 — instrument C oracle: dump boxes + spline for the edge

## Context

graphviz-ts is a faithful TypeScript port of C graphviz; `~/git/graphviz` is the
spec. `graphs-biglabel` diverges only on the edge spline for
`struct1:f2 → struct3:here` (`biglabel.gv:90`; `here` is nested 3 levels deep at
`biglabel.gv:88`). The oracle SVG's `g[5]/path[1]/@d` is **2 cubic beziers**
(7 pts): `M316.38,-1413.8 C316.38,-1365.17 499.92,-1414.13 532.25,-1377.8
602.03,-1299.39 592.03,-1005.23 578.8,-827.7` — it rises above the start then
sweeps down around the tall record. The port emits **1 cubic** (4 pts):
`M316.38,-1413.8 C316.38,-1129.09 491.14,-814.12 548.19,-718.89`. Capture the
oracle's routing corridor and spline fit for THIS edge so T2 can diff.

## Task

1. Build/refresh the instrumented dot-layout plugin per memory
   `recover-slack-and-c-harness` (`gvplugin_dot_layout → /tmp/gvplugins`).
2. Render `~/git/graphviz/tests/graphs/biglabel.gv` with the instrumented
   binary; capture for edge `struct1:f2→struct3:here`:
   - the box corridor list (`Agedgeinfo_t.boxes` / `boxn`) feeding the fit,
   - the Proutespline input polyline + endpoint slopes,
   - the Proutespline output bezier control points (should reproduce the
     2-cubic path above),
   - the rank span / any virtual nodes on the edge chain.
3. Record all of it verbatim in `.agent-notes/graphs-biglabel-oracle-dump.md`
   with enough labels that T2 can align each value to a port site.

## Write-set
- `.agent-notes/graphs-biglabel-oracle-dump.md` (create)
- `plans/fix-graphs-biglabel/decision-journal.md` (append)

## Read-set
- memory `recover-slack-and-c-harness` (harness recipe)
- `~/git/graphviz/lib/dotgen/dotsplines.c` (box construction, Proutespline call)
- `~/git/graphviz/lib/common/routespl.c` (Proutespline)
- `biglabel.gv:88-90`

## Architecture decisions (locked)
- AD-1: gvplugin harness, not printf-patching the C tree.

## Interface contract (consumed by T2)

```
{ edge: "struct1:f2->struct3:here",
  boxes: Box[],            // corridor rectangles, in order
  routesplineIn: Point[],  // input polyline + endpoint slopes
  routesplineOut: Bezier[],// output control points (== oracle g[5] path)
  rankSpan: {tail, head, vnodes} }
```

## Acceptance criteria
- Given the instrumented harness, when rendering `biglabel.gv`, then the oracle's
  boxes + Proutespline in/out for `struct1:f2→struct3:here` are captured to the
  note.
- Given the captured `routesplineOut`, when compared to the oracle SVG
  `g[5]/path[1]/@d`, then they match (2 cubics, 7 pts).

## Observability
N/A — dev/test instrumentation, no production operation.

## Rollback
Reversible — delete the note; no `src/` or C-tree change.

## Quality bar
Capture is complete (all four fields present) and the `routesplineOut` matches
the known oracle path. Return only the structured result — no preamble.

## Commit
`docs(T1): capture C-oracle box+spline dump for graphs-biglabel edge`
