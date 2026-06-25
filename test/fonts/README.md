# Bundled test fonts

Committed font fixtures for the **measurement-layer** tests (mission:
text-measurement architecture, T2.1). They are read at test time by `fontkit`
(a devDependency) to validate that real-font shaping — kerning, GSUB glyph
substitution, charset coverage, monospace advances — is handled correctly and
**deterministically** (the tables derive only from these committed files + the
bundled JS shaper, so results are identical on every platform).

These are **test/dev-only assets** — they are NOT shipped in the runtime package
(the library is zero-runtime-dep and never reads font files).

| File | Source | License |
|------|--------|---------|
| `DejaVuSans.ttf` | DejaVu Fonts 2.37 (via `dejavu-fonts-ttf` on jsDelivr) | DejaVu license (Bitstream Vera derivative) — free, redistributable |
| `FiraCode-Regular.ttf` | Fira Code 6.2 (tonsky/FiraCode via jsDelivr) | SIL Open Font License 1.1 |

Why these two:
- **DejaVu Sans** — proportional, with real **kerning** (e.g. `VA`, `To`),
  **GSUB** ligatures (`fi` → one glyph), and broad **charset** (Latin-1, Greek,
  punctuation) — exactly the cases a per-char width table cannot represent.
- **Fira Code** — **monospace** (uniform advances; `<=` is two cells, not one),
  used to show that string width is font-shaping-specific.
