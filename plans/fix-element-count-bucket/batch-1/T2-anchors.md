<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — missing anchors (1880, 2619_1, 2619_2)

## Context
1880: port missing 2 <a> (+2 g). 2619_1/2: missing 4 <a>, -1 polygon,
+1 path; firstDiff `g[1]/g[1]/a[1][childCount]` — anchors nested in
node/edge groups. Prior work: url-anchors memory (graph/cluster/edge/
edge-label anchors DONE) — these are an unhandled context (node URL?
label-only anchor? head/tail URL? tooltip-driven?).

## Task
Diff the anchor sets (which object, which href/title) both sides for
all 3 inputs; pin the unhandled context(s) + C refs (emit.c obj URL
handling / gvrender begin_anchor sites). Note whether 2619's ±path/
polygon deltas are downstream of the anchor nesting or separate.

## Acceptance criteria
- Given the diffs, then every missing anchor is attributed to a named
  unhandled URL context with C ref; the ±1 path/polygon is classified.

## Rollback/Observability: N/A. Reversible.
