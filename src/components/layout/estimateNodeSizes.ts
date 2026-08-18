// Pure, DOM-free mirror of measureNodes.ts — for environments with no
// browser to measure real text in (src/compiler/validate.ts's validator).
// The real measurement stays authoritative for render; this is a
// deliberately conservative-HIGH estimate: erring toward "this label looks
// too long" is a false alarm the LLM ignores, erring toward "this fits" is
// a card that renders clipped with the validator having said nothing.
import { nodeSizeFor, MAX_NODE_WIDTH, NODE_TEXT_PAD_X } from "./nodeSizing";
import type { NodeSize } from "./nodeSizing";
import type { GraphSpec } from "./types";

// Mirrors DiagramNode.tsx's actual label/detail font sizes (tokens.fontSize
// .sm / .xs) — literals for the same reason nodeSizing.ts's NODE_TEXT_PAD_X
// is: this module must stay importable from the compiler without dragging
// in the token barrel.
export const LABEL_FONT_SIZE = 26; // tokens.fontSize.sm, rendered at weight 750
export const DETAIL_FONT_SIZE = 20; // tokens.fontSize.xs

// The content width past which a node stops widening and starts wrapping
// its text instead (nodeSizeFor's MAX_NODE_WIDTH cap, minus the padding it
// adds back on both sides).
export const MAX_NODE_CONTENT_WIDTH = MAX_NODE_WIDTH - 2 * NODE_TEXT_PAD_X; // 496

// A CJK/fullwidth glyph renders as a full em regardless of typeface; every
// other character (Latin, digits, punctuation) is estimated at a
// deliberately generous fraction of an em for Inter — real advance widths
// run narrower, but this must only ever overestimate. Ranges below are by
// Unicode code point (escaped, not pasted as literal glyphs, so the file
// survives copy/paste and encoding round-trips intact): Hangul Jamo, CJK
// radicals/symbols/punctuation, Hiragana+Katakana, CJK Unified Ideographs
// (+ Extension A), Hangul Syllables, CJK Compatibility Ideographs,
// Halfwidth/Fullwidth Forms, and the supplementary-plane CJK Ideograph
// Extensions (B and beyond).
const FULLWIDTH_CHAR = new RegExp(
  "[" +
    "\\u1100-\\u11FF" + // Hangul Jamo
    "\\u2E80-\\u2EFF" + // CJK Radicals Supplement
    "\\u2F00-\\u2FDF" + // Kangxi Radicals
    "\\u3000-\\u303F" + // CJK Symbols and Punctuation
    "\\u3040-\\u30FF" + // Hiragana + Katakana
    "\\u31C0-\\u31EF" + // CJK Strokes
    "\\u3400-\\u4DBF" + // CJK Unified Ideographs Extension A
    "\\u4E00-\\u9FFF" + // CJK Unified Ideographs
    "\\uAC00-\\uD7A3" + // Hangul Syllables
    "\\uF900-\\uFAFF" + // CJK Compatibility Ideographs
    "\\uFF00-\\uFFEF" + // Halfwidth and Fullwidth Forms
    "\\u{20000}-\\u{3FFFD}" + // CJK Ideograph Extensions B+ (astral plane)
    "]",
  "u",
);
const FULLWIDTH_EM = 1.0;
const HALFWIDTH_EM = 0.62;

/** Estimated pixel width of `text` set at `fontSize` — see the module
 * comment for why this over-, never under-, estimates. Iterates code
 * points (not UTF-16 code units) so astral-plane CJK Extension ideographs
 * classify correctly instead of being split into two half-width halves. */
export function estimateTextWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of text) {
    em += FULLWIDTH_CHAR.test(ch) ? FULLWIDTH_EM : HALFWIDTH_EM;
  }
  return em * fontSize;
}

/** Estimated node footprints for a whole graph — the validator's drop-in
 * replacement for measureGraphNodeSizes() when there's no DOM to measure
 * in. Same shape, same max(label, detail) rule, same nodeSizeFor() clamp. */
export function estimateGraphNodeSizes(graph: GraphSpec): Record<string, NodeSize> {
  const sizes: Record<string, NodeSize> = {};
  for (const node of graph.nodes) {
    const label = estimateTextWidth(node.label, LABEL_FONT_SIZE);
    const detail = node.detail ? estimateTextWidth(node.detail, DETAIL_FONT_SIZE) : 0;
    sizes[node.id] = nodeSizeFor(Math.max(label, detail), node.size ?? "md");
  }
  return sizes;
}
