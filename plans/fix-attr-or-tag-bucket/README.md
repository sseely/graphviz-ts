<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: attr-or-tag divergence bucket — b15, b69, user_shapes (+ hyphen escaping)

**Status: NOT STARTED (authored 2026-07-02).**

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
bounded-判定 for b15 at 1-2 files.

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

- [ ] [Batch 1 — gated diagnosis](batch-1/overview.md): T1 b69 order,
      T2 b15 coords (D3 classification), T3 user_shapes semantics,
      T4 hyphen escape tables
- [ ] [Batch 2 — fixes](batch-2/overview.md): T5 user_shapes, T6 b69,
      T7 hyphen escaping, T8 b15 (conditional per D3)
- [ ] [Batch 3 — verify + close](batch-3/overview.md): T9

## Index

[decisions.md](decisions.md) · [decision-journal.md](decision-journal.md)
· [diagrams/component-map.md](diagrams/component-map.md)

## Operational readiness (approved)

Library port: SLIs/on-call N/A (survey+gate is the observability).
Rollback: **Reversible**. Note: hyphen escaping touches every emitted
SVG byte stream — corpus baselines regenerate; verdicts must not move.
