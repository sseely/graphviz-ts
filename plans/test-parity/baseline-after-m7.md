# Failure inventory after Mission 7 (fdp)

Suite: 1001 passed / 5 failed (`npx vitest run`, 2026-06-10).
dot, osage, patchwork, twopi, circo, neato, fdp all green
(48/53 goldens). Remaining: sfdp 5.

Total count vs after-m6 (1013) reflects the fdp unit-test rewrite:
the 44 approximation-era fdp unit tests were replaced by 14
C-derived ones (including a full-precision oracle-parity fixture)
plus fma and sep-factor suites.

## sfdp

| Test | First diff | Actual | Expected |
|---|---|---|---|
| sfdp-disconnected | `svg/@height` | 4000 | 872 |
| sfdp-large | `svg/@height` | 2423 | 724 |
| sfdp-medium | `svg/@height` | 1080 | 550 |
| sfdp-simple | `svg/@height` | 200 | 301 |
| sfdp-weighted | `svg/@height` | 572 | 486 |

## Notes for mission 8

- **Read .agent-notes/fdp-fma-oracle-2026-06.md first.** Three
  transferable findings: (a) the arm64 reference binary contracts
  mul-adds to fmadd/fmsub — `src/common/fma.ts` must be applied at
  the contracted sites (verify per-function with
  `otool -tv .../libgvplugin_neato_layout.8.dylib`); (b) a
  full-precision oracle comes from a 30-line C probe linking the
  installed libgvc and printing ND_pos at %.17g (/tmp/fdp-oracle.c);
  (c) cgraph adjacency iterates by (other-end seq, edge seq) — now
  modeled in Node.outEdges/inEdges.
- Read sfdpgen specs at the 15.0.0 TAG (decision journal: post-tag
  churn).
- sfdp uses sparse matrices + multilevel coarsening
  (lib/sfdpgen/ + lib/sparse/); the spring_electrical_model RNG and
  any qsort calls need the same ordering scrutiny as fdp's grid.
- Available now: exact drand48, software fma, the polyomino packer,
  splineEdges + arrow machinery, cluster bb/label machinery.
