# G4 flat labeled edge — full root-cause chain (2026-06-16)

Branch feature/dot-flat-labels. Goal: `rank=same` labeled edge must emit its
label `<text>` (corpus: adjacent TS 2/dot 3; non-adjacent TS 3/dot 4).

## The machinery is ported but mis-wired — layered causes

1. **position.ts stubbed `flatEdges`.** `position.ts:183` had a local
   `export function flatEdges(_g){return false;}` that **shadowed** the real
   `flat.ts:flatEdges`. So `flatNode`/`abomination` never ran. Fix: import the
   real one (done — byte-safe, 1793/1793, 115 goldens identical).

2. **`rank[0].flat` never set → abomination skipped → flatNode crashes on
   rank[-1].** With (1) fixed, `flatNode` fires but `makeVnSlot(g, r-1, …)` is
   called with `r-1 = -1` for a rank-0 flat edge. C inserts a rank first via
   `abomination`, gated on `GD_rank(g)[0].flat` (flat matrix). In TS that matrix
   is **undefined** post-mincross: `flatBreakcycles` (mincross-build.ts, builds
   `rk.flat`) runs in mincross pass 0 BEFORE the flat edges are populated into
   `flat_out`. Timing probe: maxphase=1 flat_out=0; maxphase=2 flat_out=3 but
   rank0.flat=undef. So `needsAbomination` (flat.ts) returns false.

3. **`make_flat_labeled_edge` unported + undispatched** (dotsplines.c:1314).
   Even once the vnode exists, `makeFlatEdge` does not dispatch to it, and the
   label-pos/emission chain (ND_alg loop dotsplines.c:283-291) is unverified.

4. **Adjacent flat labeled edge** (a,b adjacent) routes via make_flat_adj_edges,
   not make_flat_labeled_edge; its label is also dropped (separate path).

## Fix options for cause 2 (golden-risk ranking)
- **A (faithful, higher risk):** fix mincross so flat edges are in `flat_out`
  before `flatBreakcycles` builds `rk.flat` — matches C order. Touches mincross.
- **B (byte-safe, in flat.ts):** make `needsAbomination` detect a rank-0
  non-adjacent labeled flat edge directly via `flat_out` (populated by
  position-time) instead of the `rk.flat` proxy. No mincross change; only
  affects graphs with rank-0 flat labels (none in the 115 goldens).

## Confirmed
- Wiring fix (cause 1) is byte-safe: tsc 0, 1793/1793, 115 goldens identical.
- This is the `mission-dot-flat-labels` mission (multi-file, ranking-phase).
- See [[dot-edge-multi-g1-g4]] (G4 was deferred from dot-edge-multi).
