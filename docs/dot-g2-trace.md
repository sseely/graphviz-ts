<!-- SPDX-License-Identifier: EPL-2.0 -->

# G2 trace — compass-port mincross tiebreak (`ports both dense`)

**Repro:** `digraph{a:e->b; a:w->c; a->d}` — backlog G2, the lone routing
re-verification divergence (corpus 24/25).

**Verdict: CONFIRMED.** `tail_port.p.x` is populated (±lw) at mincross time;
the only divergence is the tiebreak **metric** in `accumCross`. AD-4 does **not**
fire. T2 proceeds as scoped.

> Correction to the mission premise: the README/AD-4 expected
> `tail_port.order == 0` ("the ordering signal is lost"). That is **wrong** — see
> §3. `port.order` is populated by C `compassPort` (the angular order) and is
> non-zero (192/64/0). The bug is not a *lost* signal but the *wrong* signal: TS
> ties by the angular `port.order`; C ties by the geometric `p.x`. The fix is
> identical either way.

## 1. C tiebreak (the spec)

`in_cross`/`out_cross` order successor nodes by `ND_order`, breaking an equal-order
tie by the geometric port **`p.x`**:

```c
// lib/dotgen/mincross.c:593  (in_cross)
t = ND_order(agtail(*e1)) - inv;
if (t > 0 || (t == 0 && ED_tail_port(*e1).p.x > ED_tail_port(*e2).p.x))
    cross += ED_xpenalty(*e1) * cnt;

// lib/dotgen/mincross.c:611  (out_cross)
if (t > 0 || (t == 0 && ED_head_port(*e1).p.x > ED_head_port(*e2).p.x))
    cross += ED_xpenalty(*e1) * cnt;
```

`port.order` is computed by C `compassPort` but is **not** consulted here:

```c
// lib/common/shapes.c:2865,2868
pp->order = MC_SCALE / 2;                          // center port
... double angle = atan2(p.y, p.x) + 1.5 * M_PI;   // else: angular order
    pp->order = MC_SCALE * angle / (2 * M_PI);
```

## 2. TS port (the bug)

`accumCross` (`src/layout/dot/mincross-cross.ts:110,114`) compares
`val(node, port.order)` for both endpoints:

```ts
const ev = head ? val(e.head, e.info.head_port.order) : val(e.tail, e.info.tail_port.order);
// val() = MC_SCALE * ND_order + port.order   (mincross-cross.ts:34)
```

Because `MC_SCALE` (256) dominates and `port.order ∈ [0,256)`, `val` compares
`ND_order` first and breaks ties by **`port.order`** — the angular order — where
C breaks them by **`p.x`**. The `local_cross` port test
(`mincross-cross.ts:239,245`) already uses `p.x` correctly; `accumCross` does not.

`val()`/`port.order` in `mincross-order.ts:85,87` ports the distinct C `VAL`
macro (`mincross.c:1619`, `build_ranks`/flat ordering) and is **correct** — do
not touch (AD-2).

## 3. Confirmed runtime values (at mincross time)

Driven through `renderSvg(..., 'dot')` with a temporary env-gated probe in
`accumCross` (reverted — `git diff --name-only` shows only this doc). The three
out-edges of `a`, inspected as the in-edges of rank-1 nodes b/c/d:

| edge      | port | `tail_port.p.x` | `tail_port.order` |
|-----------|------|-----------------|-------------------|
| `a:e->b`  | east | **+27** (`+lw`) | 192 (angular)     |
| `a:w->c`  | west | **−27** (`−lw`) | 64 (angular)      |
| `a->d`    | none | **0**           | 0 (default)       |

`p.x` **is** populated (±lw, 0) → AD-4 does not fire.

Ordering by each metric, ascending:

- by **`p.x`** (C): c(−27) < d(0) < b(27) → **`[c, d, b]`** ✓ oracle
- by **`port.order`** (TS): d(0) < c(64) < b(192) → **`[d, c, b]`** ✗ (c/d swapped)

## 4. Live divergence (branch base)

```
oracle:  echo 'digraph{a:e->b; a:w->c; a->d}' | dot -Tsvg
         → a@99  c@27  d@99  b@171   rank-1 [c,d,b]
port:    npx tsx .probes/route-corpus.ts
         → "ports both dense"  DIVERGE  pathΔ=56.10   rank-1 [d,c,b]  a@126
```

| node | oracle cx | port cx |
|------|-----------|---------|
| a    | 99        | 126     |
| c    | 27        | 99      |
| d    | 99        | 27      |
| b    | 171       | 171     |

The splines are already faithful (they start at `a`'s e/w faces); they only look
wrong downstream of `a`'s misposition, which is caused by the rank-1 c/d swap.

## 5. Fix (T2 scope)

In `accumCross`, on an `ND_order` tie, break by `tail_port.p.x` (in-edges) /
`head_port.p.x` (out-edges), mirroring C `in_cross`/`out_cross`. Do **not** fold
`p.x` into the scaled `val` (AD-2): a wide node's `lw` can exceed `MC_SCALE/2`
and corrupt the order scale. Non-ported edges have `p.x == 0` → no-op (AD-3).
