# Edge-Port Parity — Mission Scoping

## Gap Table (front-loaded)

| Surface | C entry point | TS status | Downstream consumer |
|---|---|---|---|
| `A:port:compass` DOT syntax | `cgraph/grammar.y:396` → `mkport` → sets `tailport`/`headport` attr | PARSED ONLY — `parser/dot.pegjs:122` emits `NodeId.port/compass`; `parser/builder.ts:168` discards both fields | `common/utils.c:common_init_edge:556` reads attr via `chkPort` → sets `ED_tail/head_port`; TS `initEdgeLabels` has no equivalent |
| `headport=`/`tailport=` edge attrs | `common/utils.c:common_init_edge:551–566` — `agget(e, TAIL_ID)` / `agget(e, HEAD_ID)` → `chkPort` → `portfn` | NONE — `init.ts:dotInitEdge` never reads `headport`/`tailport` attrs; no `chkPort` equivalent | `dotsplines.c:961` `ED_tail/head_port(e).p` added to node coord for spline endpoints |
| Compass-only ports (`A:n`, `[headport=e]`) | `shapes.c:compassPort:2698` — resolves 8-direction p/theta/side from node bbox | NONE — `portfn: null` for all shapes in `shapes.ts:42,52`; `ShapeFunctions.portfn` typed but unimplemented | `beginpath`/`endpath` use port.p offset; `mincross-cross.ts` uses `port.order` and `port.side` |
| Record field ports (`A:field1:ne`) | `shapes.c:record_port:3732` → `map_rec_port:3716` walks `FieldT` tree by `.id` | PARTIAL — `record.ts` parses field IDs (`HASPORT`/`INPORT` flags, `fp.id` set at line 155); `map_rec_port` NOT ported; `record_port` fn absent from `RECORD_FNS.portfn` (null) | `record_port` calls `compassPort` to get p/theta/side for the field bbox |
| HTML cell PORT attachment | `htmltable.c:html_port:916` — finds cell by `portToTbl`; returns `&tp->box` + sides | NONE — `html_port` not ported; `poly_port:2892` calls it when label is HTML; no TS equivalent | Called from `poly_port` before `compassPort`; needed for html-labels mission T_html_port |
| Port→spline attachment | `splines.c:beginpath:387` / `endpath:584` — `resolvePort` for `dyna` ports; `clip_and_install:236` clips spline to node/port box | STUB — `splines-path-shared.ts:60` `resolvePort` is identity (returns port unchanged); `compassPort` body absent | Spline endpoint offset is `ND_coord + ED_tail/head_port.p`; wrong when port is zero-initialized |

## C Spec Map

| C file:line | LOC | Purpose |
|---|---|---|
| `common/types.h:48` | 15 | `port` struct — p, theta, bp, defined, constrained, clip, dyna, order, side, name |
| `common/utils.c:489` (`chkPort`) | 15 | Splits `"name:compass"` string; calls `portfn`; sets `port.name` |
| `common/utils.c:509` (`common_init_edge`, port block only, lines 548–566) | 18 | Reads `tailport`/`headport` attrs; calls `chkPort`; conditionally clears clip |
| `common/shapes.c:2698` (`compassPort`) | ~181 | Maps compass string → `p`, `theta`, `side`, `clip`, `dyna`; handles 8 directions + `_` (dynamic) for rectangular and shaped nodes |
| `common/shapes.c:2880` (`poly_port`) | ~63 | Entry for polygon shapes: delegates to `html_port` if label is HTML, else calls `compassPort` |
| `common/shapes.c:3716` (`map_rec_port`) | ~15 | Recurses `FieldT` tree matching by `fld[i].id == str` |
| `common/shapes.c:3732` (`record_port`) | ~45 | Entry for record shapes: finds field via `map_rec_port`, calls `compassPort` on field bbox |
| `common/shapes.c:4322` (`resolvePort`) | ~10 | Re-runs `compassPort` using `closestSide` when `port.dyna` is true |
| `common/htmltable.c:916` (`html_port`) | ~20 | Finds HTML cell by PORT attr via `portToTbl`; returns cell bbox |
| `common/splines.c:378` (`beginpath`) / `575` (`endpath`) | ~200 each | Calls `resolvePort` for dyna ports; builds `Path.boxes` for spline routing |

## What Exists in TS

- **Port type** (`model/geom.ts:85`) — full `port` struct parity; all 9 fields present.
- **`makePort()`** (`model/edgeInfo.ts:332`) — zero-init with `clip: true`, matching C's `Center` port.
- **`EdgeInfo.tail_port` / `head_port`** (`model/edgeInfo.ts:29,40`) — always initialized; used by `dotsplines`, `classify`, `mincross-cross`, `sameport`, `conc`.
- **Parser** (`parser/dot.pegjs:120–127`) — `NodeId.port` and `NodeId.compass` are parsed; `builder.ts:168` calls `registry.ensure(item.id)` and **silently drops** `.port` and `.compass`.
- **`ShapeFunctions.portfn`** (`common/types.ts:276`) — typed `(n, portname, compass) => Port | null`; set to `null` for all shapes in `shapes.ts:42,52` (both polygon and record FNS).
- **`resolvePort`** (`common/splines-path-shared.ts:60`) — explicit stub comment: returns `port` unchanged; called from `splines-path-begin.ts:227` and `splines-path-end.ts:217`.
- **Record field IDs** (`common/record.ts:155`) — `fp.id = st.tmpport` is set during `parseReclbl`; field tree exists. `map_rec_port` walk is NOT ported.
- **`initEdgeLabels`** (`common/edge-label-init.ts:217`) — ports the label block of `common_init_edge`; the port block (lines 548–566) is entirely absent.

## Oracle Probes

**Probe 1 — `digraph G { A -> B [headport=n tailport=s]; }`**
C: `M27,-72C27,-60.62 27,-55.32 27,-47.45` (exits node bottom, enters top).
TS: `M27,-71.7C27,-64.41 27,-55.73 27,-47.54` — IDENTICAL to no-port baseline. Silent ignore; ports never reach `EdgeInfo`.

**Probe 2 — `digraph G { A:s -> B:n; }`**
C: same as probe 1 path (port syntax maps to identical compass resolution).
TS: `M27,-71.7C27,-64.41 27,-55.73 27,-47.54` — IDENTICAL to no-port baseline. `NodeId.port`/`.compass` discarded at `builder.ts:168`.

## Open Decisions for /plan-mission

1. **Record shapes — PORTED** (`common/record.ts` exists; sizing, rendering, field IDs implemented). `map_rec_port` is the missing piece, not the record shape itself. Record ports do NOT block the mission start.
2. **HTML cell ports (`html_port`)** — depend on HTML-labels mission completing `portToTbl`; place `html_port` wiring AFTER html-labels batch 1 lands.
3. **`Port.bp` box pointer** — C `port.bp` is a raw pointer to a subfield box; TS `Port.bp: Box | null` is a value copy. Ensure port resolution copies the current box, not a stale snapshot.
4. **`closestSide`** for dynamic ports — called by `resolvePort`; not ported; adds ~30 LOC dependency before the stub can be made real.
5. **Golden tolerance** — compass port moves the endpoint by ½ node dimension; expect >1pt delta vs. no-port; set tolerance class at 0.5pt (same as html-label baseline).

## Rough Batch Sketch

| Batch | Tasks | Description |
|---|---|---|
| 1 | T1 | **Model + parsing pipeline**: wire `NodeId.port/compass` → `tailport`/`headport` edge attrs in `builder.ts`; add port-block to `initEdgeLabels` (read `tailport`/`headport`, call `chkPort` equiv, set `ED_tail/head_port`) |
| 2 | T2 | **`compassPort` + `poly_port`**: port `compassPort` (~181 LOC) and `poly_port`; set `POLY_FNS.portfn`; include `closestSide` for `resolvePort` |
| 2 | T3 | **`map_rec_port` + `record_port`**: port `map_rec_port` field-tree walk and `record_port`; set `RECORD_FNS.portfn` |
| 3 | T4 | **`resolvePort` stub → real**: replace identity stub with `closestSide`+`compassPort` call; wire `beginpath`/`endpath` dyna resolution |
| 3 | T5 | **Goldens**: generate reference SVGs for `A:s->B:n`, `A->B[headport=n]`, record-field port, compass-only; promote quarantined or new fixtures |
| 4 | T6 | **`html_port`**: port `html_port` + `portToTbl` lookup; wire into `poly_port` HTML branch — depends on html-labels T_html_port being promoted first |
