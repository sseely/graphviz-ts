# Mission — edge-port attachment parity

**Objective:** Make edges attach at declared port points — compass
directions, record-field ports, and (via html_port) HTML-cell ports —
instead of always entering/leaving at node centers. DOT syntax
(`A:port:compass`, `A:compass`) and attribute syntax
(`headport=`/`tailport=`) are already parsed; this mission wires them
into `ED_tail/head_port` and makes `compassPort`, `poly_port`,
`record_port`, `resolvePort`, and the spline attachment point real.
HTML-cell ports (`html_port`) are included as T7 with an explicit
dependency gate on the html-labels mission completing `portToTbl`.

Recon evidence: [SCOPE.md](SCOPE.md) — verified gap table, C spec map
(file:line + LOC), oracle probes (Probe 1 & 2), and batch sketch.

## Branch

`feature/parity-edge-ports` off `feature/post-parity`. Merge back with
a **merge commit** when all gates pass, on Scott's go-ahead.

## Canonical rules

- C source at `~/git/graphviz/lib/` (tag 15.0.0) is the spec; refs
  only from the installed 15.0.0 `dot` binary.
- NEVER modify existing refs, manifest entries, or tolerances;
  additions APPEND (carried AD-C1).
- One commit per task; re-read this README + decision-journal.md after
  every compaction.
- Agent prompts MUST include the hook rule: "if a pre-commit/length/CCN
  hook complains, smallest fix, at most 2 attempts per file, then move
  on." Hook limits: 30 lines/function, CCN 10, 5 params, 500 lines/file.

## Quality Gates (after every task)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0 AND failed == 0 AND passed >= 1466
  on_fail: fix_and_rerun
- command: OUTDIR=/tmp/ep-x npx tsx .probes/render-all.ts + byte-diff vs pre-task baseline
  pass: existing goldens byte-identical (82 until T8 lands, ~92 after)
  on_fail: stop
- command: git diff --name-only HEAD~1..HEAD
  pass: within the task's declared write-set
  on_fail: stop
```

Baseline at mission start: **1466 passed / 0 failed**, 82 goldens
(2026-06-13, post-M12-follow-up + render-styling merge assumed).

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 (serial — T1 before T2) | [T1 port struct + parser wiring](batch-1/T1-port-parser.md), [T2 chkPort + edge init port block](batch-1/T2-chkport-init.md) | [x] |
| 2 (parallel — T3 and T4 are independent) | [T3 compassPort + poly_port](batch-2/T3-compassport.md), [T4 map_rec_port + record_port](batch-2/T4-record-port.md) | [ ] |
| 3 (serial — T5 consumes T3; T6 after T5) | [T5 resolvePort + closestSide](batch-3/T5-resolveport.md), [T6 spline attachment](batch-3/T6-spline-attach.md) | [ ] |
| 4 (T7 gated on html-labels portToTbl) | [T7 html_port + poly_port HTML branch](batch-4/T7-html-port.md) | [ ] |
| 5 (after 3; T7 optional for T8) | [T8 goldens + C-oracle verify](batch-4/T8-goldens.md) (orchestrator inline) | [ ] |

## Stop conditions

- Change outside the active task's write-set
- 2 consecutive gate failures on the same check; same location/approach
  changed 3+ times for the same failure
- Implementation contradicts AD1–AD6 ([decisions.md](decisions.md))
- A divergence from the C oracle traces to code outside this mission's
  blast-radius (no silent fixes — open a separate write-set approval)
- T7: `portToTbl` not yet ported from html-labels mission — stop T7
  and proceed to T8 without html-port coverage; golden count ≈ 90 not
  92
- Numeric divergence with an FMA signature without disassembly evidence
  (src/common/fma.ts precedent)
- Port geometry for a node shape (ellipse, diamond, triangle) diverges
  and traces to `poly_port` calling into unported `inside_t` context
  — journal and continue with polygon default

## Push-forward conditions (journal entry each)

- Hook-forced module splits; C function boundaries + @see preserved
- Probe design under .probes/ (untracked)
- Test-fixture repairs in files the task owns
- `compassPort` split across multiple files when the 30-line/fn limit
  fires (the C function is ~183 LOC)
- Trivially obvious fallback-chain fixes within a task's own files
- Golden tolerance set to 0.5 pt (matching html-label precedent) when
  port moves endpoint by >1 pt vs. no-port baseline

## Key references

- [SCOPE.md](SCOPE.md) — recon: gap table, C spec map, oracle probes
- [decisions.md](decisions.md) — AD1–AD6 + carried rules
- [decision-journal.md](decision-journal.md) — append-only log
- [diagrams/component-map.md](diagrams/component-map.md)
- [diagrams/data-flow.md](diagrams/data-flow.md)
- C spec entries (all verified at tag 15.0.0):
  - `lib/common/types.h:48` — `port` struct (p, theta, bp, defined,
    constrained, clip, dyna, order, side, name)
  - `lib/common/utils.c:489` — `chkPort`
  - `lib/common/utils.c:548–566` — `common_init_edge` port block
  - `lib/common/shapes.c:2698` — `compassPort` (~183 LOC)
  - `lib/common/shapes.c:2880` — `poly_port`
  - `lib/common/shapes.c:3716` — `map_rec_port`
  - `lib/common/shapes.c:3732` — `record_port`
  - `lib/common/shapes.c:4248` — `closestSide`
  - `lib/common/shapes.c:4322` — `resolvePort`
  - `lib/common/htmltable.c:873` — `portToTbl`
  - `lib/common/htmltable.c:916` — `html_port`
  - `lib/common/splines.c:378` — `beginpath` (port offset at line 393)
  - `lib/common/splines.c:575` — `endpath`
- plans/parity-m12-html-labels/ — html_port dependency context
