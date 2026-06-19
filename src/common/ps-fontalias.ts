// SPDX-License-Identifier: EPL-2.0
//
// PostScript font-name → SVG font-family translation, ported from C graphviz
// (lib/common/ps_font_equiv.h table + lib/common/textspan.c:66
// translate_postscript_fontname). Native dot maps a standard PostScript font
// name (e.g. "Times-Roman") to a renderer family with a generic SVG fallback
// (e.g. font-family="Times,serif"); the SVG emitter consumes the alias's
// family/weight/stretch/style. Without this the port emitted the name verbatim.
//
// The C lookup is a bsearch with strcasecmp — a case-insensitive EXACT match on
// the name (NOT the fuzzy separator-insensitive normalization used by the
// separate text-metrics table). A lower-cased Map reproduces that exactly.
//
// Platform: ps_font_equiv.h uses "Times"/"Palatino Linotype" on non-Windows and
// "Times New Roman" on _WIN32. The oracle and goldens are non-Windows, so the
// non-Windows family strings are used here.

/**
 * One PostScript-font alias entry (the fields the SVG renderer uses in the
 * default NATIVEFONTS mode). `xfig_code` and the SVGFONTS-only svg_font_weight/
 * svg_font_style fields are intentionally omitted — unused for SVG output.
 * @see lib/common/textspan.h _PostscriptAlias
 */
export interface PostscriptAlias {
  family: string;
  weight: string | null;
  stretch: string | null;
  style: string | null;
  svgFontFamily: string;
}

// Rows ported verbatim from ps_font_equiv.h (macros resolved, non-Windows):
// [name, family, weight, stretch, style, svgFontFamily].
const ALIAS_ROWS: readonly (readonly [
  string, string, string | null, string | null, string | null, string,
])[] = [
  ['AvantGarde-Book', 'URW Gothic L', 'book', null, null, 'sans-Serif'],
  ['AvantGarde-BookOblique', 'URW Gothic L', 'book', null, 'oblique', 'sans-Serif'],
  ['AvantGarde-Demi', 'URW Gothic L', 'demi', null, null, 'sans-Serif'],
  ['AvantGarde-DemiOblique', 'URW Gothic L', 'demi', null, 'oblique', 'sans-Serif'],
  ['Bookman-Demi', 'URW Bookman L', 'demi', null, null, 'serif'],
  ['Bookman-DemiItalic', 'URW Bookman L', 'demi', null, 'italic', 'serif'],
  ['Bookman-Light', 'URW Bookman L', 'light', null, null, 'serif'],
  ['Bookman-LightItalic', 'URW Bookman L', 'light', null, 'italic', 'serif'],
  ['Courier', 'Courier', null, null, null, 'monospace'],
  ['Courier-Bold', 'Courier', 'bold', null, null, 'monospace'],
  ['Courier-BoldOblique', 'Courier', 'bold', null, 'oblique', 'monospace'],
  ['Courier-Oblique', 'Courier', null, null, 'oblique', 'monospace'],
  ['Helvetica', 'Helvetica', null, null, null, 'sans-Serif'],
  ['Helvetica-Bold', 'Helvetica', 'bold', null, null, 'sans-Serif'],
  ['Helvetica-BoldOblique', 'Helvetica', 'bold', null, 'oblique', 'sans-Serif'],
  ['Helvetica-Narrow', 'Helvetica', null, 'condensed', null, 'sans-Serif'],
  ['Helvetica-Narrow-Bold', 'Helvetica', 'bold', 'condensed', null, 'sans-Serif'],
  ['Helvetica-Narrow-BoldOblique', 'Helvetica', 'bold', 'condensed', 'oblique', 'sans-Serif'],
  ['Helvetica-Narrow-Oblique', 'Helvetica', null, 'condensed', 'oblique', 'sans-Serif'],
  ['Helvetica-Oblique', 'Helvetica', null, null, 'oblique', 'sans-Serif'],
  ['NewCenturySchlbk-Bold', 'Century Schoolbook L', 'bold', null, null, 'serif'],
  ['NewCenturySchlbk-BoldItalic', 'Century Schoolbook L', 'bold', null, 'italic', 'serif'],
  ['NewCenturySchlbk-Italic', 'Century Schoolbook L', null, null, 'italic', 'serif'],
  ['NewCenturySchlbk-Roman', 'Century Schoolbook L', 'roman', null, null, 'serif'],
  ['Palatino-Bold', 'Palatino Linotype', 'bold', null, null, 'serif'],
  ['Palatino-BoldItalic', 'Palatino Linotype', 'bold', null, 'italic', 'serif'],
  ['Palatino-Italic', 'Palatino Linotype', null, null, 'italic', 'serif'],
  ['Palatino-Roman', 'Palatino Linotype', 'roman', null, null, 'serif'],
  ['Symbol', 'Symbol', null, null, null, 'fantasy'],
  ['Times-Bold', 'Times', 'bold', null, null, 'serif'],
  ['Times-BoldItalic', 'Times', 'bold', null, 'italic', 'serif'],
  ['Times-Italic', 'Times', null, null, 'italic', 'serif'],
  ['Times-Roman', 'Times', null, null, null, 'serif'],
  ['ZapfChancery-MediumItalic', 'URW Chancery L', 'medium', null, 'italic', 'serif'],
  ['ZapfDingbats', 'Dingbats', null, null, null, 'fantasy'],
];

const ALIAS_BY_NAME: ReadonlyMap<string, PostscriptAlias> = new Map(
  ALIAS_ROWS.map((r) => [
    r[0].toLowerCase(),
    { family: r[1], weight: r[2], stretch: r[3], style: r[4], svgFontFamily: r[5] },
  ]),
);

/**
 * Resolve a PostScript font name to its alias, or null when unknown.
 * Case-insensitive exact match (mirrors C's strcasecmp bsearch).
 * @see lib/common/textspan.c:66 translate_postscript_fontname
 */
export function translatePostscriptFontname(name: string): PostscriptAlias | null {
  return ALIAS_BY_NAME.get(name.toLowerCase()) ?? null;
}

/**
 * Build the SVG font attribute string for a span's font name when it resolves
 * to a PostScript alias: ` font-family="family[,svgFontFamily]"` plus the
 * alias's weight/stretch/style. Returns null when there is no alias (the caller
 * emits the name verbatim). `weight`/`style` report whether the alias set them,
 * so the HTML-flag block can avoid duplicating bold/italic.
 *
 * Family strings contain no XML-special characters, so (like C's raw `%s`) no
 * escaping is applied here.
 * @see plugin/core/gvrender_core_svg.c:462-495 svg_textspan (NATIVEFONTS)
 */
export function fontFamilyAttrs(
  fontName: string | null,
): { attrs: string; weight: boolean; style: boolean } | null {
  const a = fontName !== null ? translatePostscriptFontname(fontName) : null;
  if (a === null) return null;
  const fam = a.svgFontFamily !== a.family ? a.family + ',' + a.svgFontFamily : a.family;
  let attrs = ' font-family="' + fam + '"';
  if (a.weight !== null) attrs += ' font-weight="' + a.weight + '"';
  if (a.stretch !== null) attrs += ' font-stretch="' + a.stretch + '"';
  if (a.style !== null) attrs += ' font-style="' + a.style + '"';
  return { attrs, weight: a.weight !== null, style: a.style !== null };
}
