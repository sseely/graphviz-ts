# Triage: text-content bucket

Probe date: 2026-06-21. All 7 cases use engine `dot`.

---

## Per-case table

| id | engine | firstDiffPath | port value | oracle value | root cause | verdict | fixModule | fixPlan |
|----|--------|---------------|------------|--------------|------------|---------|-----------|---------|
| 1990 | dot | `svg/g[1]/g[2]/title[1]/text()[1]` | `0⋯1 'a'0⋯7 ❰A❱` | `0⋯1 &#39;a&#39;` | QAtom implicit-adjacency concat: after matching `"0⋯1 'a'"`, the PEG `rest:( _ s2:QuotedString )*` greedily matches the NEXT LINE's node name across a newline; yields a concatenated string. Secondary: `escapeXml` does not escape `'` as `&#39;`. | simple | `src/parser/dot.pegjs` + `src/render/svg-helpers.ts` | (1) Remove implicit-adjacency from QAtom: `QAtom = s:QuotedString / HtmlString` (drop the `rest` part). (2) Add `r = r.replace(/'/g, '&#39;');` to `escapeXml`. |
| graphs-Latin1 | dot | `svg/g[1]/g[1]/text[1]/text()[1]` | `���…` (27 replacement chars) | `áâãäåæçèéêëìíîïðñòóôõöøùúûü` | File is ISO-8859-1; probe reads it as UTF-8 → invalid byte sequences → U+FFFD. C calls `latin1ToUTF8()` in `labels.c:make_label` (CHAR_LATIN1 branch) to recode the raw Latin-1 bytes to valid UTF-8 before creating textspans. Port has no charset handling. | deep | n/a | Requires charset-aware file reading or an input-encoding pre-processing step (read raw bytes + `latin1ToUTF8` conversion); affects the full render pipeline for any `charset=latin1` graph. |
| graphs-Symbol | dot | `svg/g[1]/g[1]/text[1]/text()[1]` | `&amp;alpha;&amp;beta;…` (entity names double-escaped) | `αβγδεζηθικλμνξοπρςστυφχψωϒϖ` | Plain-string label `"&alpha;&beta;…"` is not decoded before building textspans. C calls `htmlEntityUTF8()` in `labels.c:make_label` (UTF-8/default branch), which resolves named HTML entities (`&alpha;` → U+03B1, etc.) to UTF-8 bytes. Port never calls an equivalent. Additionally, `escapeXml` escapes the leftover `&` a second time → `&amp;alpha;`. | deep | n/a | Requires implementing the full HTML named-entity table (`entities.c` in graphviz has ~200 entries) and calling it from `make-label.ts`. Layout also diverges because text-width measurement uses the wrong string. |
| graphs-b34 | dot | `svg/g[1]/g[14]/text[1]/text()[1]` | `monta�as` (replacement char for ñ) | `montañas` | Same charset=latin1 issue as graphs-Latin1: file is ISO-8859-1, `ñ` is byte 0xF1, port reads as UTF-8 → U+FFFD. | deep | n/a | Same fix as graphs-Latin1 (charset-aware reading + `latin1ToUTF8`). |
| graphs-b56 | dot | `svg/g[1]/g[1]/text[1]/text()[1]` | `Torw�chter` (ä corrupted) | `Torwächter` | Same charset=latin1 issue: `ä` = 0xE4 in ISO-8859-1; port reads as UTF-8 → U+FFFD. | deep | n/a | Same fix as graphs-Latin1. |
| graphs-b60 | dot | `svg/g[1]/g[1]/text[1]/text()[1]` | `XXXr��…leXXX` (ô chars corrupted) | `XXXrôôôôôôôôôôôôôôleXXX` | Same charset=latin1 issue: `ô` = 0xF4 in ISO-8859-1; port reads as UTF-8 → U+FFFD. | deep | n/a | Same fix as graphs-Latin1. |
| graphs-b81 | dot | `svg/g[1]/g[1]/text[1]/text()[1]` | `&amp;lt; 122.2141.0&amp;gt; ` | `&lt; 122.2141.0&gt; ` | Label string `"&lt; 122.2141.0&gt;"` contains basic XML entities. C decodes them via `htmlEntityUTF8()` (`utils.c:1223-1239`): `&lt;` → `<` (0x3C), then the SVG emitter re-encodes `<` → `&lt;`. Port has no `htmlEntityUTF8` call; `escapeXml` receives the literal `&lt;` string and double-escapes the `&` to `&amp;lt;`. (Note: `'` → `&#39;` and `-` → `&#45;` divergences also present in the same labels but at a later diff line.) | simple | `src/common/make-label.ts` + `src/render/svg-helpers.ts` | Implement `htmlEntityUTF8` for at least the five basic XML entities (`&lt;` `&gt;` `&amp;` `&quot;` `&apos;`) plus `&#NNN;` numeric forms in `make-label.ts:makeAnyLabel` (UTF-8 path). Add `'` → `&#39;` (and optionally `-` → `&#45;` in textspan context) to `escapeXml` / a new `escapeXmlText` variant in `svg-helpers.ts`. |

---

## Supporting evidence

### 1990 — QAtom implicit adjacency bug (confirmed by parser test)

Running `parse('…1990.dot…')` directly shows node names like
`"0⋯1 'a'0⋯7 ❰A❱"` (length 14) instead of `"0⋯1 'a'"` (length 7). The
PEG `QAtom` rule currently allows two adjacent `QuotedString`s separated
only by whitespace (including newline) to concatenate:

```
QAtom
  = s:QuotedString rest:( _ s2:QuotedString { return s2; } )*
```

C's grammar only allows concatenation with an explicit `+` operator:
`qatom '+' T_qatom`. The fix removes the implicit `rest` arm from `QAtom`.

The secondary `escapeXml` apostrophe issue: C's `gv_xml_escape` (`xml.c:99`)
maps `'` → `&#39;`. Port's `escapeXml` (`svg-helpers.ts:61-66`) has no
such mapping, so `'` passes through raw.

### graphs-b81 — htmlEntityUTF8 not called, entity double-escaping

`b81.gv` contains pure ASCII labels that include XML entities like
`&lt; 122.2141.0&gt;`. C's `labels.c:make_label` (line 175) calls
`htmlEntityUTF8(rv->text, g)` which decodes these to the literal `<` and
`>` chars before textspan creation. The SVG renderer then re-encodes with
`gv_xml_escape` (raw=1): `<` → `&lt;` (correct single escaping).

Port's `makeAnyLabel` in `make-label.ts` skips this step entirely: `&lt;`
stays in the string, then `escapeXml` escapes `&` → `&amp;`, yielding
`&amp;lt;` (double-escaped).

Same labels also show `'` → raw `'` (port) vs `&#39;` (oracle) and
`-` → raw `-` (port) vs `&#45;` (oracle), from missing `escapeXml` mappings.

### charset cases (Latin1, b34, b56, b60)

All four files are ISO-8859 encoded and carry `charset=latin1`. The probe
(`triage-probe.mjs:25`) reads files with `readFileSync(input, 'utf8')`,
corrupting Latin-1 bytes 0x80–0xFF. C reads the file as raw bytes and
converts them through `latin1ToUTF8()` called at `labels.c:172`. This
requires either passing raw bytes into `renderSvg` or adding a charset
detection + re-encoding step.

---

## Summary

**Simple: 2 cases** — `1990` (QAtom parser fix + `escapeXml` apostrophe)
and `graphs-b81` (basic XML entity decoding in `make-label.ts` + `escapeXml`
apostrophe/dash).

**Deep: 5 cases** — `graphs-Latin1`, `graphs-b34`, `graphs-b56`, `graphs-b60`
(charset=latin1 input-encoding infrastructure) and `graphs-Symbol` (full HTML
named-entity table needed for `&alpha;` → α etc.).

### Batch-2 fix candidates by shared root cause

| Group | Cases | Shared fix | fixModule(s) |
|-------|-------|-----------|--------------|
| QAtom implicit concat + apostrophe | 1990 | Remove implicit adjacency from `QAtom`; add `'`→`&#39;` to `escapeXml` | `src/parser/dot.pegjs`, `src/render/svg-helpers.ts` |
| Basic XML entity decoding + apostrophe/dash | graphs-b81 | Add `htmlEntityUTF8`-equivalent for XML entities (`&lt;` `&gt;` `&amp;` `&quot;` `&apos;` `&#NNN;`) in `makeAnyLabel`; extend `escapeXml` with `'`→`&#39;` | `src/common/make-label.ts`, `src/render/svg-helpers.ts` |
| charset=latin1 encoding | Latin1, b34, b56, b60 | Deep — defer | — |
| HTML named entities | Symbol | Deep — defer | — |
