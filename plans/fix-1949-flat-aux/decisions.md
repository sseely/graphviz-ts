# Architecture decisions — fix-1949-flat-aux

## AD-1: C-oracle instrumentation = clean rebuild
- **Context:** the incremental cmake build won't recompile `position.c`/
  `libdotgen`, blocking temp `fprintf` in C `make_flat_adj_edges`.
- **Decision:** clean reconfigure+rebuild (`rm -rf build && cmake … && make`);
  fall back to targeted object deletion only if a full rebuild is too slow.
- **Consequences:** one-time rebuild cost; reliable oracle-side dumps. C
  instrumentation is temporary and reverted after diagnosis (the C repo at
  `~/git/graphviz` is the read-only spec — no committed changes).

## AD-2: pin auxt to source rank faithfully (if confirmed as cause)
- **Context:** C wraps `auxt` in `agsubg(auxg,"xxx")` with `rank=source`; the
  port's `buildFlatAux` omits it.
- **Decision:** faithful port — create a rank=source subgraph in the aux and
  add `auxt` to it — **contingent on Batch-1 confirming rank=source actually
  changes the aux layout**. In the 2-node case it may be inert; if so the real
  cause is elsewhere and this decision is moot (STOP + re-diagnose).
- **Consequences:** stays true to the C spec. If the port's ranker doesn't
  honor rank=source subgraphs, that plumbing gap is itself a finding to raise.

## AD-3: fix scope capped to splines-flat.ts (locked)
- **Context:** `make_flat_adj_edges` is load-bearing across all flat side-port
  edges; the survey gate (789 cases) is the guardrail.
- **Decision:** the fix touches **only** `splines-flat.ts` (+ its test). Any
  change that appears to require `sameport.ts` or elsewhere is a
  **stop-and-check**, not an autonomous edit.
- **Consequences:** bounded blast radius; 0-regression survey gate is the hard
  acceptance bar.

## Rollback
Reversible — pure layout geometry; revert the commit. No data/schema/migration.
