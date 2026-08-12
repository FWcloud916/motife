// Not a design system yet — a collection point. Every time you reach for a
// hardcoded hex or px value while animating a scene, put it here instead.
// At Phase 0 exit, this file is the raw material for Phase 1's design-token
// deliverable (motife-plan.md §3 Phase 1: "設計 token 系統:色彩、字型、
// 間距、easing 全部集中定義"), and it feeds the "design tokens observed"
// section of docs/primitive-inventory.md directly.

export const theme = {
  color: {
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
  },
  radius: {
    sm: 14,
    md: 24,
    lg: 36,
    pill: 999,
  },
} as const;
