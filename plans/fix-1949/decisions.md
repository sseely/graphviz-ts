# Architecture decisions — fix-1949

## AD-1: D1 fix locus = the HTML lexer text-run token (not the parser)
- **Context:** HTML-like label text runs reach `sizeTextContent` /
  emit undecoded. C decodes entities via expat during tokenization
  (`htmllex.c:scanEntity`), so the decoded UTF-8 text is the single
  representation used by both sizing and emit.
- **Decision:** Decode entities once in `htmltable-lex.ts:scanText`
  (the single choke point that produces `text` tokens), reusing the
  existing `htmlEntityUTF8` decoder used by the plain-label path.
- **Consequence:** Sizing measures decoded `[el...`; emit re-escapes
  from the decoded text (matches native's literal `[`). No double-decode
  (emit reads `line.text` verbatim). Risk: `&amp;/&lt;/&gt;` must survive
  emit re-escaping — covered by a test.

## AD-2: D2 fix = inherit node pen color as the cell-border fallback
- **Context:** `htmltable-emit.ts:162` hardcodes
  `color: d.color ?? 'black'`. Native inherits the current pen color
  (node `color=red`) when a cell/table border has no explicit color.
- **Decision:** Thread the node's resolved pen color into the border
  decoration fallback instead of the literal `'black'`.
- **Consequence:** Cell borders without an explicit color follow the node
  color. Must not change borders that DO set an explicit color.

## Rejected hypotheses (ruled out with evidence)
- **Compound-edge MR (`makeCompoundEdge`):** already ported
  (`compound.ts` guards match fixed C `compound.c:323/384`); the port never
  asserted. Stripping `lhead`/`taillabel` left the +18.7 unchanged.
- **Cluster margin / keepout / contain:** disabling `keepoutLeft` did not
  move `structDefaultAuto`; in LR the x-axis is the rank axis (set_ycoords),
  not the order-axis aux NS.
- **Ranking/mincross:** native COLLECT dump shows identical ranks
  (structParty & structDefaultAuto both rank 4).
- **Text measurement / font:** plain `label="[el..."` matches byte-for-byte;
  only the HTML-delimited form diverges.

## Rollback
Reversible — pure layout/emit logic, no data model or persisted state.
