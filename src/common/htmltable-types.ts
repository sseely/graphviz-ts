// SPDX-License-Identifier: EPL-2.0
/**
 * AST types for the HTML-like label parser.
 *
 * @see lib/common/htmltable.h
 */

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

/**
 * Thrown when an unrecognized HTML tag is encountered during parsing.
 * @see lib/common/htmllex.c:lexerror
 */
export class HtmlParseError extends Error {
  readonly tag: string;

  constructor(tag: string) {
    super(`Unknown HTML element <${tag}>`);
    this.tag = tag;
    this.name = 'HtmlParseError';
  }
}

// ---------------------------------------------------------------------------
// Alignment
// ---------------------------------------------------------------------------

/** @see lib/common/htmltable.h HALIGN_* flags */
export type HtmlAlign = 'left' | 'center' | 'right';

/** @see lib/common/htmltable.h VALIGN_* flags */
export type HtmlVAlign = 'top' | 'middle' | 'bottom';

// ---------------------------------------------------------------------------
// Leaf types
// ---------------------------------------------------------------------------

/** @see lib/common/htmltable.h:htmltbl_t (HR separator) */
export interface HtmlHR {
  kind: 'hr';
}

/** @see lib/common/htmltable.h (VR separator between cells) */
export interface HtmlVR {
  kind: 'vr';
}

/**
 * Border-side bitmask constants matching C htmltable.h BORDER_* defines.
 * @see lib/common/htmltable.h:BORDER_LEFT etc.
 */
export const BORDER_LEFT   = 1 << 10; // 0x0400
export const BORDER_TOP    = 1 << 11; // 0x0800
export const BORDER_RIGHT  = 1 << 12; // 0x1000
export const BORDER_BOTTOM = 1 << 13; // 0x2000
export const BORDER_MASK   = BORDER_LEFT | BORDER_TOP | BORDER_RIGHT | BORDER_BOTTOM;

/** @see lib/common/htmltable.h:htmlimg_t */
export interface HtmlImage {
  kind: 'image';
  src: string;
  scale?: string;
  /** AD3 prep: computed image width in points (from htmlimg_t.box). */
  width?: number;
  /** AD3 prep: computed image height in points (from htmlimg_t.box). */
  height?: number;
}

/**
 * A single run of styled text within a line.
 * @see lib/common/htmltable.h:textspan_t / htextspan_t
 */
export interface HtmlTextItem {
  text?: string;
  br?: true;
  brAlign?: HtmlAlign;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  overline?: boolean;
  strikethrough?: boolean;
  subscript?: boolean;
  superscript?: boolean;
  fontColor?: string;
  fontFace?: string;
  fontSize?: number;
}

/** @see lib/common/htmltable.h:htmltxt_t */
export interface HtmlText {
  kind: 'text';
  items: HtmlTextItem[];
}

// ---------------------------------------------------------------------------
// Table types (forward-declared to allow mutual recursion)
// ---------------------------------------------------------------------------

/** Content that can appear inside a table cell */
export type HtmlCellContent = HtmlText | HtmlTable | HtmlImage | HtmlHR;

/** @see lib/common/htmltable.h:htmlcell_t */
export interface HtmlCell {
  kind: 'cell';
  content: HtmlCellContent[];
  port?: string;
  align?: HtmlAlign;
  valign?: HtmlVAlign;
  balign?: HtmlAlign;
  bgcolor?: string;
  color?: string;
  border?: number;
  cellpadding?: number;
  cellspacing?: number;
  /**
   * Bitmask of exposed border sides (BORDER_LEFT|TOP|RIGHT|BOTTOM).
   * @see lib/common/htmltable.h:htmldata_t.sides
   * @see lib/common/htmllex.c:sidesfn
   */
  sides?: number;
  /**
   * Gradient angle in degrees [0, 360].
   * @see lib/common/htmltable.h:htmldata_t.gradientangle
   * @see lib/common/htmllex.c:gradientanglefn
   */
  gradientangle?: number;
  style?: string;
  width?: number;
  height?: number;
  fixedsize?: boolean;
  colspan?: number;
  rowspan?: number;
  href?: string;
  title?: string;
  target?: string;
  id?: string;
  dimen?: { w: number; h: number };
}

/** @see lib/common/htmltable.h:row_t */
export interface HtmlRow {
  cells: (HtmlCell | HtmlVR)[];
}

/** @see lib/common/htmltable.h:htmltbl_t */
export interface HtmlTable {
  kind: 'table';
  rows: HtmlRow[];
  border?: number;
  cellborder?: number;
  cellspacing?: number;
  cellpadding?: number;
  bgcolor?: string;
  color?: string;
  style?: string;
  align?: HtmlAlign;
  valign?: HtmlVAlign;
  fixedsize?: boolean;
  width?: number;
  height?: number;
  href?: string;
  title?: string;
  target?: string;
  id?: string;
  /**
   * Port name for this table (AD6: store only, attachment deferred).
   * @see lib/common/htmltable.h:htmldata_t.port
   */
  port?: string;
  /**
   * Bitmask of exposed border sides (BORDER_LEFT|TOP|RIGHT|BOTTOM).
   * @see lib/common/htmltable.h:htmldata_t.sides
   * @see lib/common/htmllex.c:sidesfn
   */
  sides?: number;
  /**
   * Gradient angle in degrees [0, 360].
   * @see lib/common/htmltable.h:htmldata_t.gradientangle
   * @see lib/common/htmllex.c:gradientanglefn
   */
  gradientangle?: number;
  /**
   * Draw vertical rules between all columns (COLUMNS="*").
   * @see lib/common/htmltable.h:htmltbl_t.vrule
   * @see lib/common/htmllex.c:columnsfn
   */
  vrule?: boolean;
  /**
   * Draw horizontal rules between all rows (ROWS="*").
   * @see lib/common/htmltable.h:htmltbl_t.hrule
   * @see lib/common/htmllex.c:rowsfn
   */
  hrule?: boolean;
  dimen?: { w: number; h: number };
}

/** @see lib/common/htmltable.h:htmllabel_t */
export type HtmlLabel =
  | { kind: 'table'; table: HtmlTable; dimen?: { w: number; h: number } }
  | { kind: 'text'; texts: HtmlText[]; dimen?: { w: number; h: number } };

// ---------------------------------------------------------------------------
// Lexer token types — kept here (no functions) so Lizard does not misparse
// the lex file's function boundaries when it encounters `|` union syntax.
// ---------------------------------------------------------------------------

/** @see lib/common/htmllex.c:startElement */
export interface OpenToken {
  type: 'open';
  tag: string;
  attrs: Record<string, string>;
}

/** @see lib/common/htmllex.c:endElement */
export interface CloseToken {
  type: 'close';
  tag: string;
}

/** @see lib/common/htmllex.c:characterData */
export interface TextToken {
  type: 'text';
  value: string;
}

/** Discriminated union of all lexer token kinds. */
export type Token = OpenToken | CloseToken | TextToken;
