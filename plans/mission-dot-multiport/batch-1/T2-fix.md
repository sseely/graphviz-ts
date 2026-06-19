# T2 — Faithful `accumCross` tiebreak fix + oracle pins

## Context

Same mission context as [T1-diagnose.md](T1-diagnose.md). **Start only if T1's
verdict is CONFIRMED** (decisions.md AD-4). T1's `docs/dot-g2-trace.md` is the
read-set for the exact divergence.

C `in_cross`/`out_cross` (`mincross.c:593,611`) order successor nodes by
`ND_order`, breaking ties by `ED_*_port(e).p.x`. The TS `accumCross`
(`mincross-cross.ts:110,114`) ties by `port.order` via `val()`, losing the
compass-port signal. Fix `accumCross` to mirror C exactly.

## Task

TDD — write the failing pin first, then the faithful fix.

1. **Red.** Add `src/layout/dot/mincross-port-order.test.ts`:
   - `digraph{a:e->b; a:w->c; a->d}` → rank-1 order `[c,d,b]` and node `a.cx ==
     99` (oracle), asserted via `renderSvg(...,'dot')` parsed coords.
   - A non-port regression guard: a plain multi-child graph (e.g.
     `digraph{a->b; a->c; a->d}`) order is unchanged from current output.
   - Confirm it FAILS on the current `accumCross` (c/d swapped).
2. **Green — faithful fix in `accumCross`** (`mincross-cross.ts`): compare
   `MC_SCALE*ND_order` (or the existing order term) first; on an order tie, break
   by `tail_port.p.x` (in-edges) / `head_port.p.x` (out-edges), mirroring
   C `in_cross`/`out_cross`. Do **not** add `p.x` into the scaled value (AD-2).
   Keep `transposeCounts` semantics (in_cross+out_cross pairing) intact.
   - Do **not** touch `val()`/`port.order` in `mincross-order.ts` (AD-2 — it
     ports the distinct C `VAL` macro and is correct).
3. **Verify.**
   - `npx tsx .probes/route-corpus.ts` → `ports both dense` is **MATCH**; total
     **25 MATCH** (the 2 `near` port residuals may remain `near` — they are
     pre-existing sub-pixel, not this mission's target; just prove no
     regression to DIVERGE).
   - `npx vitest run` → 0 failures, **every golden byte-identical** (AD-3).
   - `npx tsx .probes/route-diverge.ts` → `ports both dense` edges now match the
     oracle faces (`a:e->b` starts at a's east face for a@99, etc.).
4. **Update status docs** (mark G2 resolved):
   - `plans/layout-engine-backlog/route-reverification.md` — G2 row → resolved;
     corpus now 25/25 (1 DIVERGE → 0).
   - `plans/layout-engine-backlog/gaps/dot.md` — note G2 (multi-port mincross
     tiebreak) DONE with the C-cited fix.
   - `plans/port-catalog/README.md` — dot "Honest scope summary": drop G2 / mark
     the multi-port residue closed.

## Write-set

- `src/layout/dot/mincross-cross.ts` (Modify — `accumCross` only)
- `src/layout/dot/mincross-port-order.test.ts` (Create)
- `plans/layout-engine-backlog/route-reverification.md` (Modify)
- `plans/layout-engine-backlog/gaps/dot.md` (Modify)
- `plans/port-catalog/README.md` (Modify)

## Read-set

- `docs/dot-g2-trace.md` (T1 output — the confirmed divergence).
- `~/git/graphviz/lib/dotgen/mincross.c:580-615` (`in_cross`/`out_cross`).
- `src/layout/dot/mincross-cross.ts:42-132` (`signedVal`/`accumCross`/
  `transposeCounts`).
- `.probes/route-corpus.ts`, `.probes/route-diverge.ts` (re-runnable; need the
  built `dot` + `GVBINDIR=/tmp/gvplugins`).
- `../decisions.md` (AD-2, AD-3).

## Interface contracts

`accumCross(vl, wl, head, c)` keeps its signature and the `c=[c0,c1]`
accumulator semantics; only the comparison metric changes. `transposeCounts`
return shape unchanged.

## Acceptance criteria (Given/When/Then)

- **Given** `digraph{a:e->b; a:w->c; a->d}`, **when** rendered via the dot
  engine, **then** rank-1 order is `[c,d,b]` and node `a.cx == 99` — byte-exact
  to dot 15.0.0.
- **Given** the full corpus probe, **when** run after the fix, **then**
  `ports both dense` is MATCH and 0 cases DIVERGE.
- **Given** the golden suite, **when** `vitest run` executes, **then** 0 failures
  and every golden is byte-identical (AD-3).
- **Given** a plain no-port multi-child graph, **when** rendered, **then** its
  node order is unchanged from pre-fix output (the tiebreak is a no-op when
  `p.x == 0`).
- **Given** the mission is complete, **when** the three status docs are read,
  **then** G2 is marked resolved and the corpus recorded as 25/25.

## Observability

N/A — no new observable operations.

## Rollback notes

Reversible — revert the commit. No migration.

## Boundaries

- **Always:** keep all goldens byte-identical; cite the C line in the code
  comment and commit body.
- **Never:** change `mincross-order.ts` / the `port.order` VAL usage; fold `p.x`
  into the scaled order value; touch splines/position code (the splines are
  already faithful).
- **Ask first / STOP:** if a golden churns, or the fix needs a file outside this
  write-set (per overview stop conditions).

## Commit

One commit: `fix(T2): order dot ranks by compass-port x in mincross (G2)`.
Body: cite `mincross.c:593,611`; note corpus 24/25 → 25/25, goldens unchanged.

## Quality bar

`tsc --noEmit` = 0; `vitest run` 0 failures + goldens byte-identical; corpus
25/25; `lizard src/layout/dot/mincross-cross.ts -C 10 -L 30 -a 5` clean. Return
only the structured result — no preamble.
