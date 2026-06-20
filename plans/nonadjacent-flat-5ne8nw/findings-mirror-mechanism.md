# T1 — routeSplines mirror pinned to ONE sub-step (+ candidate fix confirmed)

Performed on `fix/nonadjacent-flat-5ne8nw` (off `main`). All evidence below is
REPRODUCED from a pure box-channel repro (no graph layout) + authoritative C
instrumentation. Methods/harnesses are throwaway (reverted); the permanent
artifact is `src/common/splines-routespl.test.ts` (RED) + this file.

## TL;DR — the bisection result
The mirror enters in **`routeSpline` (Proutespline), NOT the funnel.** The funnel
(`shortestPath`) is translation-EQUIVARIANT; the fit is not. The exact line is the
max-deviation tie-break in **`src/pathplan/route.ts:RouteHelper.findMaxDev`**
(C `lib/pathplan/route.c:reallyroutespline`, the `if ((d=dist(...)) > maxd)` loop).
On a geometrically symmetric input the two candidate split deviations are an
**exact tie**; C computes them bit-identically and its strict `>` keeps the first
(tail). The port computes them ~1e-14 apart (catastrophic-cancellation noise in the
absolute-coordinate bezier-point eval), and the noise SIGN depends on absolute x,
so the tie breaks the wrong way at the port's frame → knot mirrors to the head.

## Interface contract (consumed by T2)
```json
{ "subStep": "routeSpline",
  "plMirrored": false,
  "whyMirror": "findMaxDev max-deviation tie-break: the two split-point deviations are a geometric tie (C: bit-identical 16.537462091943098); the port's absolute-coordinate bezier-point eval Sum(Bk*pk.x)-inps.x has ~1e-14 catastrophic-cancellation noise whose sign depends on absolute x, defeating C's strict `>` (first-wins) so maxi flips 1->2 (tail->head) at this edge's frame",
  "fixLine": "src/pathplan/route.ts: RouteHelper.findMaxDev — the `if (d > maxd) { maxd = d; maxi = i; }` comparison",
  "knotUnderFix": 432,
  "knotUnderFixCFrame": 405,
  "fixConfirmed": true }
```
(`knotUnderFix` is the internal knot x in the PORT frame = C-frame 405 + the benign
+27. Tail-side either way; head-side bug value was 558 / C-frame 531.)

## Bisection: funnel vs fit (pure repro, channel captured from 241_0.dot)
Captured `routeSplines` input for `5:ne->8:nw` (port frame):
boxes `[351,0,423,36][351,36,432,54][351,54,639,72][558,36,639,54][567,0,639,36]`,
start `(402.017,34.017) theta=pi/4 constrained`, end `(587.983,34.017) theta=3pi/4
constrained`. Ran `routeSplines` on this channel and on the SAME channel +27 in x.

- **FUNNEL `shortestPath(pl)` — EQUIVARIANT.** `pl(dx=0) = (402,34)(432,54)(558,54)
  (588,34)`; `pl(dx=27) - 27` is identical. The polyline is symmetric about x=495.
- **FIT `routeSpline` — NOT equivariant.** Same (translated) `pl` + barriers, knot
  lands 558 (head) at dx=0 but 432 (tail) at dx=27. So the mirror is the fit.

## The exact mechanism (findMaxDev), instrumented both sides
The 4-point `pl` fails `splineFits` (too wide for the channel) -> split at the
max-deviation interior point. The two interior points (i=1 tail, i=2 head) are
mirror images about x=495; their deviations from the single fitted bezier are an
**exact geometric tie**.

C `reallyroutespline` (instrumented, native `dot` on `tests/241_0.dot`, C frame):
```
i=1 t=0.18192107653612857 d=16.537462091943098 inps=(405,54)   <- tail
i=2 t=0.81807892346387145 d=16.537462091943098 inps=(531,54)   <- head
-> maxi=1   (strict `>` keeps first; d[i=2] NOT > d[i=1]; EXACTLY equal)
```
Port `findMaxDev` (same C-frame inputs, dx=-27): `ds=[16.53746209194313,
16.537462091943098]` -> d[i=1] bigger by 3.2e-14 -> maxi=1 (tail) by luck.
Port at the edge's actual frame (dx=0): `ds=[16.537462091943063,
16.537462091943098]` -> d[i=2] bigger by 3.6e-14 -> **maxi=2 (head) = the bug.**

Offset sweep of the port (knot.x minus dx; should be frame-invariant 432):
```
dx:   -54  -27  -18   -9    0    9   18   27   54
knot: 432  432  432  432  558  432  432  432  432   <- only the edge's own frame (0) flips
```
`mkspline` is NOT the cause: C and the port produce the SAME (already slightly
asymmetric) `cp1/cp2` (C cp1.y=...387384, cp2.y=...387392). The divergence is
purely the absolute-coordinate deviation eval + the strict tie-break.

## Candidate fix — CONFIRMED on the pure repro (AD-1 "run the actual config")
Honor C's exact-arithmetic intent (tie -> first/smallest index) robustly: make the
`findMaxDev` comparison tolerant to sub-ULP noise. Throwaway probe applied:
```ts
if (d > maxd * (1 + 1e-10) + 1e-10) { maxd = d; maxi = i; }   // was: if (d > maxd)
```
Result: knot.x-dx = **432 (tail) at EVERY offset** (-54..+54), `routeSplines` becomes
translation-EQUIVARIANT, dx=0 output `(402.02,34.02)(413.34,45.34)(416.67,49.36)
(432,54)(498.89,74.25)(538.56,83.44)(587.98,34.02)` matches the oracle structure
(tail-side knot 432). This is AD-2 (fix at source, no special-case): one comparison
line in the SHARED fitter, no flat/edge-specific branch.

Rejected alternative (candidate A: bezier point relative to p0): frame-invariant but
biases toward the HEAD (any single origin biases one side) -> wrong. Tolerance is
the minimal faithful change.

## T2 notes (blast radius — the crux)
- The fix changes behavior ONLY when two split deviations are within tolerance (a
  near/exact geometric tie); non-tie regular edges are untouched -> expect zero
  golden churn. T3's full-corpus gate (AD-4) is the safety net.
- Tolerance tuning: the noise scales with coordinate magnitude; `*(1+1e-10)+1e-10`
  absorbs this case (relative noise ~2e-15) with ~5 orders of margin. T3 must
  confirm no genuine near-tie elsewhere flips; tighten toward 1e-11/1e-12 if any
  out-of-family golden moves (smaller = safer for blast radius, still absorbs noise).
- Latent cnt>=2 step-size bug (`routeFlatEdgeFaithful` stepx=nodesep/2 vs C
  /(cnt+1)) is NOT on this fix's line -> out of scope (5:ne->8:nw is cnt=1).

## Oracle integrity (AD-5)
C instrumented in `lib/pathplan/route.c:reallyroutespline` (ephemeral fprintf gated
on `getenv("CPROBE")`); rebuilt `libpathplan` in the build tree; ran native `dot`
with `GVBINDIR=/tmp/gvplugins`. Restored: `git -C ~/git/graphviz checkout --
lib/pathplan/route.c` (git diff clean), rebuilt clean, verified a clean render emits
ZERO `CPROBE` markers. Oracle remains native ground truth.
```
$ git -C ~/git/graphviz diff --stat lib/pathplan/route.c   # (empty)
$ CPROBE=1 dot -Tsvg tests/241_0.dot | grep -c CPROBE       # 0
```
