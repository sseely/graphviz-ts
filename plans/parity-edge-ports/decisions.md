# Architecture Decisions

| ID | Decision |
|----|----------|
| AD1 | **`Port.bp` is a value copy (`Box \| null`), not a raw pointer.** C `port.bp` is `boxf *` — a pointer to a subfield bbox (record cell box, HTML cell box). TS `Port.bp: Box | null` stores a snapshot value at resolution time. Each `portfn` call (compassPort, record_port, html_port) must copy the current box into `bp` rather than storing a reference. The snapshot is sufficient because the box does not change after layout resolves. This matches the existing `Port` definition in `model/geom.ts:85`. |
| AD2 | **`compassPort` is split across two or three TS functions to satisfy the 30-line/function hook limit.** The C function is ~183 LOC. Split on natural seams: (a) bbox computation + direction dispatch, (b) side mask logic + theta assignment, (c) port struct population. All parts are in the same file (`src/common/compass-port.ts`); C function boundary and `@see shapes.c:2698` cited at the call site. |
| AD3 | **Parser wiring writes to edge `attrs` (`headport`/`tailport`), not to `EdgeInfo.tail_port`/`head_port` directly.** The C path is: DOT syntax → `mkport` → sets the `tailport`/`headport` graph attribute → `common_init_edge` reads the attribute → calls `chkPort` → sets `ED_tail/head_port`. The TS port must follow this two-step: `builder.ts` writes the port/compass into the edge attrs (as `"tailport"` / `"headport"` string values, same as `headport=`/`tailport=`), and `initEdgeLabels` (which already ports `common_init_edge`'s label block) gains a port block that reads those attrs and calls `chkPort`. This keeps the parser-to-layout pipeline identical to C. |
| AD4 | **`chkPort` is ported as a free function `chkPort(pf, n, s)` in `src/common/edge-label-init.ts`.** It splits `"name:compass"` at the colon, calls `portfn(n, name, compass)`, and sets `port.name`. The `portfn` signature is already typed in `src/common/types.ts:276` as `(n: Node, portname: string, compass: string \| null) => Port \| null`. When `portfn` is null (default), `chkPort` returns a zero-initialized port with `defined: false`, matching C's behavior when `pboxfn`/`portfn` is null. |
| AD5 | **Record ports and HTML-cell ports are in this same mission.** Record shapes are fully ported (`record.ts` has field IDs, sizing, rendering); `map_rec_port` is the only missing piece. HTML-cell ports depend on `portToTbl` being available from the html-labels mission. Both are included rather than deferred: record ports as T4 (no dependency); HTML ports as T7 with an explicit gate — T7 is SKIPPED if `portToTbl` is absent in `htmltable.ts`. The golden count targets ≈90 with T7, ≈90 without (html-port coverage deferred to a tiny patch). |
| AD6 | **Golden tolerance for port-offset goldens is 0.5 pt** (matching html-labels precedent). Compass port moves the endpoint by up to ½ node dimension; the accumulated coordinate path (ND_coord + port.p) will differ from the no-port baseline by design. New golden fixtures use the 0.5 pt tolerance class. Existing 82 goldens have no port inputs (confirmed by grepping `test/golden/inputs/`) and must remain byte-identical. |
| AD-C1 | (Carried M9–M13.) Append-only manifest entries with provenance; never modify existing refs/manifest/tolerances; refs from installed graphviz 15.0.0 only. |

## Locked constraints (not decisions)

- C function boundaries and `@see` cites per ported block (CLAUDE.md).
- YAGNI does not apply: the C source defines completeness. Port every
  branch of `compassPort`, including the `_` (dyna) direction, all 8
  compass points, flip/no-flip, and the `ictxt` inside_t path.
- `port.order` (mincross) and `port.side` (beginpath routing boxes)
  must be set correctly — `mincross-cross.ts` reads `tail_port.order`
  and `head_port.order`; `beginpath` reads `tail_port.side`. These
  fields are populated by `compassPort`.
- No new abstraction over `ShapeFunctions.portfn` — the existing typed
  slot is the extension point (CLAUDE.md YAGNI + port rule).
- Byte-stability: 82 existing goldens have no port-using inputs; any
  golden regression is a stop condition.

## Operational readiness

Library — the gate suite (tsc, vitest, golden probe, write-set diff)
is the functional SLI. Reversible: git revert, one commit per task, no
migrations. API: `port` fields are internal (`EdgeInfo`); no public API
breakage. Performance: `compassPort` runs once per edge per layout (not
in any hot render loop) — no GC pressure concern.

## Open questions for Scott

1. **T7 ordering:** `portToTbl` is the bottleneck. If parity-render-
   styling lands before this mission starts, html-labels is already
   merged. Confirm whether T7 should be treated as "always run" or
   "conditional on portToTbl presence" — the task spec currently says
   "skip if absent." If Scott prefers a hard dependency order (this
   mission starts only after html-labels merges), update the branch
   base accordingly.
2. **`inside_t` context in `poly_port`:** C's `compassPort` signature
   includes `inside_t *ictxt` (line 2698) for non-rectangular shape
   clipping. The TS `compassPort` can pass `null` for all cases (the
   pointer is only non-null for `poly_port`'s fallback to `findStopSides`
   for exotic polygon shapes). Confirm this is acceptable, or whether
   the `inside_t` clipping path should be ported as a follow-up.
3. **New golden count:** brief targets ≈10 new goldens (≈92 total with
   T7, ≈90 without). Raise if you want one fixture per compass
   direction or per shape family.
