# T1 — DOT-9: port `makeSimpleFlat`, route no-label adjacent flats

## Context

graphviz-ts is a faithful TS port of Graphviz; C at `~/git/graphviz`
(tag 15.0.0) is the spec. Flat (same-rank) adjacent edges with no ports
and no labels must fan into a spindle. Today the no-port dispatcher
`makeAdjFlatLabeledEdge` (`splines-flat-labeled.ts:269`) declines no-label
groups, so they fall back to the simplified fitter and `cnt>1` siblings
overlap.

## Task

1. Add `makeSimpleFlat(group: Edge[], et: number): void` to
   `splines-flat-labeled.ts`, faithful to C `dotsplines.c:1075`:
   - `tp = tn.coord + e0.tail_port.p`, `hp = hn.coord + e0.head_port.p`.
   - `stepy = cnt > 1 ? tn.info.ht / (cnt - 1) : 0`;
     `dy = tp.y - (cnt > 1 ? tn.info.ht / 2 : 0)`.
   - For each edge i: SPLINE/LINE → 4 points
     `[tp, {(2tp.x+hp.x)/3, dy}, {(2hp.x+tp.x)/3, dy}, hp]`;
     PLINE → the 10-point form (see C). Then `dy += stepy`,
     `clipAndInstall(e, e.head, points, pointn, buildDotSinfo())`.
2. Rename `makeAdjFlatLabeledEdge` → `makeAdjFlatNoPortEdge`; body mirrors
   C's no-port branch: collect the no-port adjacent group; if no edge has
   a label → `makeSimpleFlat(group, edgeType(g))`; else →
   `makeSimpleFlatLabels(group, edgeType(g))`; return true. Keep
   declining (`return false`) only when `!isAdjFlatCandidate(e)`.
3. Update the one caller in `edge-route.ts` (line ~314).

Keep functions <=30 lines / CCN<=10; extract a `simpleFlatPoints(tp, hp,
dy, et)` helper if needed.

## Write-set

- `src/layout/dot/splines-flat-labeled.ts`
- `src/layout/dot/edge-route.ts` (one call site rename)
- `src/layout/dot/splines-flat-labeled.test.ts`

## Read-set

- `src/layout/dot/splines-flat-labeled.ts:245-275` (makeSimpleFlatLabels,
  dispatcher) — the pattern to mirror
- `~/git/graphviz/lib/dotgen/dotsplines.c:1075-1166`
- `decisions.md#ad-1` and `#ad-2`

## Architecture decisions

AD-1 (route whole no-label group, incl. cnt==1), AD-2 (rename + faithful
dispatch). Locked.

## Acceptance criteria

- Given `{rank=same a b} a->b; a->b` (no ports, no labels), when routed,
  then both flats fan via `makeSimpleFlat` (distinct, non-overlapping
  beziers) and match `dot -Tsvg` 15.0.0 byte-for-byte (oracle pin).
- Given a single unlabeled adjacent flat, when routed, then all existing
  goldens stay byte-identical.
- Given `npx vitest run`, then pass count >= 1852 with zero regressions.

## Observability

N/A — no new observable operations (browser library).

## Rollback

Reversible — revert the task commit. No migration.

## Comparison page

Create `comparisons/dot-9-parallel-flat.md`: the DOT input, the oracle
`dot -Tsvg` path data, the port's output, and a byte-diff verdict.
Reference it in `decision-journal.md`. The task is not done without it.

## Commit

`feat(T1): port makeSimpleFlat for unlabeled adjacent flat groups`
