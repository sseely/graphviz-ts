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

graphviz-ts routes plain edges with a simplified fitter that is byte-exact to
the 115 goldens; only side-port / flat / steering edges use the faithful
`routeSplines` pipeline. **The new multi-edge / labeled / opposing cases route
through the faithful pipeline; plain single edges keep the simplified fitter.**
The 115 goldens MUST stay byte-identical (none uses a multi/opposing/flat-label
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
  pass: exit 0 AND passed >= 1789 AND failed == 0 AND 115 goldens byte-identical
  on_fail: fix_and_rerun
- command: npx lizard <changed files> -C 10 -L 30 -a 5
  pass: no violations (30 lines/fn, CCN 10, 5 params, 500 lines/file)
  on_fail: fix_and_rerun
- command: git diff --name-only HEAD~1
  pass: within the task's declared write-set
  on_fail: stop
```

Baseline at mission start: **1789 passed / 0 failed, 115 goldens byte-identical**
(main @ a7e2144, 2026-06-16).

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | [T1 flat-labeled-edge (G4)](batch-1/T1-flat-labeled-edge.md) — **DEFERRED** (ranking-phase vnode creation out of scope; see [comparisons/flat-labeled-edge.html](comparisons/flat-labeled-edge.html)), [T2 make_regular_edge multi (G1 core)](batch-1/T2-make-regular-edge-multi.md) | [ ] |
| 2 (after T2) | [T3 edge-grouping + opposing pins (G1 wiring)](batch-2/T3-opposing-edge-grouping.md) | [ ] |

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

## Links

- [decisions.md](decisions.md) — architecture decisions
- [diagrams/component-map.md](diagrams/component-map.md) — routing dispatch map
- [decision-journal.md](decision-journal.md) — appended during execution
- [Corpus findings](../layout-engine-backlog/route-reverification.md)
