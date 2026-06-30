# Mission: dot-edge-multi

## Objective

Port the two highest-value dot edge-routing gaps found by the routing
re-verification corpus ([../layout-engine-backlog/route-reverification.md](../layout-engine-backlog/route-reverification.md)),
both in the `lib/dotgen/dotsplines.c` spline family:

- **G1 — multi-edge / opposing / labeled-parallel routing.** dot splays
  multiple edges between the same node pair (and opposing `a->b`/`b->a`) into
  separate lanes and routes labeled-parallel edges around their label virtual
  nodes. graphviz-ts overlaps them (one straight, one malformed). Plain
  unlabeled parallel-x3 already matches, so scope is opposing-direction pairs
  and label-bearing parallels.
- **G4 — flat labeled edges drop the label.** `make_flat_labeled_edge` is
  unported; a `rank=same` labeled edge renders no `<text>`.

The C source at `~/git/graphviz/lib/` (tag 15.0.0) is the spec. Port faithfully;
let the port capture the hard-won nuances — do not paraphrase the algorithm.

## Branch

`feature/dot-edge-multi` off `main`. Merge back with a **merge commit** (not
squash) when gates pass.

## Execution model

Run with **opus** (`claude-opus-4-8`). Fable 5 is disabled by Anthropic at this
time — do not route autonomous execution to it.

## The hybrid constraint (READ — AD2/AD3)

graphviz-ts routes plain edges with a simplified fitter that is conformant to
the 115 goldens; only side-port / flat / steering edges use the faithful
`routeSplines` pipeline. **The new multi-edge / labeled / opposing cases route
through the faithful pipeline; plain single edges keep the simplified fitter.**
The 115 goldens MUST stay conformant (none uses a multi/opposing/flat-label
edge). See [decisions.md](decisions.md).

## Oracle

Built `dot` at `~/git/graphviz/build/cmd/dot/dot` with `GVBINDIR=/tmp/gvplugins`
(15.1.0-dev, geometry identical to 15.0.0). Re-runnable corpus probes:
`.probes/route-corpus.ts`, `.probes/route-diverge.ts`.

## Quality Gates (run after every task)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0 AND passed >= 1789 AND failed == 0 AND 115 goldens conformant
  on_fail: fix_and_rerun
- command: npx lizard <changed files> -C 10 -L 30 -a 5
  pass: no violations (30 lines/fn, CCN 10, 5 params, 500 lines/file)
  on_fail: fix_and_rerun
- command: git diff --name-only HEAD~1
  pass: within the task's declared write-set
  on_fail: stop
```

Baseline at mission start: **1789 passed / 0 failed, 115 goldens conformant**
(main @ a7e2144, 2026-06-16).

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | [T1 flat-labeled-edge (G4)](batch-1/T1-flat-labeled-edge.md) — **DEFERRED** (ranking-phase vnode creation out of scope; see [comparisons/flat-labeled-edge.html](comparisons/flat-labeled-edge.html)), [T2 make_regular_edge multi (G1 core)](batch-1/T2-make-regular-edge-multi.md) ✓ c2cc600 | [x] |
| 2 (after T2) | [T3 edge-grouping + opposing pins (G1 wiring)](batch-2/T3-opposing-edge-grouping.md) ✓ | [x] |

### Outcome (2026-06-16)

- **Opposing `a->b; b->a`** — fully fixed, matches dot ≤0.2pt (was one straight +
  one malformed, pathΔ 53pt). Dedup-by-orig groups it as cnt=2; the back edge
  installs reversed.
- **Labeled-parallel** — edge "1" now conformant to dot (was wiggly, pathΔ
  23pt); both labels render. Edge "2" straight-collapse + label x-positions are
  quarantined (AD-4, [comparisons/labeled-parallel.html](comparisons/labeled-parallel.html))
  — rooted in unported `smode` + position-phase label-vnode x-assignment.
- **Plain edges / 115 goldens** — conformant (AD-2 held). Suite 1793 / 0.
- **T1 / G4** — deferred to its own mission (ranking-phase `flat_node` +
  `abomination`).

> **T1/G4 deferred 2026-06-16** (human decision). The flat label virtual node is
> created in C's ranking phase (`flat.c:flat_node` + `abomination`), not in
> `splines-flat.ts`; faithful G4 needs its own mission. G1 (T2/T3) proceeds here.

## Constraints (stop / push-forward)

**Stop and wait for human input when:**
- A change is needed outside the task's write-set and isn't in another task's set
- Two consecutive gate failures on the same check after fix attempts
- Any of the 115 goldens changes (byte diff) — a regression in the hybrid boundary
- A case can only be made to pass by editing a test assertion rather than the port (never alter a ref/oracle value to fit)
- The C requires behavior with no safe TS equivalent

**Push forward with judgment when:**
- Purely stylistic choice, no behavioral impact
- A divergent case reaches dot within tol 0.5 — pin it and move on
- A case cannot reach parity — quarantine it with a comparison page (see decisions.md) and continue

## Mission summary (2026-06-16)

- **Completed:** T2, T3 (G1). **Deferred:** T1 (G4 — ranking-phase, own mission).
- **Commits:** `1921ad5` (T1 deferral docs), `c2cc600` (T2), `1ebd36d` (T3) on
  `feature/dot-edge-multi`. **Not yet merged** — awaiting sign-off.
- **Gate results:** `tsc --noEmit` exit 0; `vitest run` 1793 passed / 0 failed
  (1789 baseline + 4 new oracle pins); 115 goldens conformant; lizard clean;
  all writes inside declared write-sets.
- **Quarantined (AD-4):** flat-labeled-edge (G4) and labeled-parallel edge "2" +
  label x-positions — comparison pages exist and are referenced in the journal.
- **Decisions flagged for review:** T1 scope (deferred, human-approved); T3
  break-conditions consciously scoped down to a targeted dedup to protect the
  byte gate (see journal).
- **Follow-ups:** (1) G4 flat-label mission (`flat_node` + `abomination`);
  (2) `smode` straight-run collapse in `make_regular_edge`; (3) position-phase
  label-vnode x-assignment for labeled-parallel.

## Links

- [decisions.md](decisions.md) — architecture decisions
- [diagrams/component-map.md](diagrams/component-map.md) — routing dispatch map
- [decision-journal.md](decision-journal.md) — appended during execution
- [Corpus findings](../layout-engine-backlog/route-reverification.md)
