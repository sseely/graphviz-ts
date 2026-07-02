<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: b15 record-port resolution — root cause and fix

**Status: NOT STARTED (authored 2026-07-02).**

## Objective

`graphs-b15` is the last member of the former attr-or-tag bucket:
`diverged`, maxΔ 67.9, **4 edge groups** with wrong record-port
attachment. Seed diagnosis (2026-07-02, fix-attr-or-tag-bucket):
`.agent-notes/b15-record-port-resolution-deep.md` — node geometry
byte-conformant, 144/148 edge groups byte-identical; the 4 residuals
diverge at the resolved tail-port `(p, side)` at beginpath (3 edges) or
later (FlightToHover:Target). Root-cause via port-write provenance
tracing, fix faithfully, restore b15 toward conformant with 0 parity
regressions.

## Leading hypotheses (discriminate in T1 — do not assume)

- **H1 sameport eligibility**: C's sameport replaces field ports with a
  centroid struct (`dyna=false, side=0`, sameport.c:149-175) per
  edge+chain segment — which edges get sameport'd may differ.
- **H2 reference-sharing**: port's `sameport.ts:146-147` assigns ONE
  shared `Port` object where C copies structs by value; a later
  write/mutation observed by siblings corrupts them (both FPM* edges
  show the IDENTICAL wrong value `(-39.14,-18)`).
- **H3 resolvePort persistence/target**: beginpath/endpath per-edge
  resolution (splines-path-begin.ts:224 / splines-path-end.ts:214)
  persists onto shared state or resolves toward the wrong node.

## Branch

`fix/b15-record-ports` from `main`. Merge commit; keep branch.

## Constraints (approved 2026-07-02)

- **D1** gated hypothesis-discriminating diagnosis before any src/ edit.
- **D2** faithful C at origin; C's copy-by-value port-struct semantics
  are the spec; instrument C before hypothesizing further.
- **D3** evidence-scoped fixes only; unimplicated reference-sharing
  sites → journal observations, not speculative edits; reuse copyPort.
- **D4** no silent partials: FlightToHover:Target ends mechanism-fixed
  or explicitly classified with evidence (comparison page if deferred).

### Stop conditions
- Batch-1 gate (report mechanisms, then continue per approved plan).
- Fix locus outside provisional write-set → ask (never halt).
- Any currently-conformant id regresses → stop.
- H1 traces to an upstream layout difference (mincross/positions), not
  port-assignment machinery → stop, re-scope.
- Same location 3× same failure; 2 consecutive gate failures → stop.

### Push-forward
Instrumentation formats; copyPort reuse; collapsing T3+T4 into one
commit if they share the root; test phrasing.

## Quality gates

```
- npx tsc --noEmit                                   | exit 0 | fix_and_rerun
- npx vitest run                                     | exit 0 | fix_and_rerun
- GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json npx tsx test/corpus/survey.ts
  && GVBINDIR=/tmp/ghl npx tsx test/corpus/rules-gate.ts
  | gate 0 regressions; movers ⊆ {graphs-b15} (+explained b51 bonus); ≤2 runs | stop
- canary render-one 2475_2 <180s (if routing code changed) | stop
- C tree reverted + oracle byte-verified after instrumentation | stop
- git diff --name-only within write-sets + baselines | stop
```

Baseline refresh: survey → gate → `cp test/corpus/parity-rules.json
test/corpus/parity.json` → `npx tsx test/corpus/dashboard.ts`.
CWD DISCIPLINE: run every npx/tsx command from the repo root with
absolute input paths — C-side `cd`s persist in the shell and have
repeatedly misdirected renders (see attr-or-tag journal).

## Batches

- [ ] [Batch 1 — gated diagnosis](batch-1/overview.md): T1 provenance
      trace, T2 FlightToHover late divergence
- [ ] [Batch 2 — fixes](batch-2/overview.md): T3 pinned-origin fix,
      T4 FlightToHover fix-or-disposition
- [ ] [Batch 3 — verify + close](batch-3/overview.md): T5

## Index

[decisions.md](decisions.md) · [decision-journal.md](decision-journal.md)
· [diagrams/component-map.md](diagrams/component-map.md) · seed:
`.agent-notes/b15-record-port-resolution-deep.md`

## Operational readiness (approved)

SLIs/on-call N/A — survey+gate is the observability. Rollback:
**Reversible**. Target: b15 → conformant/structural-match with residual
explained.
