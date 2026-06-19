// SPDX-License-Identifier: EPL-2.0
//
// Output-layer support, ported from lib/common/emit.c (parse_layers,
// layer_index, selectedLayer, node_in_layer, edge_in_layer). A graph with a
// `layers="a:b:c"` attribute renders once per layer; each node/edge appears
// only in the layers it belongs to (its `layer` attribute, or all layers when
// it has none). All of this is inert unless numLayers > 1.

import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';
import type { Edge } from '../model/edge.js';

/** @see lib/common/const.h:82-83 */
const DEFAULT_LAYERSEP = ':\t ';
const DEFAULT_LAYERLISTSEP = ',';

/** Parsed layer configuration for a graph. */
export interface LayerInfo {
  /** Index 0 is the inferred (unnamed) entry; 1..numLayers are the names. */
  layerIDs: (string | null)[];
  numLayers: number;
  sep: string;
  listSep: string;
}

/** Split `s` on any character in the `delims` set, dropping empty tokens
 * (mirrors C strtok over a delimiter set). */
function splitOnSet(s: string, delims: string): string[] {
  if (delims === '') return s === '' ? [] : [s];
  const cls = '[' + delims.replace(/[\\\]^-]/g, '\\$&') + ']';
  return s.split(new RegExp(cls)).filter((x) => x.length > 0);
}

/** @see lib/common/emit.c:1037 parse_layers */
export function parseLayers(g: Graph): LayerInfo {
  const p = g.attrs.get('layers');
  const sep = g.attrs.get('layersep') || DEFAULT_LAYERSEP;
  let listSep = g.attrs.get('layerlistsep') || DEFAULT_LAYERLISTSEP;
  // Conflict: a char in both sep sets → ignore listSep (C warns + clears it).
  if ([...sep].some((c) => listSep.includes(c))) listSep = '';
  if (p === undefined || p === '') {
    return { layerIDs: [], numLayers: 1, sep, listSep };
  }
  const toks = splitOnSet(p, sep);
  return { layerIDs: [null, ...toks], numLayers: toks.length, sep, listSep };
}

function isNaturalNumber(s: string): boolean {
  return /^[0-9]+$/.test(s);
}

/** @see lib/common/emit.c:layer_index */
function layerIndex(info: LayerInfo, str: string, all: number): number {
  if (str === 'all') return all;
  if (isNaturalNumber(str)) return parseInt(str, 10);
  for (let i = 1; i <= info.numLayers; i++) {
    if (info.layerIDs[i] === str) return i;
  }
  return -1;
}

/** Match one comma-part: a single layer or a `sep`-range. */
function partSelects(info: LayerInfo, layerNum: number, part: string): boolean {
  const ws = splitOnSet(part, info.sep);
  if (ws.length === 0) return false;
  if (ws.length >= 2) {
    let n0 = layerIndex(info, ws[0]!, 0);
    let n1 = layerIndex(info, ws[1]!, info.numLayers);
    if (n0 < 0 && n1 < 0) return false;
    if (n0 > n1) [n0, n1] = [n1, n0];
    return n0 <= layerNum && layerNum <= n1;
  }
  return layerIndex(info, ws[0]!, layerNum) === layerNum;
}

/** @see lib/common/emit.c:957 selectedLayer */
export function selectedLayer(info: LayerInfo, layerNum: number, spec: string): boolean {
  for (const part of splitOnSet(spec, info.listSep)) {
    if (partSelects(info, layerNum, part)) return true;
  }
  return false;
}

/** All edges incident to `n` (either endpoint). */
function incidentEdges(n: Node, g: Graph): Edge[] {
  return g.edges.filter((e) => e.tail === n || e.head === n);
}

/** @see lib/common/emit.c:1585 node_in_layer */
export function nodeInLayer(info: LayerInfo, layerNum: number, n: Node, g: Graph): boolean {
  if (info.numLayers <= 1) return true;
  const pn = n.attrs.get('layer') ?? '';
  if (selectedLayer(info, layerNum, pn)) return true;
  if (pn !== '') return false;
  const edges = incidentEdges(n, g);
  if (edges.length === 0) return true;
  return edges.some((e) => {
    const pe = e.attrs.get('layer') ?? '';
    return pe === '' || selectedLayer(info, layerNum, pe);
  });
}

/** @see lib/common/emit.c:1604 edge_in_layer */
export function edgeInLayer(info: LayerInfo, layerNum: number, e: Edge): boolean {
  if (info.numLayers <= 1) return true;
  const pe = e.attrs.get('layer') ?? '';
  if (selectedLayer(info, layerNum, pe)) return true;
  if (pe !== '') return false;
  return [e.tail, e.head].some((n) => {
    const pn = n.attrs.get('layer') ?? '';
    return pn === '' || selectedLayer(info, layerNum, pn);
  });
}
