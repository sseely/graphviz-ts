# Parser-Gap Triage

All 10 oracle inputs confirmed: `GVBINDIR=/tmp/gvplugins <dot> -Tsvg <input>` produces
SVG on stdout for every case (some with stderr warnings/errors but non-empty SVG stdout).

## Case Table

| id | engine | error | offending construct | root cause | verdict | fixModule | fixPlan |
|----|--------|-------|---------------------|------------|---------|-----------|---------|
| 1308_1 | dot | `Expected ... but "?" found` | ISO-8859 bytes 0xDA (×6) in identifier names; C treats bytes ≥0x80 as NAME chars, JS reads file as UTF-8 → invalid sequences become U+FFFD | Charset: file is ISO-8859, harness reads as UTF-8 → replacement chars rejected by grammar | deep (charset) | `src/parser/dot.pegjs` | Requires encoding-detection or latin1 re-decode at the harness layer (ADR-5) |
| 1367 | dot | `Expected ... but "?" found` | Single byte `0x80` embedded in a node identifier (GUID-style name `Se3\x80fa84b11d69e3…`); C allows byte 0x80 as a NAME char | Charset: file is non-ISO-extended-ASCII (one byte 0x80), UTF-8 decode replaces it with U+FFFD | deep (charset) | `src/parser/dot.pegjs` | Same latin1 re-decode infra as ADR-5 |
| 1474 | dot | `Expected … end of input but "L" found` | Binary/corrupt file (362 KB, 224 null bytes, `data` filetype); C's lex scanner recovers and ignores trailing garbage after `}`; the PEG grammar (via peggy default) requires consuming all input | Two-part: (1) binary/corrupt content with high bytes needs charset fallback, (2) grammar requires strict EOF while C allows trailing content after closing `}` | deep (charset + binary input) | `src/parser/dot.pegjs` | Even with latin1 decode, null bytes and binary content would remain; full fix requires tolerant lexer mode not just encoding |
| 1489 | dot | `Expected … but "?" found` | `Non-ISO extended-ASCII` file with bytes 0x80-0xFF scattered throughout; includes `\x00` null bytes and NEL (0x85) line terminators; C lexer processes raw bytes as NAME chars | Charset: binary/corrupt file, UTF-8 decode fails across entire content | deep (charset + binary input) | `src/parser/dot.pegjs` | Same as 1474; binary content with null bytes is beyond latin1-decode fix alone |
| 1494 | dot | `Expected … but "?" found` | `data` filetype (binary); C emits "Invalid 3-byte UTF8" warning and treats as Latin-1; port reads as UTF-8 | Charset: binary file, UTF-8 decode fails | deep (charset) | `src/parser/dot.pegjs` | Latin1 re-decode infra (ADR-5) |
| 1676 | dot | `Expected … but "?" found` | `data` filetype (binary); similar to 1489 — binary content with bytes 0x80-0xFF and null bytes | Charset: binary file, UTF-8 decode fails | deep (charset + binary input) | `src/parser/dot.pegjs` | Same as 1474/1489 |
| 2682 | dot | `Expected "." or [0-9] but ">" found` | `QAtom` grammar rule implicitly concatenates adjacent `QuotedString` tokens via `rest: ( _ s2:QuotedString )*`; in `a="x" "A" -> "B"`, the value of `a` greedily consumes `"A"` as implicit string concat, leaving `-> "B"` as the next stmt; `-` is consumed by `NumericLiteral`, `>` is unexpected | Grammar bug: `QAtom` allows juxtaposition string concat; C DOT only concatenates quoted strings with `+` (line 162 of dot.pegjs); semicolons or unquoted values work around it | **simple** | `src/parser/dot.pegjs` | Remove `rest: ( _ s2:QuotedString { return s2; } )*` from `QAtom` (line 162); `+`-concat is already handled by outer `Atom` rule at line 155 |
| graphs-russian | dot | `Expected … but "К" found` | Valid UTF-8 Cyrillic identifiers; grammar `Name` rule uses `[A-Za-z_\x80-\xFF]` (code points 128–255); Cyrillic `К` is U+041A (1050 > 255), outside the range; C sees raw UTF-8 bytes 0xD0/0x9A (each ≥0x80) and treats them as NAME chars individually | Grammar range too narrow: `\x80-\xFF` in Peggy is a Unicode code-point range [128,255], but multi-byte UTF-8 sequences for non-Latin scripts have code points > 255 | **simple** | `src/parser/dot.pegjs` | Widen `Name` and `NameContinue` char classes from `\x80-\xFF` to `\x80-￿` (or `\x80-\u{10FFFF}`) to match C's "any byte ≥ 0x80 is a NAME char" semantics when reading UTF-8 input |
| share-Latin1 | dot | `Expected … but "?" found` | ISO-8859 file; unquoted node label contains bytes 0xE1-0xF4 (Latin-1 accented chars); read as UTF-8 → invalid sequences → U+FFFD; C treats as NAME chars | Charset: ISO-8859 file, UTF-8 decode fails on high bytes | deep (charset) | `src/parser/dot.pegjs` | Latin1 re-decode infra (ADR-5); file has no `charset=` attribute |
| windows-Latin1 | dot | `Expected … but "?" found` | ISO-8859 file; same structure as share-Latin1, different node positions; bytes 0xE1-0xF4 in unquoted label value | Charset: ISO-8859 file, UTF-8 decode fails on high bytes | deep (charset) | `src/parser/dot.pegjs` | Latin1 re-decode infra (ADR-5); file has no `charset=` attribute |

## Summary

**Simple: 2** | **Deep: 8**

### Simple cases (two, both grammar fixes in `src/parser/dot.pegjs`)

1. **`2682` — implicit QAtom string concatenation** (unique root cause)
   - `QAtom` rule (line 162) has `rest: ( _ s2:QuotedString )*` which allows adjacent quoted
     strings to be silently concatenated. This causes the value of a graph-attribute assignment
     (e.g., `a="x"`) to greedily consume the next quoted token (e.g., `"A"`) when no semicolon
     separates them, leaving `->` as the next statement opener. The `-` is then consumed by
     `NumericLiteral`, and `>` fails.
   - **Fix**: delete `rest: ( _ s2:QuotedString { return s2; } )*` from `QAtom`; the `+`
     operator concatenation is handled by the outer `Atom` rule (line 155) which is faithful to C.

2. **`graphs-russian` — Name char class too narrow for Unicode** (unique root cause)
   - `Name` and `NameContinue` rules use `[A-Za-z_\x80-\xFF]`. In Peggy/JS this is the Unicode
     code-point range 128–255. Valid UTF-8 Cyrillic (U+0400+) has code points > 255 and is
     excluded. C's lexer allows any byte ≥ 0x80 as a NAME character, so multi-byte UTF-8
     sequences for Cyrillic appear as valid NAME bytes to C.
   - **Fix**: change `\x80-\xFF` → `\x80-￿` (or `\x80-\u{10FFFF}`) in `Name` (line 210)
     and `NameContinue` (line 229) to cover the full BMP and beyond.

### Deep cases (8, all classified ADR-5 charset)

All remaining 8 cases are non-UTF-8 or binary inputs:
- **ISO-8859 / Latin-1**: `1308_1`, `1367`, `share-Latin1`, `windows-Latin1` — valid DOT
  content but encoded in ISO-8859; high bytes fail UTF-8 decode and produce U+FFFD. None have
  a `charset=` graph attribute. Fix requires encoding-detection or forced latin1 re-decode at
  the harness input layer.
- **Binary/corrupt + charset**: `1474`, `1489`, `1494`, `1676` — files classified as `data` or
  `Non-ISO extended-ASCII`; contain null bytes, NEL terminators, and binary garbage mixed with
  partial DOT syntax. The C lex scanner processes these with byte-level Latin-1 fallback and
  tolerates trailing binary content after the closing `}`. Fixing these cases would require both
  latin1 re-decode AND either (a) a tolerant lexer that skips non-parseable trailing content,
  or (b) accepting that these corrupt inputs are out of scope. All are presumed deep per ADR-5.
