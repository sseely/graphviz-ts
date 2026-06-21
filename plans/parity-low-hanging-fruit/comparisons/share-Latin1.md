# Deep case: share-Latin1

- **Corpus path:** `share/Latin1.gv` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[1]/text[1]/text()[1]`
- **Port:** oracle unavailable (native dot error) — parser rejects: `Expected … but "?" found`
- **Oracle:** oracle unavailable (native dot error)
- **Root-cause group:** G4 — charset=latin1 / ISO-8859 input
- **Why deep:** ISO-8859 file with no `charset=` graph attribute; bytes 0xE1–0xF4 in unquoted
  node labels fail UTF-8 decode producing U+FFFD, which the parser then rejects as invalid name
  characters. C treats raw bytes ≥ 0x80 as NAME chars via its byte-level Latin-1 fallback.
  Requires encoding-detection or forced latin1 re-decode at the harness input layer.
- **Follow-on bucket:** `charset-encoding`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs charset-aware file reading / latin1ToUTF8 infrastructure). Not fixed in this mission.
