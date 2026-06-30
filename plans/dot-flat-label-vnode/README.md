# Mission: dot flat-edge label vnode (DOT-12 + DOT-10)

## Objective

Make port-bearing adjacent labeled flat edges emit their label at the
dot 15.0.0 position. The spline is already conformant (DOT-11a, merged);
only the label is wrong/dropped. A deep C-instrumented dive (2026-06-17)
pinned the root cause:

**TS's aux label virtual node is never repositioned onto the routed
spline.** In C's aux `dot_splines_`, routing the labeled cross-rank edge
via `make_regular_edge` moves the label vnode onto the spline (x
**33→11.71**); TS leaves it at its position-phase x (51). The label is
placed at `vnode.x + dimen.y/2`, so TS's label lands ~26pt too high. The
coordinate-origin offsets wash out for the spline (via `del`) but not for
the un-repositioned label vnode.

- **T1 (DOT-12):** port C's `make_regular_edge` label-vnode reposition so
  the aux label vnode lands on the spline.
- **T2 (DOT-10):** trivial copy-back (`copyFlatLabel`), correct once T1
  lands.

## C ground truth (label vnode, input `{rank=same; a b} a:e->b:w[label="x"]`)

| Stage (aux) | C | TS |
|---|---|---|
| midx / midy | 45 / 0 | 72 / 18 |
| post-position | (33, 66.38) | (51, …) |
| post-reposition | (33, 45) | (51, 72) |
| **after routing loop** | **(11.71, 45)** | (51, 72) |
| label.pos pre-postproc | (19.96, 45) | (59.25, 72) |
| label.pos post-postproc | (87.75, 37.96) | (60.75, 59.25) |
| **final label** | **(72, −32.91)** | (72, −54.2) |

Oracle spline (already conformant on main):
`M54,-18C62.13,-18 60.91,-26.42 68.62,-29 71.47,-29.95 72.53,-29.95 75.38,-29 78.03,-28.11 79.62,-26.54 80.91,-24.85`

## C-instrumentation harness (validated)

The dot layout engine lives in a plugin loaded from `GVBINDIR`, NOT
`libgvc`. To instrument C:
1. Edit `~/git/graphviz/lib/dotgen/dotsplines.c` (back up first).
2. `cd ~/git/graphviz/build && make dotgen && make gvplugin_dot_layout`
3. `cp -f plugin/dot_layout/libgvplugin_dot_layout*.dylib /tmp/gvplugins/`
4. Run: `printf '<dot>' | GVBINDIR=/tmp/gvplugins ./build/cmd/dot/dot -Tsvg 2>&1 >/dev/null | grep DBG`
5. Restore source + rebuild + re-copy to clean the oracle.

## Branch / merge

- Branch: `feature/dot-flat-label-vnode`; merge commit to `main`.

## Constraints (stop / push-forward)

**STOP when:** any existing golden churns; the fix would change
regular-edge (non-aux) label placement and risk the 1855 goldens; 2
consecutive gate failures; same location changed 3× without resolving; a
fix needs a file outside the write-set.

**PUSH FORWARD when:** hook-limit split; purely stylistic choice.

## Quality gates

- `npx tsc --noEmit` → exit 0
- `npx vitest run` → ≥ 1855, zero regressions / golden churn
- `git diff --name-only main` → only task write-sets (+ plans/)
- Hook limits: 30 lines/fn, CCN 10, 5 params, 500/file.
- Comparison page per new case, referenced in the journal.

## Baseline (2026-06-17, main)

- `npx tsc --noEmit` → 0 · `npx vitest run` → 1855 passed.

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | T1 (DOT-12), T2 (DOT-10) | [x] |

## Outcome (2026-06-17) — DONE

Both DOT-12 and DOT-10 fixed. The port-bearing labeled flat
`a:e->b:w[label="x"]` now emits its label at **(72, −32.91)**, conformant
to dot 15.0.0. Root cause was the un-ported `recover_slack` (the aux label
vnode was never repositioned onto its spline). 1856 pass, zero golden
churn. Merged to main.

## Index

- [decisions.md](decisions.md)
- [batch-1/overview.md](batch-1/overview.md)
- [batch-1/T1-vnode-reposition.md](batch-1/T1-vnode-reposition.md)
- [batch-1/T2-label-copyback.md](batch-1/T2-label-copyback.md)
- [decision-journal.md](decision-journal.md)
