// The design-token system (motife-plan.md §3 Phase 1: "設計 token 系統:
// 色彩、字型、間距、easing 全部集中定義"). Carries the Phase 0 values in
// src/remotion/theme.ts forward verbatim — they're the proven quality bar —
// and adds what Phase 0 left implicit: a semantic Tone→color mapping,
// fontFamily, and easing curves.
//
// Components in src/components/ read only from `tokens`. They never accept
// a raw `style`/`className`/color-hex prop — the DSL that Phase 2 compiles
// to must be able to express every visual choice as one of these tokens.
import { easing } from "./easing";

export const TONE_NAMES = [
  "neutral",
  "primary",
  "info",
  "success",
  "warning",
  "danger",
  "syntaxA",
  "syntaxB",
  "syntaxC",
] as const;

export type Tone = (typeof TONE_NAMES)[number];

export type Emphasis = "low" | "medium" | "high";

export type Size = "sm" | "md" | "lg";

/**
 * Semantic width for a "box-like" component (Stack, Callout card, Diagram,
 * CodeBlock, Terminal) sitting beside a sibling — never a raw pixel or
 * percentage in a DSL field (motife-plan.md §2 決策2). Approximates the
 * hand-picked pixel widths Phase 1 scenes used (e.g. Walkthrough's 430px
 * checklist column ≈ "narrow" of a ~1660px content row) without the DSL
 * ever stating a pixel.
 */
export type Measure = "narrow" | "half" | "wide" | "full";

/** A layout gap, spacing-token driven — the only unit a Stack's `gap`
 * accepts. */
export type Gap = "none" | "sm" | "md" | "lg" | "xl";

/**
 * A time span expressed as a fraction (0..1) of the enclosing Scene's
 * duration. Every component resolves its own animation timing against a
 * Window instead of a hardcoded frame number, so when Phase 3 derives a
 * scene's duration from measured TTS audio, everything inside re-times
 * itself automatically — nothing above `motion/timing.ts` touches frames.
 */
export interface Window {
  from: number;
  to: number;
}

interface ToneRecipe {
  /** Foreground: text, icon strokes, glow color. */
  fg: string;
  /** Background fill — a translucent wash of `fg`. */
  bg: string;
  /** Border/outline — a stronger translucent wash of `fg`. */
  border: string;
}

const palette = {
  bg: "#07111f",
  surface: "#0d1b2d",
  surfaceRaised: "#13243a",
  line: "#29405d",
  text: "#f7fbff",
  textMuted: "#8fa6bf",
  accent: "#6c7cff",
  cyan: "#37d9f2",
  mint: "#42e2a8",
  warning: "#ffca68",
  danger: "#ff6b7a",
  header: "#ff6f91",
  payload: "#a887ff",
  signature: "#54d5ff",
} as const;

function recipe(fg: string): ToneRecipe {
  return { fg, bg: `${fg}15`, border: `${fg}55` };
}

const tone: Record<Tone, ToneRecipe> = {
  neutral: recipe(palette.textMuted),
  primary: recipe(palette.accent),
  info: recipe(palette.cyan),
  success: recipe(palette.mint),
  warning: recipe(palette.warning),
  danger: recipe(palette.danger),
  syntaxA: recipe(palette.header),
  syntaxB: recipe(palette.payload),
  syntaxC: recipe(palette.signature),
};

/** Percentage widths behind each `Measure` token. Approximate by design —
 * see the `Measure` doc comment. */
export const MEASURE_WIDTH: Record<Measure, string> = {
  narrow: "40%",
  half: "55%",
  wide: "78%",
  full: "100%",
};

export const tokens = {
  color: { ...palette, tone },
  fontFamily: {
    sans: '"Inter", "Noto Sans TC", sans-serif',
    mono: '"JetBrains Mono", monospace',
  },
  fontSize: {
    xs: 20,
    sm: 26,
    md: 42,
    lg: 72,
    xl: 104,
  },
  spacing: {
    sm: 16,
    md: 32,
    lg: 64,
    xl: 96,
  },
  duration: {
    fast: 15, // frames
    normal: 30,
    slow: 45,
    reveal: 22, // the de-facto Phase 0 enter() constant
  },
  radius: {
    sm: 14,
    md: 24,
    lg: 36,
    pill: 999,
  },
  easing,
} as const;

export { easing } from "./easing";
export type { EasingToken } from "./easing";
export { fontsReady, loadFonts } from "./fonts";
