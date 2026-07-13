// SPDX-License-Identifier: EPL-2.0

/**
 * Record-shape support: label parsing, sizing, field placement, and
 * rendering for shape=record / shape=Mrecord nodes.
 *
 * @see lib/common/shapes.c:parse_reclbl
 * @see lib/common/shapes.c:size_reclbl
 * @see lib/common/shapes.c:resize_reclbl
 * @see lib/common/shapes.c:pos_reclbl
 * @see lib/common/shapes.c:record_init
 * @see lib/common/shapes.c:record_gencode
 */

import type { Node } from '../model/node.js';
import type { Graph } from '../model/graph.js';
import type { Point } from '../model/geom.js';
import type { RenderJob } from '../gvc/job.js';
import type { FieldT, TextlabelT } from './types.js';
import type { TextMeasurer } from './textmeasure.js';
import { makeLabel, makeAnyLabel } from './make-label.js';
import { nodeAttr, readFontAttrs } from './poly-init.js';
import { gvNodesize } from './poly-sizing.js';
import { renderLabel, applyNodeStyle } from './poly-gencode.js';
import { transformPoint } from '../gvc/device.js';
import { emitRoundedBezier } from './poly-shapes.js';
import { parseStyleFlags } from './style-resolve.js';

// Parse-mode bits. @see lib/common/shapes.c
const HASTEXT = 1;
const HASPORT = 2;
const HASTABLE = 4;
const INTEXT = 8;
const INPORT = 16;

// Side bits. @see lib/common/const.h
const BOTTOM = 1;
const RIGHT = 2;
const TOP = 4;
const LEFT = 8;

// Label padding. @see lib/common/macros.h:PAD (GAP = 4)
const PAD_X = 16;
const PAD_Y = 8;

// ---------------------------------------------------------------------------
// Parser state
// ---------------------------------------------------------------------------

/** Walks the record label text (C's global `reclblp`). */
interface RecScan {
  s: string;
  i: number;
  lbl: TextlabelT;
  measurer: TextMeasurer;
  /** Owning node — field labels resolve \N etc. against it (C make_label(n, ...)). */
  obj?: Node;
}

/** Per-parse_reclbl-call state (C locals). */
interface RecState {
  rv: FieldT;
  fi: number;
  mode: number;
  tbuf: string[];   // C `text` buffer via tsp
  hstIdx: number;   // C hstsp - text
  pbuf: string[];   // C `text` buffer via psp (port name)
  hspIdx: number;   // C hspsp - text
  tmpport: string | null;
  ishardspace: boolean;
  fp: FieldT | null;
}

function makeField(): FieldT {
  return {
    size: { x: 0, y: 0 },
    b: { ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } },
    n_flds: 0, lp: null, fld: null, id: null, LR: 0, sides: 0,
  };
}

/** True when s[j] starts an escaped record delimiter. */
export function recIsEscapedDelim(s: string, j: number): boolean {
  if (s[j] !== '\\') return false;
  const nx = s[j + 1];
  return nx === '{' || nx === '}' || nx === '|' || nx === '\\';
}

/** Count top-level fields to bound the fld array. @see parse_reclbl (maxf loop) */
export function recCountFields(p: RecScan): number {
  let maxf = 1;
  let cnt = 0;
  for (let j = p.i; j < p.s.length; j++) {
    if (recIsEscapedDelim(p.s, j)) { j++; continue; }
    const c = p.s[j];
    if (c === '{') cnt++;
    else if (c === '}') cnt--;
    else if (c === '|' && cnt === 0) maxf++;
    if (cnt < 0) break;
  }
  return maxf;
}

// ---------------------------------------------------------------------------
// parse_reclbl case handlers — each returns 0 = continue, -1 = error, 1 = done
// ---------------------------------------------------------------------------

function recOpenPort(p: RecScan, st: RecState): number {
  if (st.mode & (HASTABLE | HASPORT)) return -1;
  st.mode |= HASPORT | INPORT;
  p.i++;
  st.pbuf = [];
  st.hspIdx = 0;
  return 0;
}

function recClosePort(p: RecScan, st: RecState): number {
  if (!(st.mode & INPORT)) return -1;
  const t = st.pbuf;
  if (t.length > 1 && st.hspIdx !== t.length - 1 && t[t.length - 1] === ' ') t.pop();
  st.tmpport = t.join('');
  st.mode &= ~INPORT;
  p.i++;
  return 0;
}

function recOpenTable(p: RecScan, st: RecState, LR: number): number {
  p.i++;
  if (st.mode !== 0 || p.i >= p.s.length) return -1;
  st.mode = HASTABLE;
  const sub = parseReclbl(p, LR ? 0 : 1, false);
  if (sub === null) return -1;
  st.rv.fld![st.fi++] = sub;
  st.fp = sub;
  return 0;
}

function recFlushText(p: RecScan, st: RecState): void {
  if (!(st.mode & (HASTEXT | HASTABLE))) { st.mode |= HASTEXT; st.tbuf.push(' '); }
  if (st.mode & HASTEXT) {
    const t = st.tbuf;
    if (t.length > 1 && st.hstIdx !== t.length - 1 && t[t.length - 1] === ' ') t.pop();
    // C: fp->lp = make_label(n, text, ...) — the node enables \N etc.
    // substitution in field text. @see lib/common/shapes.c:parse_reclbl
    st.fp!.lp = makeAnyLabel(
      t.join(''), false,
      { fontname: p.lbl.fontname, fontsize: p.lbl.fontsize, fontcolor: p.lbl.fontcolor },
      p.measurer, p.obj,
    );
    st.fp!.LR = 1;
    st.tbuf = [];
    st.hstIdx = 0;
  }
}

/** Handles '}', '|', and end-of-string. @see parse_reclbl */
function recEndField(p: RecScan, st: RecState, flag: boolean): number {
  const c = p.i < p.s.length ? p.s[p.i] : '';
  if ((c === '' && !flag) || st.mode & INPORT) return -1;
  if (!(st.mode & HASTABLE)) {
    st.fp = makeField();
    st.rv.fld![st.fi++] = st.fp;
  }
  if (st.tmpport !== null) { st.fp!.id = st.tmpport; st.tmpport = null; }
  recFlushText(p, st);
  if (c !== '') {
    if (c === '}') { p.i++; st.rv.n_flds = st.fi; return 1; }
    st.mode = 0;
    p.i++;
    return 0;
  }
  st.rv.n_flds = st.fi;
  return 1;
}

/** Backslash escape; always falls through to text handling. @see parse_reclbl */
function recBackslash(p: RecScan, st: RecState): void {
  const nx = p.s[p.i + 1];
  if (nx !== undefined) {
    if (nx < ' ') {
      // control character — nothing
    } else if (nx === ' ' && !p.lbl.html) {
      st.ishardspace = true;
    } else {
      st.tbuf.push('\\');
      st.mode |= INTEXT | HASTEXT;
    }
    p.i++;
  }
}

/** Append a text char, collapsing soft spaces. @see parse_reclbl (INTEXT) */
export function recPushText(st: RecState, c: string, html: boolean): void {
  const afterSpace = st.tbuf[st.tbuf.length - 1] === ' ';
  if (!(c === ' ' && !st.ishardspace && afterSpace && !html)) st.tbuf.push(c);
  if (st.ishardspace) st.hstIdx = st.tbuf.length - 1;
}

/** Append a port-name char, collapsing soft spaces. @see parse_reclbl (INPORT) */
export function recPushPort(st: RecState, c: string): void {
  const atStartOrSpace = st.pbuf.length === 0 || st.pbuf[st.pbuf.length - 1] === ' ';
  if (!(c === ' ' && !st.ishardspace && atStartOrSpace)) st.pbuf.push(c);
  if (st.ishardspace) st.hspIdx = st.pbuf.length - 1;
}

export function recTextChar(p: RecScan, st: RecState, c: string): number {
  if (st.mode & HASTABLE && c !== ' ') return -1;
  if (!(st.mode & (INTEXT | INPORT)) && c !== ' ') st.mode |= INTEXT | HASTEXT;
  if (st.mode & INTEXT) recPushText(st, c, p.lbl.html);
  else if (st.mode & INPORT) recPushPort(st, c);
  p.i++;
  return 0;
}

function recDispatch(p: RecScan, st: RecState, LR: number, flag: boolean): number {
  const c = p.s[p.i];
  switch (c) {
    case '<':
      if (p.lbl.html) return recTextChar(p, st, c);
      return recOpenPort(p, st);
    case '>':
      if (p.lbl.html) return recTextChar(p, st, c);
      return recClosePort(p, st);
    case '{': return recOpenTable(p, st, LR);
    case '}': case '|': case undefined: return recEndField(p, st, flag);
    case '\\':
      recBackslash(p, st);
      return recTextChar(p, st, p.s[p.i]);
    default: return recTextChar(p, st, c);
  }
}

/**
 * Parse a record label into a field tree.
 * Returns null on malformed labels.
 * @see lib/common/shapes.c:parse_reclbl
 */
export function parseReclbl(p: RecScan, LR: number, flag: boolean): FieldT | null {
  const rv = makeField();
  rv.fld = new Array<FieldT>(recCountFields(p));
  rv.LR = LR;
  const st: RecState = {
    rv, fi: 0, mode: 0, tbuf: [], hstIdx: 0, pbuf: [], hspIdx: 0,
    tmpport: null, ishardspace: false, fp: null,
  };
  for (;;) {
    // Ignore non-zero control characters.
    if (p.i < p.s.length && p.s[p.i] < ' ' && p.s[p.i] !== '') { p.i++; continue; }
    const r = recDispatch(p, st, LR, flag);
    if (r === -1) return null;
    if (r === 1) break;
    if (p.i > p.s.length) break;
  }
  rv.n_flds = st.fi;
  return rv;
}

// ---------------------------------------------------------------------------
// size_reclbl / resize_reclbl / pos_reclbl
// ---------------------------------------------------------------------------

function recLabelDimen(n: Node, g: Graph, f: FieldT): Point {
  const dimen = { x: f.lp!.dimen.x, y: f.lp!.dimen.y };
  if (dimen.x > 0.0 || dimen.y > 0.0) {
    const m = nodeAttr(n, g, 'margin');
    const parts = m !== undefined ? m.split(',').map(parseFloat) : [];
    if (parts.length > 0 && !Number.isNaN(parts[0])) {
      dimen.x += 2 * parts[0] * 72;
      dimen.y += 2 * (parts.length > 1 && !Number.isNaN(parts[1]) ? parts[1] : parts[0]) * 72;
    } else {
      dimen.x += PAD_X;
      dimen.y += PAD_Y;
    }
  }
  return dimen;
}

/** @see lib/common/shapes.c:size_reclbl */
export function sizeReclbl(n: Node, g: Graph, f: FieldT): Point {
  let d: Point;
  if (f.lp) {
    d = recLabelDimen(n, g, f);
  } else {
    d = { x: 0, y: 0 };
    for (let i = 0; i < f.n_flds; i++) {
      const d0 = sizeReclbl(n, g, f.fld![i]);
      if (f.LR) { d.x += d0.x; d.y = Math.max(d.y, d0.y); }
      else { d.y += d0.y; d.x = Math.max(d.x, d0.x); }
    }
  }
  f.size = d;
  return d;
}

/** @see lib/common/shapes.c:resize_reclbl */
export function resizeReclbl(f: FieldT, sz: Point, nojustify: boolean): void {
  const d = { x: sz.x - f.size.x, y: sz.y - f.size.y };
  f.size = sz;
  if (f.lp && !nojustify) {
    f.lp.space.x += d.x;
    f.lp.space.y += d.y;
  }
  if (f.n_flds) {
    const inc = f.LR ? d.x / f.n_flds : d.y / f.n_flds;
    for (let i = 0; i < f.n_flds; i++) {
      const sf = f.fld![i];
      const amt = Math.trunc((i + 1) * inc) - Math.trunc(i * inc);
      const newsz = f.LR
        ? { x: sf.size.x + amt, y: sz.y }
        : { x: sz.x, y: sf.size.y + amt };
      resizeReclbl(sf, newsz, nojustify);
    }
  }
}

/** Side mask for child i. @see lib/common/shapes.c:pos_reclbl */
export function recSideMask(f: FieldT, i: number, last: number): number {
  if (f.LR) {
    if (i === 0) return i === last ? TOP | BOTTOM | RIGHT | LEFT : TOP | BOTTOM | LEFT;
    return i === last ? TOP | BOTTOM | RIGHT : TOP | BOTTOM;
  }
  if (i === 0) return i === last ? TOP | BOTTOM | RIGHT | LEFT : TOP | RIGHT | LEFT;
  return i === last ? LEFT | BOTTOM | RIGHT : LEFT | RIGHT;
}

/** @see lib/common/shapes.c:pos_reclbl */
export function posReclbl(f: FieldT, ul: Point, sides: number): void {
  f.sides = sides;
  f.b = {
    ll: { x: ul.x, y: ul.y - f.size.y },
    ur: { x: ul.x + f.size.x, y: ul.y },
  };
  const last = f.n_flds - 1;
  const pos = { x: ul.x, y: ul.y };
  for (let i = 0; i <= last; i++) {
    const mask = sides ? recSideMask(f, i, last) : 0;
    posReclbl(f.fld![i], { x: pos.x, y: pos.y }, sides & mask);
    if (f.LR) pos.x += f.fld![i].size.x;
    else pos.y -= f.fld![i].size.y;
  }
}

// ---------------------------------------------------------------------------
// record_init
// ---------------------------------------------------------------------------

/** mapbool for attr strings. @see lib/common/utils.c:mapbool */
function attrBool(n: Node, g: Graph, key: string): boolean {
  const s = nodeAttr(n, g, key);
  if (!s || s.toLowerCase() === 'false' || s.toLowerCase() === 'no') return false;
  if (s.toLowerCase() === 'true' || s.toLowerCase() === 'yes') return true;
  return parseInt(s, 10) !== 0;
}

function recAttrSize(n: Node, g: Graph): Point {
  const w = nodeAttr(n, g, 'width');
  const h = nodeAttr(n, g, 'height');
  return {
    x: (w !== undefined ? parseFloat(w) : 0.75) * 72,
    y: (h !== undefined ? parseFloat(h) : 0.5) * 72,
  };
}

/** Parse the record label, falling back to "\\N" on bad syntax. */
export function recParseOrFallback(
  lbl: TextlabelT, measurer: TextMeasurer, flip: number, obj?: Node,
): FieldT {
  const p: RecScan = { s: lbl.text, i: 0, lbl, measurer, obj };
  const info = parseReclbl(p, flip, true);
  if (info !== null) return info;
  const fb: RecScan = { s: '\\N', i: 0, lbl, measurer, obj };
  return parseReclbl(fb, flip, true)!;
}

/**
 * Parse, size, and place the record label; set node dimensions.
 * The node's label (ND_label) must be built before calling.
 * The +1 on height mirrors C's rounding kluge.
 * @see lib/common/shapes.c:record_init
 */
export function recordInit(n: Node, g: Graph, measurer: TextMeasurer): void {
  const lbl = n.info.label as TextlabelT;
  // C: flip = !GD_realflip — the REAL rankdir (bits 2-3 of GD_rankdir2),
  // honored by records under EVERY engine, not just dot (shapes.c:3672
  // "Always use rankdir to determine how records are laid out").
  const flip = (((g.root.info.rankdir ?? 0) >> 2) & 1) === 1 ? 0 : 1;
  const info = recParseOrFallback(lbl, measurer, flip, n);
  sizeReclbl(n, g, info);
  const sz = recAttrSize(n, g);
  if (!attrBool(n, g, 'fixedsize')) {
    sz.x = Math.max(info.size.x, sz.x);
    sz.y = Math.max(info.size.y, sz.y);
  }
  resizeReclbl(info, sz, attrBool(n, g, 'nojustify'));
  posReclbl(info, { x: -sz.x / 2.0, y: sz.y / 2.0 }, BOTTOM | RIGHT | TOP | LEFT);
  // C: ND_width/ND_height in inches (+1 rounding kluge on height) — stored in the
  // record's own (field-flipped) orientation, NOT swapped.
  n.info.width = info.size.x / 72;
  n.info.height = (info.size.y + 1) / 72;
  // C record_init sets only ND_width/ND_height; ND_lw/rw/ht come from
  // gv_nodesize(n, GD_flip), which SWAPS width↔height under rankdir=LR/RL — the
  // record gets the same flip every other shape does. Setting lw/rw/ht directly
  // from info.size (unflipped) left the node un-rotated while gvPostprocess
  // rotated the bbox → transposed bbox → record drew outside the viewport (925).
  // @see lib/common/shapes.c:record_init + lib/common/utils.c:gv_nodesize
  const ns = gvNodesize(info.size.x, info.size.y + 1, g.root.info.flip === true);
  n.info.lw = ns.lw;
  n.info.rw = ns.rw;
  n.info.ht = ns.ht;
  n.info.shape_info = info;
}

/**
 * Build ND_label for a record node — common_init_node's make_label call with
 * is_record=true, which stores the raw text for record_init to parse.
 * The caller must have bound `n.info.shape` first.
 * @see lib/common/utils.c:441 (make_label with shapeOf(n) == SH_RECORD)
 * @see lib/common/labels.c:139 (is_record branch: rv->text = gv_strdup(str))
 */
export function recordMakeLabel(n: Node, g: Graph, measurer: TextMeasurer): void {
  const labelText = nodeAttr(n, g, 'label') ?? n.name;
  const { fontname, fontsize, fontcolor } = readFontAttrs(n, g);
  n.info.label = makeLabel(labelText, fontname, fontsize, fontcolor, measurer);
}

/**
 * Build the node's record label and field tree; the caller must have bound
 * `n.info.shape` first. Equivalent to common_init_node's label construction
 * followed by record_init.
 *
 * NOTE: C creates ND_xlabel BETWEEN these two steps (utils.c:443-447, before
 * the initfn dispatch on :453). commonInitNode therefore does not call this
 * wrapper — it calls recordMakeLabel / initNodeXLabel / recordInit in C's
 * order. This wrapper remains for the render-time re-init path (poly_init),
 * where C never creates xlabels.
 * @see lib/common/utils.c:common_init_node
 */
export function recordNodeInit(n: Node, g: Graph, measurer: TextMeasurer): void {
  recordMakeLabel(n, g, measurer);
  recordInit(n, g, measurer);
}

// ---------------------------------------------------------------------------
// record_gencode
// ---------------------------------------------------------------------------

/** Field separators and labels. @see lib/common/shapes.c:gen_fields */
export function genFields(job: RenderJob, n: Node, f: FieldT): void {
  const renderer = job.renderer!;
  const coord = n.info.coord ?? { x: 0, y: 0 };
  if (f.lp) {
    const mid = {
      x: (f.b.ll.x + f.b.ur.x) / 2 + coord.x,
      y: (f.b.ll.y + f.b.ur.y) / 2 + coord.y,
    };
    renderLabel(f.lp, mid, renderer, job);
  }
  for (let i = 0; i < f.n_flds; i++) {
    if (i > 0) genFieldSeparator(job, coord, f, f.fld![i]);
    genFields(job, n, f.fld![i]);
  }
}

/** Divider polyline before child field. @see lib/common/shapes.c:gen_fields */
export function genFieldSeparator(job: RenderJob, coord: Point, f: FieldT, child: FieldT): void {
  const a: Point = { x: 0, y: 0 };
  const b: Point = { x: 0, y: 0 };
  if (f.LR) {
    a.x = child.b.ll.x; a.y = child.b.ll.y;
    b.x = a.x; b.y = child.b.ur.y;
  } else {
    b.x = child.b.ur.x; b.y = child.b.ur.y;
    a.x = child.b.ll.x; a.y = b.y;
  }
  const pts = [
    transformPoint({ x: a.x + coord.x, y: a.y + coord.y }, job),
    transformPoint({ x: b.x + coord.x, y: b.y + coord.y }, job),
  ];
  job.renderer!.polyline(pts, job);
}

/**
 * Shape codefn for record nodes: outer box then fields.
 * Box corner order matches gvrender_box: LL, (LL.x,UR.y), UR, (UR.x,LL.y).
 * @see lib/common/shapes.c:record_gencode
 * @see lib/gvc/gvrender.c:gvrender_box
 */
export function recordGencode(rawJob: unknown, rawNode: unknown): void {
  const job = rawJob as RenderJob;
  const n = rawNode as Node;
  if (!job.renderer) return;
  const f = n.info.shape_info as FieldT | undefined;
  if (!f) return;
  const coord = n.info.coord ?? { x: 0, y: 0 };
  const ll = { x: f.b.ll.x + coord.x, y: f.b.ll.y + coord.y };
  const ur = { x: f.b.ur.x + coord.x, y: f.b.ur.y + coord.y };
  // C resolves node style for records exactly as for poly nodes: stylenode +
  // penColor + (style.filled ? findFill). This sets obj fill/pen so the box
  // and the field dividers stroke/fill correctly. @see shapes.c:record_gencode
  const filled = job.obj !== null && applyNodeStyle(job.obj, n, job);
  drawRecordBox(job, n, ll, ur, filled);
  genFields(job, n, f);
}

/**
 * Draw the record outer box: a rounded bezier `<path>` when the node is Mrecord
 * or `style=rounded` (C's SPECIAL_CORNERS branch, with AF order LL, (UR.x,LL.y),
 * UR, (LL.x,UR.y)), else the sharp `<polygon>` (gvrender_box order). `filled`
 * carries C's record_gencode fill flag through to gvrender_box/round_corners.
 * @see lib/common/shapes.c:record_gencode
 */
function drawRecordBox(job: RenderJob, n: Node, ll: Point, ur: Point, filled: boolean): void {
  const isMrecord = nodeAttr(n, n.root, 'shape') === 'Mrecord';
  const rounded = isMrecord || parseStyleFlags(nodeAttr(n, n.root, 'style')).rounded;
  if (rounded) {
    const af = [{ x: ll.x, y: ll.y }, { x: ur.x, y: ll.y }, { x: ur.x, y: ur.y }, { x: ll.x, y: ur.y }];
    emitRoundedBezier(af, { x: 0, y: 0 }, filled, { renderer: job.renderer!, job });
    return;
  }
  const pts = [{ x: ll.x, y: ll.y }, { x: ll.x, y: ur.y }, { x: ur.x, y: ur.y }, { x: ur.x, y: ll.y }]
    .map((q) => transformPoint(q, job));
  job.renderer!.polygon(pts, filled, job);
}
