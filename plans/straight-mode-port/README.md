<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: straight-mode segmentation for long edges

## Objective

Port the unported **straight-mode** segmentation of C's `make_regular_edge`
(`lib/dotgen/dotsplines.c:1771-1840`, helpers `straight_len`/`straight_path`
:2024+). Long multi-rank edges with a collinear run of virtual nodes are
currently routed as a single spline that **bows** out of the corridor; C splits
them into spline-top + straight-middle + spline-bottom, hugging the corridor.
This is the dominant dot parity bucket (137 `path/@d` cases). After this mission,
long edges match the oracle's piecewise geometry.

## Root cause (already diagnosed)

- Minimal repro: `digraph { a->b->c->d->e->f; a->f; }` (L5). `a->d` (L3) and
  `a->e` (L4) conformant today; L5 diverges — the bow appears once a collinear
  vnode run reaches the straight_len threshold.
- C routes `a->f` as TWO `routesplines` calls (5 boxes each), straight-lining the
  middle; the port does ONE call over all 9 boxes → coarse bowed fit.
- See memory `long-edge-bow-straight-mode` for the full box-dump evidence.

## Branch

`feature/straight-mode-segmentation` off `main`. (Note: the cluster-containment
fix lives on `fix/cluster-contain-nodes-vstart`; rebase onto whichever lands in
main first, or branch from main and accept independent diffs — both touch
different functions.)

## Key facts that make this tractable

- `straightLen` is ALREADY ported (`splines-route.ts:99`) — just unwired.
- `routeSplines` ALREADY consumes `Port.constrained`/`Port.theta` endpoint
  slopes (`splines-routespl.ts:299-303`) — no type work needed.
- `buildChainPath` is shared by forward (`routeMultiRankEdgeFaithful`) AND back
  (`faithfulBackFwdPoints`) edges — one focal point.
- `has_labels & EDGE_LABEL` available via `g.info.has_labels` (`rank.ts:28`).
- `routeRegularByType(P, et)` dispatches SPLINE→`routeSplines` per segment.

## Constraints

See [decisions.md](decisions.md) for AD-1…AD-4 (all approved).

**STOP conditions:**
- A file outside the write-set needs changing.
- T2a is not conformant (the no-op refactor must be pure).
- T2b causes any parity regression that is not strict re-bucketing to an
  equal-or-better verdict (0-regression rule; see memory `bucket-fix-rebucketing`).
- The segmented walk hangs / times out on any corpus input.
- Same spline divergence approached 3× without resolving (consecutive-fix rule).
- An architecture decision would have to be contradicted.

**PUSH FORWARD on own judgment:** helper decomposition / file split for the
complexity hook; which corpus winners to add as goldens; golden tolerance class
(`deterministic`); fixing pre-existing 1–3 line violations in edited files.

## Quality gates

```
- command: npx vitest run            # pass: exit 0, all tests pass; on_fail: fix_and_rerun
- command: npx tsc --noEmit          # pass: exit 0; on_fail: fix_and_rerun
- command: npx tsx test/corpus/survey.ts && node per-id-delta check
                                     # pass: 0 regressions vs baseline; on_fail: stop
- command: git diff --name-only HEAD~1   # pass: only write-set files; on_fail: stop
```

Oracle for goldens/box-dump: `~/git/graphviz/build/cmd/dot/dot` with
`GVBINDIR=/tmp/gvplugins` (dot 15.1.0). Baseline parity = `git show
HEAD:test/corpus/parity.json` before edits.

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| [batch-1](batch-1/overview.md) | T1 straightPath, T2a no-op refactor | [x] |
| [batch-2](batch-2/overview.md) | T2b straight-mode segmentation | [x] |
| [batch-3](batch-3/overview.md) | T3 goldens + parity verification | [x] |

## Index

- [decisions.md](decisions.md)
- [diagrams/data-flow.md](diagrams/data-flow.md)
- [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)
