<!-- SPDX-License-Identifier: EPL-2.0 -->
# Component map — affected modules

```mermaid
graph TD
  classDef edit fill:#ffe8cc,stroke:#d9480f;
  classDef ro fill:#e7f5ff,stroke:#1c7ed6;
  classDef test fill:#ebfbee,stroke:#2f9e44;

  ps[src/common/poly-shapes.ts\nextract roundedBoxPath helper]:::edit
  dev[src/gvc/device.ts\nrenderOneCluster -> rounded path]:::edit
  rec[src/common/record.ts\nrecordGencode -> rounded path]:::edit

  devc[src/gvc/device-cluster.ts\nstyle flags + obj state]:::ro
  pg[src/common/poly-gencode.ts\ndrawRoundCorners caller]:::ro
  shapes[shapes.ts Mrecord desc]:::ro

  pst[poly-shapes.test.ts]:::test
  devt[device.test.ts / svg-cluster-fill.test.ts]:::test
  rect[record-port.test.ts]:::test
  gold[test/golden + corpus parity\nT2]:::test

  ps --> dev
  ps --> rec
  devc --> dev
  pg --> ps
  shapes --> rec
  ps --- pst
  dev --- devt
  rec --- rect
  dev --> gold
  rec --> gold
```
