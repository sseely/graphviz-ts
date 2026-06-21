# Deep case: windows-Latin1

- **Corpus path:** `windows/Latin1.gv` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[1]/text[1]/text()[1]`
- **Port:** oracle unavailable (native dot error) — parser rejects: `Expected … but "?" found`
- **Oracle:** oracle unavailable (native dot error)
- **Root-cause group:** G4 — charset=latin1 / ISO-8859 input
- **Why deep:** ISO-8859 file (same structure as share-Latin1, different node positions); bytes
  0xE1–0xF4 in unquoted label values fail UTF-8 decode and are rejected by the parser. Requires
  the same latin1 re-decode infrastructure as share-Latin1.
- **Follow-on bucket:** `charset-encoding`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs charset-aware file reading / latin1ToUTF8 infrastructure). Not fixed in this mission.
