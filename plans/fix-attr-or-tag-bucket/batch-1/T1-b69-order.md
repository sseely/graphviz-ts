<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — b69 spline append order

## Context
b69 (concentrate): multi-path edge groups hold the same 2 splines in
swapped order vs oracle (checked g[84]; likely systematic). compareSvg
is positional → large fake deltas. Candidates: clip_and_install append
order per orig edge (splines-clip.ts), per-entry run routing order
(b15-per-entry memory), concentrate trunk append (2559 memory).

## Task
Trace which producer emits each path on both sides (C: dotsplines.c
make_regular_edge per-ENTRY loop + clip_and_install per-orig append;
port equivalents). Pin why the port's install order differs. Mechanism
per diagnosis.md.

## Read-set
src/common/splines-clip.ts; src/layout/dot/edge-order.ts,
edge-route-chain.ts (as reached); ~/git/graphviz/lib/dotgen/dotsplines.c.
Memories: b15-per-entry-run-routing-done, concentrate-trunk-2559-done,
edge-routing-order-done.

## Acceptance criteria
- Given instrumentation, then each path in a differing group is
  attributed to (orig edge, install site, sequence position) on both sides.
- Given the mechanism, then ruledOut ≥1 with evidence.

## Rollback / Observability
N/A — diagnosis. Reversible.

## Commit
`docs(T1): b69 append order — <mechanism>`
