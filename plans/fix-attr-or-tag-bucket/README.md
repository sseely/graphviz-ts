<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: attr-or-tag divergence bucket — b15, b69, user_shapes (+ hyphen escaping)

**Status: COMPLETE (2026-07-02). b69 + user_shapes + bonus 1436 → conformant; b15 D3-disposed (deep, tracked); hyphen escaping landed.**

## Objective

Clear the `attr-or-tag` PARITY bucket. Pre-mission verification
(2026-07-02, fresh renders both sides):

- **graphs-user_shapes** (maxΔ 0): `shapefile="jcr.gif"` nodes — headless
  C falls back to a BOX POLYGON at node dims; port ignores `shapefile`
  and emits the default ellipse. Geometry otherwise exact.
- **graphs-b69** (maxΔ 466): multi-path edge groups emit the SAME two
  splines in SWAPPED order (g[84]: oracle [A,B], port [B,A]) —
  install/append order, not geometry.
- **graphs-b15** (maxΔ 1033): 2-path edge groups, same order, coordinates
  diverge deep in the d string. Prior note (b69-concentrate-undermerge:
  "1pt x-coord amplified") predates 2026-07-02's fixes — re-diagnose.
- **Bonus (user-approved):** port does not escape `-` as `&#45;` in
  emitted text/titles like C — XML-equivalent (invisible to the survey),
  byte-match-relevant. Fix at the xml-escape.ts choke point.

## Branch

`fix/attr-or-tag-bucket` from `main`. Merge commit on completion; keep
branch.

## Constraints (approved 2026-07-02)

- **D1** gated diagnosis (Batch 1) before any src/ edit; per-id artifacts.
- **D2** faithful C at origin; instrument C before hypothesizing; no
  per-graph special cases.
- **D3** b15's deliverable is a PINNED MECHANISM; fix only if bounded
  (≤ ~2 files, faithful, gate-clean); else disposition note + tracked.
- **D4** hyphen escaping in src/render/xml-escape.ts mirroring C's
  per-context escape tables (gvrender_core_svg.c); golden assertion
  syncs allowed in the same commit, journal-logged.

### Stop conditions
- Batch-1 gate (report mechanisms, then continue per approved plan).
- Fix locus outside provisional write-set → ask (never halt).
- Any currently-conformant id regresses → stop.
- The hyphen change flips ANY survey verdict → stop, investigate.
- b15 needs C-bug reproduction or unbounded rewrite → D3 disposition.
- 2 consecutive gate failures on one check; same location 3× → stop.

### Push-forward
Instrumentation, test phrasing, escape-table constants once read from C,
the bounded-vs-deep call for b15 at 1-2 files.

## Quality gates

```
- npx tsc --noEmit                                  | exit 0 | fix_and_rerun
- npx vitest run                                    | exit 0 | fix_and_rerun
- GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json npx tsx test/corpus/survey.ts
  && GVBINDIR=/tmp/ghl npx tsx test/corpus/rules-gate.ts
  | gate exit 0; movers ⊆ {user_shapes, b69, b15}; ≤2 runs | stop
- canary render-one 2475_2 <180s (if routing code changed) | stop
- git diff --name-only within write-sets + baselines | stop
```

Baseline refresh: survey → gate → `cp test/corpus/parity-rules.json
test/corpus/parity.json` → `npx tsx test/corpus/dashboard.ts`.

## Batches

- [x] [Batch 1 — gated diagnosis](batch-1/overview.md): T1 b69 order,
      T2 b15 coords (D3 classification), T3 user_shapes semantics,
      T4 hyphen escape tables
- [x] [Batch 2 — fixes](batch-2/overview.md): T5 user_shapes, T6 b69,
      T7 hyphen escaping, T8 b15 (conditional per D3)
- [x] [Batch 3 — verify + close](batch-3/overview.md): T9

## Index

[decisions.md](decisions.md) · [decision-journal.md](decision-journal.md)
· [diagrams/component-map.md](diagrams/component-map.md)

## Operational readiness (approved)

Library port: SLIs/on-call N/A (survey+gate is the observability).
Rollback: **Reversible**. Note: hyphen escaping touches every emitted
SVG byte stream — corpus baselines regenerate; verdicts must not move.


## Mission summary (2026-07-02)

- **T6/T6b (b69):** two mechanisms — the routing list must sort with C's
  unstable qsort permutation (gvQsort; equal-key concentrate entry runs),
  and each bezier's arrowheads emit inside the per-bezier loop. b69's
  SVG groups are 100% byte-identical to the oracle; **1436 (also
  concentrate) went conformant as a bonus**.
- **T5 (user_shapes):** shapefile ⇒ C's custom-box fallback + C-format
  warning. Conformant.
- **T7 (hyphen):** escapeXmlTitle ({dash,nbsp}) at all title emitters +
  class values; titles byte-match C; zero verdict movement (as required).
- **T2/T8 (b15):** classified DEEP per D3 — record-port attachment
  resolution under concentrate (1332-adjacent); artifact
  .agent-notes/b15-record-port-resolution-deep.md seeds the follow-up.
  b15 remains a tracked gap (maxΔ 67.9, was 1033 + fake order noise).
- **Gates:** survey ×2 (at cap), gate PASS ×2, 0 regressions; canary
  18s; oracle byte-verified; tsc 0; vitest 2556/2556.
  Corpus: **598 conformant / 162 structural-match / 17 diverged**.
