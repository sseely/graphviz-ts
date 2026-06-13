# Batch 2 — striped / wedged node fills

Ports the multicolor REGION fills (not gradients): `style=striped` draws
vertical color bands across a box; `style=wedged` draws pie wedges in an
ellipse. Both consume G1's `parseSegs` (src/common/multicolor.ts). The
parity mission left these as first-solid fallbacks in poly_gencode.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| S1 | striped + wedged node fills ([S1-striped-wedged.md](S1-striped-wedged.md)) | sonnet | src/render/svg-multicolor.ts (new), src/common/poly-gencode.ts (+tests) | G1 (parser) | [x] |

**Done (2026-06-13):** striped byte-matches dot 15.0.0; wedged feature
implemented but byte-diverges from glibc refs via a libm arc-subdivision
difference (8 vs 16 bezier cubics — see decision-journal.md). T-gold mints
the striped golden and excludes wedged. tsc 0; vitest 1657/0; 97 goldens
stable.

Single task. Depends on Batch 1 (G1's parseSegs). Runs after Batch 1.
Byte-stability: no existing golden uses striped/wedged, so this is new
behavior; default/solid nodes are untouched.
