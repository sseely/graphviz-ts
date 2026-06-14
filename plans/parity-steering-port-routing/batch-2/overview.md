# Batch 2 — Wire ported-with-side edges through the faithful path

**Depends on:** SR1 (recon spike). SR1's findings finalize the write-sets
and the `beginPath` input contract below; treat the task list here as the
plan to be confirmed, not yet executed.

**Goal:** Route a dot **regular adjacent-rank** edge that has an active
side-mask port (`tail_port.side || head_port.side`) through
`beginPath → routeSplines → endPath → clipAndInstall`, leaving every other
edge on the current router (AD2). Fix the T6b loop-corridor truncation;
no existing golden changes (AD3).

| ID | Description | Agent | Writes (confirm in SR1) | Depends | Done |
|----|-------------|-------|--------------------------|---------|------|
| SR2 | Build a `Path`+`PathendT` (incl. `endp.nb`, `ranksep`, in/out edges, `merge`) from a dot regular edge — the input adapter `beginPath` needs | typescript-pro | `splines-route.ts` (+ a new `splines-route-port.ts` if size forces a split) + test | SR1 | [ ] |
| SR3 | In `makeRegularEdge`, when the edge has a side port, route via `beginPath`→`routeSplines`→`endPath`→`clipAndInstall` and install the spline + arrows; else keep the simplified path | typescript-pro | `splines-route.ts`, wire-up in `splines.ts`/`edge-route.ts` dispatch (per SR1) + test | SR2 | [ ] |
| SR4 | Oracle-validate the four sides (`A:n/s/e/w->B`, contradictory compass, record side port) vs dot 15.0.0; classify pass(≤0.5pt)/journal-exclude | orchestrator inline | test + journal | SR3 | [ ] |

## Interface contract (SR2 → SR3)

SR2 produces, from a regular edge `e` with resolved ports:
```
{ P: Path,            // boxes accumulator, P.start/P.end seeded
  endpTail: PathendT, // .nb = tail maximal bbox, .sidemask, .np
  endpHead: PathendT,
  merge: boolean, inEdges: Edge[], outEdges: Edge[], ranksep: number,
  pboxfn: ShapeDesc['fns'] | null }
```
consumed by `beginPath(...)`/`endPath(...)` exactly as neato's caller does.

## Acceptance criteria (batch)

- `A:n->B` renders a complete loop spline reaching B, within 0.5pt of dot
  15.0.0 at the attachment points (interior within 0.5pt or journaled).
- `A:e->B`/`A:w->B` reproduce dot's lateral bulge within 0.5pt (or journaled).
- Every existing dot golden is byte-identical (no edge has a side port).
- `tsc` clean; suite ≥ baseline; write-set respected.

## Notes

- The side-mask box logic already lives in `beginPath`/`endPath`
  (`BeginRegSide`/`EndRegSide`) — do NOT re-port it (parity-edge-ports T6b
  did, and reverted). This batch *feeds* those functions, it does not
  reimplement them.
- C's ±1 port-box nudge is internal to pathplan; verify against the oracle
  whether it survives `clipAndInstall` to the output (T6a found it does NOT
  for the simplified path — re-check here, the faithful path may differ).
