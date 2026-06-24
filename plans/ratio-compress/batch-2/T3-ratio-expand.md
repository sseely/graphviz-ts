<!-- SPDX-License-Identifier: EPL-2.0 -->
# T3 — ratio=expand (DEFERRED)

## Dead-code state
`aspectExpandScale` (`src/layout/dot/position-bbox.ts`) is **ported but dead**
(same root cause: `drawing` unpopulated). After T1 the wiring point exists.

## C reference
`lib/dotgen/position.c:937-948` (R_EXPAND branch of `set_aspect`):
`xf=size.x/bb.UR.x`, `yf=size.y/bb.UR.y`; **only** scales (uniformly, by
`min(xf,yf)`) when **both** `xf>1` and `yf>1` (i.e. the drawing is smaller than
`size` in both axes); otherwise no-op. `lib/common/input.c:576` (R_EXPAND).

## Corpus / risk
**No corpus graph uses `ratio=expand` today** → no regression surface, but also
no oracle coverage. Validation would need a hand-built `ratio=expand` graph
pinned against native dot.

## Why deferred
No corpus signal; low value until a real input needs it. Captured so the dead
`aspectExpandScale` is not mistaken for unreachable/removable code.

## When taken up
Populate `drawing` for `expand`; add a golden test (oracle-pinned) since the
corpus does not cover it; confirm the both-axes-`>1` guard matches C exactly.
