# Deep case: graphs-b60

- **Corpus path:** `graphs/b60.gv` · **engine:** `dot`
- **firstDiffPath:** `svg/g[1]/g[1]/text[1]/text()[1]`
- **Port:** `XXXr��…leXXX` (ô chars corrupted)
- **Oracle:** `XXXrôôôôôôôôôôôôôôleXXX`
- **Root-cause group:** G4 — charset=latin1 / ISO-8859 input
- **Why deep:** Same charset=latin1 issue: `ô` is byte 0xF4 in ISO-8859-1; port reads as UTF-8
  producing U+FFFD for each occurrence. Requires the same `latin1ToUTF8` charset-aware input
  decoding pipeline as graphs-Latin1.
- **Follow-on bucket:** `charset-encoding`

Deferred per ADR-3 (exceeds the localized ≤~30-line / single-module cutoff;
needs charset-aware file reading / latin1ToUTF8 infrastructure). Not fixed in this mission.
