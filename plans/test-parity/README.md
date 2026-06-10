# Project: Full Test Parity (44 failures → 0)

**Objective:** Make every remaining test pass — 42 golden tests across 7
layout engines plus 2 unit tests — by porting the C graphviz behavior
faithfully. The test is the path forward: code changes until tests pass,
and the suite must stay green after every task (no regression of any
currently-passing test, especially the 11 dot goldens).

This is a **project of 8 sequential missions**, each independently
executable as a mission brief. Run one mission per autonomous session.

## Canonical rules (apply to every mission)

- The C source at `~/git/graphviz/lib/` is the spec. Port it; never
  invent. Every ported symbol gets a `@see` reference.
- NEVER modify `test/golden/refs/*`, `test/golden/compare.ts`
  tolerances, or `manifest.json`. If a ref seems wrong, STOP and report.
- Quality gates after every task (see below). A task is not done until
  the gates pass.
- Re-baseline at mission start: run the suite, record counts in
  `decision-journal.md`, prune the mission's failure list (earlier
  missions may have already fixed some).
- Per `~/.claude/rules/autonomous-execution.md`: one commit per task,
  re-read this README + decision-journal.md after every compaction.

## Branch

Work each mission on `feature/parity-m<N>-<name>` branched from
`feature/ts-port`; merge back with a **merge commit** when the
mission's gates pass.

## Quality Gates (run after every task)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: failure count <= count recorded at mission start, and no test
        that passed at mission start now fails (compare names, not counts)
  on_fail: fix_and_rerun
- command: git diff --name-only HEAD~1
  pass: output within declared write-set (src/common/* and
        src/layout/pack/* allowed with a decision-journal entry)
  on_fail: stop
```

Baseline at project start: **957 passed / 44 failed** (see
[baseline.md](baseline.md) for the full failure inventory).

## Missions

| # | Mission | Tests | Status |
|---|---------|-------|--------|
| 1 | [Shared node sizing](mission-1-node-sizing/overview.md) | cross-cutting | [x] |
| 2 | [osage](mission-2-osage/overview.md) | 6 golden | [ ] |
| 3 | [patchwork](mission-3-patchwork/overview.md) | 6 golden | [ ] |
| 4 | [twopi](mission-4-twopi/overview.md) | 5 golden + 1 unit | [ ] |
| 5 | [circo](mission-5-circo/overview.md) | 6 golden + 1 unit | [ ] |
| 6 | [neato](mission-6-neato/overview.md) | 7 golden | [ ] |
| 7 | [fdp](mission-7-fdp/overview.md) | 6 golden | [ ] |
| 8 | [sfdp](mission-8-sfdp/overview.md) | 5 golden | [ ] |

Missions must run in order (1 → 8). Within missions 2–8, T1 is always
recon: it produces `gap-analysis.md` and the concrete port-task specs
for that mission before any code changes.

## Stop conditions

- Change needed outside the mission write-set (except `src/common/*`,
  `src/layout/pack/*` — push forward with a journal entry)
- 2 consecutive gate failures on the same check, or same location
  changed 3× without resolving the same failing test
- A previously passing golden regresses and isn't fixed in 2 attempts
- C behavior ambiguous, or a ref appears generated with different
  settings than the C source implies
- An iterative engine (m6–m8) converges to a different-but-valid
  symmetric layout and the 0.5pt tolerance looks unreachable —
  document evidence, stop
- Any temptation to touch refs/tolerances/manifest

## Push-forward conditions

- Small shared-code fixes needed by the current engine (journal entry)
- Unit test contradicts C-derived behavior → fix the unit test (D5)
- Obvious bug found in already-ported shared code, with suite-green proof
- Stylistic/naming choices inside ported code

## Key references

- [decisions.md](decisions.md) — architecture decisions D1–D5
- [baseline.md](baseline.md) — failure inventory with first-diff values
- [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md) — append-only execution log
- Debugging hangs: see `.agent-notes/cluster-hang-2026-06.md`
  (use `node --prof` on an esbuild bundle; never guard-bisect)
- Reference SVG metrics: FreeType at 96 dpi — glyph advances are
  integer pixels × 0.75pt; Times ascent 17px @14pt (12.75pt). Already
  modeled in `src/common/textmeasure.ts`.
