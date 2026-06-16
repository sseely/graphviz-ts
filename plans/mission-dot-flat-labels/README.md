# Mission: dot-flat-labels (G4)

## Objective

A `rank=same` labeled edge must emit its label `<text>` and route around the
label, matching dot. This is the **G4** gap deferred from `mission-dot-edge-multi`.
Corpus divergence: adjacent `{rank=same a b} a->b[label=x]` renders TS 2 texts /
dot 3; non-adjacent `{rank=same a->c->b[style=invis]} a->b[label=x]` TS 3 / dot 4.

The C source at `~/git/graphviz/lib/` (tag 15.0.0) is the spec. Port faithfully.
Full root-cause analysis: `.agent-notes/g4-flat-label-rootcause-2026-06.md`.

## Branch

`feature/dot-flat-labels` off `main` (already created, HEAD = main @ 9428409).
Merge back with a **merge commit** when gates pass.

## Execution model

Run with **opus** (`claude-opus-4-8`). Fable 5 is disabled.

## Root cause (4 layers — see agent-note)

1. `position.ts:183` stubs `flatEdges` → shadows the real `flat.ts:flatEdges`.
2. `needsAbomination` gates on the `rk.flat` matrix, which mincross builds before
   `flat_out` is populated → never triggers → `flatNode` crashes on `rank[-1]`.
3. The `abomination` port is broken (C negative-index pointer shift mistranslated:
   duplicates rank0→rank1, `minrank=-1`, `maxrank` not bumped).
4. `make_flat_labeled_edge` (dotsplines.c:1314) is unported + undispatched.

## Quality Gates (run after every task)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0 AND passed >= 1793 AND failed == 0 AND 115 goldens byte-identical
  on_fail: fix_and_rerun
- command: npx lizard <changed files> -C 10 -L 30 -a 5
  pass: no violations (30 lines/fn, CCN 10, 5 params)
  on_fail: fix_and_rerun
- command: git diff --name-only HEAD~1
  pass: within the task's declared write-set
  on_fail: stop
```

Baseline at mission start: **1793 passed / 0 failed, 115 goldens byte-identical**
(main @ 9428409, 2026-06-16). Oracle: `~/git/graphviz/build/cmd/dot/dot` with
`GVBINDIR=/tmp/gvplugins`.

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | [T1 flat label vnode (wiring + abomination rewrite)](batch-1/T1-flat-label-vnode.md) | [x] |
| 2 (after T1) | [T2 make_flat_labeled_edge + dispatch (non-adjacent)](batch-2/T2-make-flat-labeled-edge.md) | [x] |
| 3 (after T2) | [T3 adjacent flat label + oracle pins](batch-3/T3-adjacent-flat-label.md) | [x] |

## Constraints (stop / push-forward)

**Stop and wait for human input when:**
- Any of the 115 goldens changes (byte diff) — hybrid-boundary regression.
- A change is needed outside the task's write-set and isn't in another task's set
  — **especially if the abomination rewrite forces `mincross-build.ts` changes**
  (AD-1 kept it out; if truly required, stop and reconsider).
- The rank-array shift breaks consumers beyond `flat.ts`/`position.ts`.
- Two consecutive gate failures on the same check, or the same location changed
  3× without resolving.
- A case can only pass by editing a ref/oracle value (never alter the oracle).

**Push forward with judgment when:**
- Purely stylistic, no behavioral impact.
- A sub-case reaches dot within tol 0.5 — pin it and move on.
- A sub-case cannot reach parity — quarantine with a comparison page (AD-5) and continue.
- Minor index/off-by-one corrections within the declared write-set.

## Links

- [decisions.md](decisions.md) — architecture decisions
- [diagrams/component-map.md](diagrams/component-map.md) — flat-label dispatch map
- [decision-journal.md](decision-journal.md) — appended during execution
- [Root-cause note](../../.agent-notes/g4-flat-label-rootcause-2026-06.md)
- [Corpus findings](../layout-engine-backlog/route-reverification.md) (G4)
