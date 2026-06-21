# Deep case: graphs-Latin1

- **Corpus path:** `graphs/Latin1.gv` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[1]/text[1]/text()[1]`
- **Port:** `���…` (27 Unicode replacement characters U+FFFD)
- **Oracle:** `áâãäåæçèéêëìíîïðñòóôõöøùúûü`
- **Root-cause group:** G4 — charset=latin1 / ISO-8859 input
- **Why deep:** File is ISO-8859-1 encoded; the harness reads it as UTF-8, corrupting all high
  bytes (0x80–0xFF) to U+FFFD. C calls `latin1ToUTF8()` in `labels.c:make_label` (CHAR_LATIN1
  branch) to recode raw Latin-1 bytes to valid UTF-8. Fixing requires charset-aware input
  decoding or a pre-processing step at the render pipeline entry point.
- **Follow-on bucket:** `charset-encoding`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs charset-aware file reading / latin1ToUTF8 infrastructure). Not fixed in this mission.
