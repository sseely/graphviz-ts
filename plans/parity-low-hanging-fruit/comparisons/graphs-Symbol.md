# Deep case: graphs-Symbol

- **Corpus path:** `graphs/Symbol.gv` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[1]/text[1]/text()[1]`
- **Port:** `&amp;alpha;&amp;beta;…` (entity names double-escaped)
- **Oracle:** `αβγδεζηθικλμνξοπρςστυφχψωϒϖ`
- **Root-cause group:** G6 — HTML named-entity table, e.g. `&alpha;`
- **Why deep:** Plain-string label `"&alpha;&beta;…"` is not decoded before building textspans.
  C calls `htmlEntityUTF8()` in `labels.c:make_label` (UTF-8/default branch), which resolves
  named HTML entities (`&alpha;` → U+03B1, etc.) to UTF-8 bytes. Implementing the full ~200-entry
  named-entity table from C's `entities.c` is a substantial infrastructure addition. The
  `escapeXml` call also double-escapes the leftover `&` to `&amp;`.
- **Follow-on bucket:** `html-entities`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs full HTML named-entity table in make-label.ts). Not fixed in this mission.
