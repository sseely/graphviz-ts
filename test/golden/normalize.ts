// SPDX-License-Identifier: EPL-2.0
import { DOMParser } from '@xmldom/xmldom';
import type { Node as XmlNode } from '@xmldom/xmldom';

// xmldom's Node interface does not export nodeType constants in all versions,
// so define them locally rather than referencing Node.ELEMENT_NODE etc.
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;
const PROCESSING_INSTRUCTION_NODE = 7;

/** Numeric SVG attribute names whose values need normalization. */
const NUMERIC_ATTRS = new Set([
  'x', 'y', 'cx', 'cy', 'rx', 'ry',
  'width', 'height',
  'x1', 'y1', 'x2', 'y2',
  'dx', 'dy', 'r',
]);

/**
 * Normalize a single floating-point number to 6 significant figures.
 * Strips trailing zeros so `1.000000` becomes `1` and `1.50000` becomes `1.5`.
 */
function normalizeNumber(raw: string): string {
  const n = parseFloat(raw);
  if (isNaN(n)) return raw;
  return parseFloat(n.toPrecision(6)).toString();
}

/**
 * Re-serialize all numeric tokens in an SVG path `d` attribute.
 * Non-numeric tokens (command letters) are preserved verbatim.
 */
function normalizePathD(d: string): string {
  return d.replace(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g, (m) =>
    normalizeNumber(m),
  );
}

/**
 * Normalize a `points` attribute (polygon/polyline) — space/comma-separated pairs.
 */
function normalizePoints(points: string): string {
  return points.replace(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g, (m) =>
    normalizeNumber(m),
  );
}

/**
 * Normalize a `transform` attribute — numeric parameters inside any function.
 */
function normalizeTransform(transform: string): string {
  return transform.replace(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g, (m) =>
    normalizeNumber(m),
  );
}

/**
 * Normalize an attribute value based on its name.
 */
function normalizeAttrValue(name: string, value: string): string {
  if (NUMERIC_ATTRS.has(name)) return normalizeNumber(value);
  if (name === 'd') return normalizePathD(value);
  if (name === 'points') return normalizePoints(value);
  if (name === 'transform') return normalizeTransform(value);
  return value;
}

export interface NormalizedNode {
  type: 'element' | 'text';
  tag?: string;
  attrs?: Record<string, string>; // sorted alphabetically by key
  text?: string;
  children?: NormalizedNode[];
}

/**
 * Recursively convert a DOM Node (xmldom) to a NormalizedNode tree.
 * Comment nodes and processing instruction nodes are skipped.
 * Text node whitespace is collapsed.
 */
function convertNode(node: XmlNode): NormalizedNode | null {
  const nodeType = node.nodeType;

  if (nodeType === COMMENT_NODE || nodeType === PROCESSING_INSTRUCTION_NODE) {
    return null;
  }

  if (nodeType === TEXT_NODE) {
    const raw = node.nodeValue ?? '';
    const normalized = raw.replace(/\s+/g, ' ').trim();
    if (normalized === '') return null; // skip whitespace-only text nodes
    return { type: 'text', text: normalized };
  }

  if (nodeType === ELEMENT_NODE) {
    // xmldom Element extends Node; cast to access Element-specific properties.
    const el = node as unknown as Element;
    const tag = el.tagName;

    // Build sorted attribute map
    const attrs: Record<string, string> = {};
    const rawAttrs = el.attributes;
    const attrNames: string[] = [];
    for (let i = 0; i < rawAttrs.length; i++) {
      const attr = rawAttrs.item(i);
      if (attr !== null) {
        attrNames.push(attr.name);
      }
    }
    attrNames.sort();
    for (const name of attrNames) {
      const rawValue = el.getAttribute(name) ?? '';
      attrs[name] = normalizeAttrValue(name, rawValue);
    }

    // Recurse into children
    const children: NormalizedNode[] = [];
    const childNodes = el.childNodes;
    for (let i = 0; i < childNodes.length; i++) {
      const child = childNodes.item(i);
      if (child !== null) {
        // xmldom NodeList.item() returns Node (the xmldom Node type)
        const converted = convertNode(child as unknown as XmlNode);
        if (converted !== null) {
          children.push(converted);
        }
      }
    }

    return { type: 'element', tag, attrs, children };
  }

  // Skip any other node type (DOCTYPE, CDATA, etc.)
  return null;
}

/**
 * Parse an SVG string and return a normalized tree rooted at the `<svg>` element.
 *
 * - Strips `<?xml ...?>` processing instructions
 * - Removes XML comment nodes
 * - Sorts attributes alphabetically
 * - Collapses whitespace in text nodes
 * - Normalizes numeric attribute values to 6 significant figures
 */
export function normalizeSvg(svgString: string): NormalizedNode {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');

  // Find the root element (SVG), skipping processing instructions and comments
  const childNodes = doc.childNodes;
  for (let i = 0; i < childNodes.length; i++) {
    const child = childNodes.item(i);
    if (child !== null && child.nodeType === ELEMENT_NODE) {
      const result = convertNode(child);
      if (result !== null) return result;
    }
  }

  throw new Error('normalizeSvg: no root element found in SVG string');
}
