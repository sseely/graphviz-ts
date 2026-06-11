# Coverage Baseline — graphviz-ts

Generated: 2026-06-11  
Provider: @vitest/coverage-v8 1.6.1  
Test run: 1027 passed / 0 failed

---

## Overall Totals

| Metric      | %     |
|-------------|-------|
| Statements  | 86.83 |
| Branches    | 78.18 |
| Functions   | 79.03 |
| Lines       | 86.83 |

---

## Per-Directory Rollup

| Directory              | Stmts% | Branch% | Funcs% | Lines% |
|------------------------|--------|---------|--------|--------|
| src                    | 100.00 | 100.00  | 100.00 | 100.00 |
| src/cdt                |  84.04 |  78.02  |  70.27 |  84.04 |
| src/common             |  85.41 |  71.86  |  70.44 |  85.41 |
| src/gvc                |  91.68 |  88.30  |  89.66 |  91.68 |
| src/layout/circo       |  90.97 |  80.74  |  83.15 |  90.97 |
| src/layout/dot         |  78.11 |  69.93  |  74.22 |  78.11 |
| src/layout/fdp         |  89.38 |  80.57  |  87.41 |  89.38 |
| src/layout/neato       |  93.45 |  82.03  |  86.44 |  93.45 |
| src/layout/osage       |  65.77 |  84.78  |  96.15 |  65.77 |
| src/layout/pack        |  91.18 |  81.09  |  87.64 |  91.18 |
| src/layout/patchwork   |  81.55 |  84.52  |  97.22 |  81.55 |
| src/layout/sfdp        |  96.89 |  87.27  | 100.00 |  96.89 |
| src/layout/twopi       |  98.59 |  82.48  | 100.00 |  98.59 |
| src/model              |  99.50 |  92.00  |  93.33 |  99.50 |
| src/ortho              |  89.28 |  85.49  |  82.07 |  89.28 |
| src/parser             |  92.84 |  86.84  |  87.80 |  92.84 |
| src/pathplan           |  97.09 |  89.30  |  97.17 |  97.09 |
| src/rbtree             |  86.12 |  85.33  |  88.89 |  86.12 |
| src/render             |  90.34 |  83.57  |  56.25 |  90.34 |
| src/util               |  90.92 |  93.88  |  84.62 |  90.92 |
| src/vpsc               |  92.44 |  91.24  |  90.18 |  92.44 |
| src/xdot               |  79.22 |  71.90  |  91.67 |  79.22 |

---

## 20 Worst Files by Line Coverage

| File | Stmts% | Branch% | Funcs% | Lines% |
|------|--------|---------|--------|--------|
| src/common/arrows-geometry.ts | 0 | 0 | 0 | 0 |
| src/common/arrows-miter.ts | 0 | 0 | 0 | 0 |
| src/gvc/textlayout.ts | 0 | 0 | 0 | 0 |
| src/layout/dot/compound-geom.ts | 0 | 0 | 0 | 0 |
| src/layout/dot/splines-clone.ts | 0 | 0 | 0 | 0 |
| src/layout/dot/splines-label.ts | 0 | 0 | 0 | 0 |
| src/layout/dot/splines-route.ts | 0 | 0 | 0 | 0 |
| src/layout/osage/layout.ts | 0 | 0 | 0 | 0 |
| src/layout/pack/test-helpers.ts | 0 | 0 | 0 | 0 |
| src/layout/patchwork/tree-node.ts | 0 | 0 | 0 | 0 |
| src/model/index.ts | 0 | 0 | 0 | 0 |
| src/util/index.ts | 0 | 0 | 0 | 0 |
| src/xdot/lex.ts | 0 | 0 | 0 | 0 |
| src/common/splines-routespl.ts | 31.85 | 40.00 | 16.00 | 31.85 |
| src/common/splines-path-end.ts | 36.32 | 100.00 | 0 | 36.32 |
| src/common/splines-path-begin.ts | 36.58 | 100.00 | 0 | 36.58 |
| src/layout/fdp/normalize.ts | 43.00 | 40.00 | 33.33 | 43.00 |
| src/common/splines-path-shared.ts | 52.65 | 100.00 | 0 | 52.65 |
| src/layout/dot/flat.ts | 52.81 | 100.00 | 4.54 | 52.81 |
| src/layout/dot/conc.ts | 53.31 | 57.69 | 29.03 | 53.31 |

---

## Effort Estimate to Reach 90/90/90

The overall line and statement coverage (86.83%) is 3.2pp below the 90% floor, but the branch gap (78.18% vs 90%) and function gap (79.03% vs 90%) are significantly larger. The heaviest lift sits in three areas: **src/layout/dot** drives the most raw uncovered lines — it is the largest directory and sits at 78% lines / 70% branches / 74% functions, with seven completely uncovered files (splines-route.ts, splines-label.ts, splines-clone.ts, compound-geom.ts, flat.ts, conc.ts) accounting for roughly 700+ uncovered lines. **src/common** (71.86% branches) has a cluster of zero-coverage splines path files (splines-path-begin/end/shared, splines-routespl) plus arrows-geometry and arrows-miter that are not exercised at all. **src/layout/osage** has layout.ts at 0% (254 lines), dragging the directory to 65.77% lines. Closing these three areas — dot splines+flat+conc, common splines path variants+arrow geometry, and osage layout — would account for the majority of the gap and likely bring all three metrics to or past 90%. Secondary targets are src/render (56.25% functions), src/xdot (lex.ts at 0%), and src/gvc (textlayout.ts at 0%). Estimated effort: 3–5 focused test-writing sessions of 2–4 hours each, working top-down through the zero-coverage files before addressing the partially-covered ones.
