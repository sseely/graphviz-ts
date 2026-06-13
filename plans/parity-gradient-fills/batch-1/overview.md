# Batch 1 — gradient emitter foundation + node gradient fills

**Sequenced: T1 first, T2 after T1 commits.**

T1 creates the shared gradient emission module with deterministic
IDs (AD1), the SVG `<defs>` block emitter, and the `get_gradient_points`
port. T2 extends node shape emission (ellipse + polygon + bezier) to
call the new emitter when `FillType.Linear/Radial` is set, replacing
the first-color solid fallback for nodes.

## Task table

| ID | Name | Write-set | Depends on |
|----|------|-----------|------------|
| T1 | [gradient emitter module](T1-gradient-emitter.md) | src/render/svg-gradient.ts + test | — |
| T2 | [node linear + radial fills](T2-node-gradients.md) | src/render/svg-helpers.ts, src/common/style-resolve.ts (or T1's caller sites) | T1 |

Write-sets are disjoint. T1 must merge before T2 begins.
