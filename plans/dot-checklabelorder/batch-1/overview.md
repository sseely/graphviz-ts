# Batch 1 — checkLabelOrder

Two sequential tasks, one executor. T2 depends on T1 (calls the function it
ports). All dot-engine flat-label ordering.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | `fixLabelOrder` + helpers + unit test | inline | `label-order.ts`, `label-order.test.ts` | — | [ ] |
| T2 | `checkLabelOrder` + wire (flat.ts) + recResetVlists | inline | `label-order.ts`, `label-order.test.ts`, `flat.ts` | T1 | [ ] |

## C spec anchors

- `fixLabelOrder` — `mincross.c:246-289`
- `getComp` / `topsort` / `findSource` / `emptyComp` — `mincross.c:178-224`
- `ordercmpf`, `isBackedge`, `info_t`, `ND_lo/hi/np/x/idx` — `mincross.c:115-177`
- `checkLabelOrder` — `mincross.c:297-326`
- call site — `flat.c:331-333` (`if (reset) { checkLabelOrder; rec_reset_vlists }`)

## TS anchors

- stub to replace — `flat.ts:224` (`checkLabelOrder` no-op); call at `flat.ts:319`
- label vnode marking — `flatNode` sets `vn.info.posAlg = e` (`flat.ts:162`)
- `recResetVlists` — `mincross.ts:106` (needs `MincrossContext`)
