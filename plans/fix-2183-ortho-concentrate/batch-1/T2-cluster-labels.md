<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — Root-cause the 3 missing cluster labels (A/B/C)

## Context
Oracle emits `<text>A/B/C` for the 3 clusters; port emits none. Cluster
polygons ARE emitted (3/3). Unknown whether the label is never placed
(layout) or never emitted (gvc/device-cluster.ts).

## Task
First isolate: render 2183 minus `splines=ortho` (and minus concentrate)
to see which attribute suppresses the labels in the port. Then trace the
port's cluster-label pipeline (placement → GD_label pos → emit) and pin
the missing stage vs C (emit.c / cluster.c refs). Mechanism per
diagnosis.md.

## Read-set
src/gvc/device-cluster.ts; cluster label placement in src/layout/dot/
(as reached); ~/git/graphviz/lib/common/emit.c (emit_clusters path),
lib/dotgen/cluster.c. Memory: cluster-layout-fixes-done,
1323 (label-less nested clusters inherit parent label — related emit path).

## Interface output (consumed by T5)
Same mechanism shape, in .agent-notes/2183-cluster-labels.md.

## Acceptance criteria
- Given 2183 variants (±ortho, ±concentrate), when rendered, then the
  suppressing condition is isolated.
- Given the pipeline trace, then the missing stage is pinned to
  file:line with the C ref it should mirror.

## Observability / Rollback
N/A — diagnosis only. Reversible.

## Commit
`docs(T2): root-cause 2183 missing cluster labels — <mechanism one-liner>`
