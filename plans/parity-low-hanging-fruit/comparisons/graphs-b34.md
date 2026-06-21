# Deep case: graphs-b34

- **Corpus path:** `graphs/b34.gv` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[14]/text[1]/text()[1]`
- **Port:** `monta�as` (replacement char for ñ)
- **Oracle:** `montañas`
- **Root-cause group:** G4 — charset=latin1 / ISO-8859 input
- **Why deep:** Same charset=latin1 issue as graphs-Latin1: file is ISO-8859-1, `ñ` is byte 0xF1,
  port reads as UTF-8 producing U+FFFD. C calls `latin1ToUTF8()` at `labels.c:172`. Requires
  charset-aware input decoding infrastructure.
- **Follow-on bucket:** `charset-encoding`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs charset-aware file reading / latin1ToUTF8 infrastructure). Not fixed in this mission.
