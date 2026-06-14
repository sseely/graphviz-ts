# SR1 — Recon spike: dot routers + the faithful-path input contract

**Type:** investigation + a throwaway proof-of-concept probe. Produces a
written findings doc that finalizes the batch-2/3/4 task files. No production
code ships in this task (probe lives under `.probes/`, untracked).

## Context

graphviz-ts is a faithful C→TS port (C at `~/git/graphviz/lib`, tag 15.0.0,
is the spec). The faithful `routesplines` pipeline (`beginPath`, `routeSplines`,
`endPath`, `clipAndInstall`, `Proutespline`, `Pshortestpath`) is ported and
used by neato/pack/ortho, but dot routes regular edges through a simplified
fitter (`routeOneEdge` → `buildRankCorridor` → `computeSpline`) that
truncates non-monotonic loop corridors — blocking steering ports. See
[../SCOPE.md](../SCOPE.md) and [[active-fitter-no-loop-corridors]].

## Task

Answer the open questions below with file:line evidence and a working probe,
then write `batch-1/SR1-findings.md` and update the batch-2/3 task files to
match reality. Use Tier-1 verbs: **enumerate**, **verify**, **identify all**.

1. **Dispatch map.** Identify all edge classes dotSplines/`routeDotEdges`
   produces and which function routes each: regular adjacent-rank, multi-rank
   virtual chain, flat (same-rank), self-edge, parallel group. For each, name
   the exact function in `edge-route.ts` / `splines-route.ts` / `splines-flat.ts`.
2. **Orchestrator decision (AD1).** Verify whether `makeRegularEdge`
   (splines-route.ts) is reachable from dotSplines today, or only
   `routeOneEdge`. Decide the integration seam with evidence; if AD1 needs
   revising, say so.
3. **beginPath input contract.** Enumerate exactly what
   `beginPath`/`endPath` read from `P`/`endp`/`e` and where each value comes
   from in the dot active router's data (esp. `endp.nb`, `ranksep`, `merge`,
   `inEdges`/`outEdges`, `pboxfn`). Note any value the active router does not
   currently compute.
4. **PoC probe.** Under `.probes/`, route ONE steering edge (`A:n->B`) by
   hand-constructing `Path`/`PathendT`, calling
   `beginPath → routeSplines → endPath → clipAndInstall`, and emit the
   resulting points. Compare to dot 15.0.0 `M27,-109 C27,-121 …`. Confirm the
   faithful path produces a complete loop spline (NOT truncated) and record
   the delta. This is the go/no-go signal for the whole mission.
5. **Golden-risk probe.** Route ONE existing no-port golden's regular edge
   through the faithful path and diff vs its current ref. Quantify how far the
   faithful fitter is from the simplified one on a no-port edge — this informs
   AD3 (hybrid vs full switch).

## Read-set

- `src/layout/dot/splines.ts` (dotSplines/routeDotEdges dispatch),
  `edge-route.ts:routeOneEdge`, `splines-route.ts:makeRegularEdge`,
  `splines-flat.ts`.
- `src/common/splines.ts`, `splines-routespl.ts:routeSplines`,
  `splines-path-begin.ts`, `splines-path-end.ts`, `splines-clip.ts:clipAndInstall`.
- `src/common/types.ts` (`Path`, `PathendT`), `src/pathplan/route.ts` (entry).
- How neato calls the path: `src/layout/neato/splines.ts` (a working caller
  to copy the wiring from).
- C: `lib/dotgen/dotsplines.c:make_regular_edge` (84) + the
  `beginpath/routesplines/endpath/clip_and_install` call sequence.

## Write-set

- `plans/parity-steering-port-routing/batch-1/SR1-findings.md` (new).
- Edits to `batch-2/overview.md`, `batch-3/overview.md`, and creation of the
  batch-2 task files (SR2–SR4) reflecting the findings.
- `.probes/spr-*.ts` (untracked).
- Append a journal row with the PoC result.

## Acceptance criteria

- **Given** the PoC probe, **when** it routes `A:n->B` via the faithful path,
  **then** the output is a complete multi-segment spline reaching B (not
  truncated), and the delta vs dot 15.0.0 is recorded (pass if start/end
  within 0.5pt; if the curve interior diverges, quantify it for AD3).
- **Given** the no-port golden-risk probe, **when** one regular edge is routed
  via the faithful path, **then** the diff vs its current ref is quantified
  (byte-identical / within Npt / diverges), feeding AD3.
- **Given** the findings doc, **when** batch 2 starts, **then** SR2–SR4 have
  concrete write-sets and the beginPath input contract is fully specified.

## Boundaries

- Never do: modify production src in this task, modify any existing golden ref.
- Ask first: if the PoC shows the faithful path does NOT reach B (mission
  premise false) — STOP and surface to Scott before writing batch 2.

## Quality bar

`npx tsc --noEmit` clean if any .ts is added under .probes; the findings doc
must cite file:line for every claim. Return only the findings doc + journal
row — no production code.
