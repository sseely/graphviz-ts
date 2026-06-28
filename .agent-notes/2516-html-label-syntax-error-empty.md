<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: 2516 — HTML label syntax error must yield an EMPTY label

- **Context**: 2516 diverged (childCount: port 1 extra <text>). Label is
  `<yada yada <table>...</table>>` — loose text before a top-level <TABLE>.
- **Finding**: native rejects this (`Error: Syntax error: non-space string used
  before <TABLE>`, htmlparse.y:288) and renders the node with NO label (empty
  egg). The port's HTML parser was lenient: parseHtmlLabel only routed to the
  table branch when the FIRST real token was <TABLE>; otherwise parseText parsed
  the leading text and silently left the <TABLE> unparsed → port drew "yada yada"
  and sized the egg for it (115pt vs native 65pt).
- **Two-part fix**:
  1. parseHtmlLabel (htmltable-parse.ts): after the text branch's parseText, if
     the next token is an open <TABLE>, throw HtmlParseError — non-space text
     before a top-level table is a hard error (matches the C table rule).
  2. makeHtmlLabel (htmltable-pos.ts): on parse error, return an EMPTY label
     (`makeLabel('')`), NOT the previous raw-markup plain-text fallback. C aborts
     the parse (YYABORT) and leaves the label empty.
- **Verified C behavior**: native renders NO <text> for BOTH a text-before-<TABLE>
  error AND a mismatched-tag error → empty label is correct, not the object name
  (an old test comment claimed "C uses object name"; disproven against native and
  the test was corrected).
- **Result**: 2516 diverged → BYTE-MATCH, 0 regressions (no other corpus graph
  relied on the raw-markup fallback). byte-match 486→487.
- **Confidence**: High — byte-match + native cross-check on two error types.
