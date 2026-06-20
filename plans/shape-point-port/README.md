<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: port `shape=point` node rendering

## Objective

Port the C `point` shape (`lib/common/shapes.c` `point_init`/`point_gencode`)
into graphviz-ts. The port registers `point` (Shapes[5]) with the generic
`POLY_FNS` and `kind: SH_POINT`, but **`SH_POINT` is never branched on**, so a
point node is sized and drawn as an ordinary ellipse — full default size,
`fill=none`, and the label rendered. C gives it `DEF_POINT=0.05in` size (rx
1.8pt), default-black fill, and **no label**. The wrong (too large) size
cascades into layout positions and edge routes, so this is a correctness fix,
not cosmetics. This is the cleanest coherent sub-cause of the `element-count`
parity bucket (130 cases; ~11 use `shape=point`).

## Root cause (already diagnosed)

- Synthetic repro: `digraph { a [shape=point]; b; a->b; }`.
  - Oracle `a`: `<ellipse fill="black" cx=27 cy=-73.8 rx=1.8 ry=1.8/>` — tiny,
    filled, no label.
  - Port `a`: `<ellipse fill="none" cx=27 cy=-90 rx=18 ry=18/>` + `<text>a</text>`
    — default size, unfilled, labelled.
- Three defects: (1) size ignores `DEF_POINT`; (2) fill not defaulted black;
  (3) label not suppressed.

## Branch

`fix/shape-point` off `main`.

## Key facts that make this tractable

- `point` is already registered with `kind: SH_POINT` (`shapes.ts:83`) — no
  registry change needed; the branch reads the bound shape's `kind`.
- Node sizing is resolved in `src/common/nodeinit.ts` (the `poly_init` port).
- Node rendering + label emit is in `src/common/poly-gencode.ts` (`renderLabel`).
- The port already renders `point` as an `<ellipse>` (`sides≤2`); `poly_inside`
  already has the ellipse branch (AD-5: reuse, verify).
- C constants: `DEF_POINT=0.05`, `MIN_POINT=0.0003` (`shapes.c:42,47`).

## Constraints

See [decisions.md](decisions.md) for AD-1…AD-5 (all approved).

**STOP conditions:**
- A file outside the write-set needs changing — EXCEPT `src/common/poly-inside.ts`
  is pre-authorized IF point edge-clipping / peripheries-outline diverges (AD-5).
- Any parity regression that is not strict re-bucketing to an equal-or-better
  verdict (0-regression rule; memory `bucket-fix-rebucketing`).
- The point-size change destabilizes layout broadly — more than a handful of
  graphs WITHOUT point nodes change verdict.
- Same divergence approached 3× without resolving; or 2 consecutive gate
  failures on the same check.
- Any of AD-1…AD-5 would have to be contradicted.

**PUSH FORWARD on own judgment:** port the peripheries/penwidth-outline or
`point_inside` branch if verification requires it (AD-5); golden tolerance class
(`deterministic`) + which corpus winner to pin; complexity-hook helper
decomposition; fixing pre-existing 1–3 line violations in edited files.

## Quality gates

```
- command: npx vitest run            # pass: exit 0, all tests pass; on_fail: fix_and_rerun
- command: npx tsc --noEmit          # pass: exit 0; on_fail: fix_and_rerun
- command: npx tsx test/corpus/survey.ts && per-id delta check vs baseline
                                     # pass: 0 verdict regressions; on_fail: stop
- command: git diff --name-only HEAD~1   # pass: only write-set files; on_fail: stop
```

Oracle for goldens: `~/git/graphviz/build/cmd/dot/dot` with
`GVBINDIR=/tmp/gvplugins` (dot 15.1.0). Baseline parity = a fresh
`test/corpus/survey.ts` snapshot at the branch point (geometry == pre-mission).

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| [batch-1](batch-1/overview.md) | T1 shape=point sizing + fill + label suppression | [ ] |
| [batch-2](batch-2/overview.md) | T2 golden + parity verification | [ ] |

## Index

- [decisions.md](decisions.md)
- [diagrams/data-flow.md](diagrams/data-flow.md)
- [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)
