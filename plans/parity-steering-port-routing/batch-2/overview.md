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
| SR2 | Build the faithful-path input from a dot regular edge: seed `endp.nb` (maximal bbox), fresh `Path`, `ranksep`, in/out edges, `merge`; call `beginPath`/`endPath`; **assemble `P.boxes`** = tail boxes + inter-rank box + head boxes (the missing C `make_regular_edge` glue) | typescript-pro | new `src/layout/dot/edge-route-faithful.ts` + test | SR1 | [x] |
| SR3 | In **`routeOneEdge`** (AD1 revised), when the edge has a side port, route via `routeSplines(P)` → `clipAndInstall` (+ arrows); else keep the simplified path. Extend `portRouteOf` gate to `.side` | typescript-pro | `edge-route.ts`, `edge-route-faithful.ts` + test | SR2 | [x] |
| SR4 | Oracle-validate the four sides (`A:n/s/e/w->B`, contradictory compass, record side port) vs dot 15.0.0; classify pass(≤0.5pt)/journal-exclude | orchestrator inline | test + journal | SR3 | [x] |

> SR1 revised the seam to `routeOneEdge` (makeRegularEdge is dead code) and
> flagged that `beginPath`/`routeSplines`/`endPath` have NO existing callers
> — SR2 first-assembles that sequence. The PoC (`.probes/sr1-poc.ts`) proved
> `routeSplines` routes the loop corridor. See batch-1/SR1-findings.md.

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

**SR4 outcome (2026-06-14):** all six required cases PASS ≤0.5pt and are pinned
in `edge-route-faithful-oracle.test.ts` (9 cases). `A:s->B:n` and record
`A:f0:n->B` match C exactly; `A:s->B:n` clears T8's 11pt blocker. Compound
both-ends `A:n->B:s` excluded (24pt mid-corridor, SR7-adjacent) — see
[comparisons/An-Bs-double-steering.html](../comparisons/An-Bs-double-steering.html).
±1 nudge does NOT survive to output (faithful path = simplified here). Batch 2
complete (SR2+SR3+SR4).

## Notes

- The side-mask box logic already lives in `beginPath`/`endPath`
  (`BeginRegSide`/`EndRegSide`) — do NOT re-port it (parity-edge-ports T6b
  did, and reverted). This batch *feeds* those functions, it does not
  reimplement them.
- C's ±1 port-box nudge is internal to pathplan; verify against the oracle
  whether it survives `clipAndInstall` to the output (T6a found it does NOT
  for the simplified path — re-check here, the faithful path may differ).
