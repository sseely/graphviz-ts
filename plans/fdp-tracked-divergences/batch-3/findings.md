# Batch 3 findings — B3 FP-ties → A9 (241_0 accept; 2095 reclassified A1)

Two candidates entered B3 (241_0, 2095). After the empty-name injector fix
(T3.1), only **241_0** is a genuine A9; **2095 is A1-drift**.

## T3.1 — 2095 is NOT A9 (reclassified A1-drift)

T0.3 flagged 2095's residual as dominated by the empty-name injection blindspot
(45/52 diffs on the single empty-named node + its two incident edges). Fixing
the injector regex (`(.+)` → `(.*)`, so the `""`-named node injects) collapses
2095 from **base 8256 → inj 0**. Every residual — including the 7 small-Δ diffs
earlier read as an A9 tail — was downstream of the un-injected empty node.
**2095 is pure force-drift (A1-drift)**, covered by the computed A1 class. No
A9 entry.

> Cross-mission note (out of scope): sfdp accepted 2095 as A9. That accept may
> share this blindspot; flag for a future sfdp attribution regen with the fixed
> injector. This mission does not re-sweep sfdp (ADR-2).

## T3.2 — 241_0 is A9 (accept, controlled-experiment evidence)

**Signature.** Injected residual = 11 numeric diffs, ALL on one edge
`0->1#0`'s `unfilled_bezier` control points, maxΔ = 3.39pt (then 1.89 / 1.38 /
0.88 … decaying along the spline). No cluster / label / empty-name / ratio /
size attrs (plain graph).

**Mechanism (A9).** The residual persists under *injected-identical* node
positions, so it originates in **routing (pathplan)**, not the force layout —
the CDT-based multispline corridor. 241_0 is the SAME graph already accepted as
A9 for circo, twopi, and sfdp: a **CDT cocircular incircle tie flipped by libm
`sin`/`cos` 1-ULP (V8 vs Apple libm)** (`accepted-divergences-engines.json`
{circo,twopi,sfdp}.241_0; `docs/known-divergences.md#a9`). The tie flips a
discrete triangulation edge, so the corridor routes fractionally differently on
that one edge.

**Fix-aggressive (ADR-3) — levers already applied, no further reduction:**
- `src/pathplan/triang.ts` — arm64 `fmadd` reproduction of the oracle's fused
  multiply-add in the incircle/ccw predicate.
- `src/pathplan/route.ts:198` — `Math.hypot` (Apple libm's `hypot` is
  ~1-ULP-divergent and proprietary; no portable form reproduces it).

**Controlled-experiment evidence (reused, same graph/mechanism):** the exact-
rational incircle evaluation for 241_0 confirmed the cocircular ties are genuine
(185/185; `docs/known-divergences.md:852`), and the sfdp native-vs-V8 hypot ULP
probe (`plans/sfdp-tracked-divergences/batch-2/hypot-ulp-probe.txt`). The port's
routing is faithful; the tie is a platform-FP floor, irreducible.

## Proposed registry entry (batch-final writes it)

```
fdp.241_0 (class A9):
  bound: "11 numeric draw-op diffs confined to edge 0->1#0's unfilled_bezier
    (maxΔ 3.39pt), under injected-identical node positions ⇒ pathplan routing.
    Same graph and CDT cocircular incircle 1-ULP tie (V8 vs Apple libm) accepted
    for circo/twopi/sfdp 241_0; exact-rational incircle 185/185. Levers (fmadd
    triang.ts, hypot route.ts) applied; tie irreducible."
  evidence: docs/known-divergences.md#a9 ; sfdp hypot-ulp-probe.txt
```

## Bucket status after Batch 3

B3 resolved: **241_0 → A9 accept** (registry entry), **2095 → A1-drift**
(computed class, injector fix). Tracked residual = **0**.
