# T4 — Regression sweep findings (nonadjacent-flat-multi)

Executed on branch `fix/nonadjacent-flat-multi` (T1+T2+T3 committed), 2026-06-20.

## 1. Curated goldens (vitest)
`npx vitest run` → **1999 passed, 0 failed** (149 files). Baseline was 1995;
the delta is exactly the 4 new synthetic cnt≥2 tests in
`splines-flat-multi.test.ts`. **Every pre-existing golden is conformant** —
no out-of-family flip — so all cnt=1 flat behavior is unchanged (AD-1).

## 2. Corpus survey (the gate)
`npx tsx test/corpus/survey.ts` over 796 applicable inputs. Per-id diff vs the
pre-mission baseline (`/tmp/parity-baseline.json`, = committed `parity.json`):

| verdict        | baseline | survey | delta |
|----------------|----------|--------|-------|
| conformant     | 160      | 159    | −1*   |
| structural-match | 237    | 237    | 0     |
| diverged       | 356      | 356    | **0** |
| errored        | 20       | 20     | 0     |
| timeout        | 8        | 9      | +1*   |
| oracle-error   | 15       | 15     | 0     |

**ZERO new `diverged`/`structural-match` (regression) verdicts.** Exactly one id
changed: `2222` conformant → timeout (*the −1/+1 above are the same id).

### `2222` is a flaky timeout, NOT a regression (proven)
- `tests/2222.dot` is 2.3 MB → a 22 MB SVG; the port renders it in a steady
  **~13 s** (3 runs: 13.29/13.14/13.12 s, exit 0, valid output — no hang, no
  infinite loop). The survey timeout is 20 s and runs **concurrency 8**, so a
  13 s render crosses 20 s wall-clock when a worker is starved.
- On `main` (pre-change) `2222` also renders in **~13 s** (13.27/12.98 s) — this
  mission added **no** measurable cost.
- The decisive check: `2222`'s SVG output is **BYTE-IDENTICAL** between `main`
  and this branch (`cmp` clean). The change does not touch `2222` at all.
- Action: restored the committed `parity.json` (no legitimate verdict change);
  `2222`'s true verdict is conformant.

### cnt=1 non-adjacent flats unchanged
All 74 corpus non-adjacent flats are cnt=1 (findings-diagnosis.md) and route
through the same shared box channel; the cnt-loop with cnt=1, i=0 is the prior
single route. `241_0` (the `5:ne->8:nw` cnt=1 case from the #241_0 saga) is a
curated golden and stays conformant in the vitest run.

## 3. End-to-end synthetic conformant (re-captured oracle, AD-5)
Native `dot` 15.1.0~dev.20260610.0127, `GVBINDIR=/tmp/gvplugins`. `render-one.ts`
port output vs fresh oracle, **drawing elements** (`path`/`polygon`/`ellipse`/
`text`) conformant:

| case            | result |
|-----------------|--------|
| top cnt=2 (`a:ne->c:nw`×2) | DRAWING MATCH (2 distinct nested splines) |
| top cnt=3 (`a:ne->c:nw`×3) | DRAWING MATCH (3 nested) |
| bottom cnt=2 (`a:se->c:sw`×2) | DRAWING MATCH (2 nested) |
| cnt=1 (`a:ne->c:nw`) | unchanged (== oracle top1) |

The top2 `viewBox` grows `69→73` matching the oracle — the nested bulge raises
the graph bbox, and the port tracks it. (Header attribute-wrapping and C's
`<!-- name -->` SVG comments differ as they do for every corpus render; the
survey harness normalizes these.)

## 4. Native oracle restored (AD-5)
No C instrumentation was used this mission (the diagnosis was complete). Verified:
`lib/dotgen/dotsplines.c` / `lib/common/routespl.c` unmodified (`git status`
clean); a `dot -Tsvg` render emits 0 probe markers on stderr; `/tmp/gvplugins`
holds the standard build.

## Conclusion
Zero new diverges, zero golden flips, cnt=1 conformant, cnt≥2 conforms to
native `dot`. The single survey verdict change (`2222`) is a load-induced flake
with conformant output. **Gate satisfied.**
