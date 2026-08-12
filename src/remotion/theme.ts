// Not a design system yet — a collection point. Every time you reach for a
// hardcoded hex or px value while animating a scene, put it here instead.
// At Phase 0 exit, this file is the raw material for Phase 1's design-token
// deliverable (motife-plan.md §3 Phase 1: "設計 token 系統:色彩、字型、
// 間距、easing 全部集中定義"), and it feeds the "design tokens observed"
// section of docs/primitive-inventory.md directly.

export const theme = {
  color: {
    bg: "#0b0f19",
    text: "#f5f7fa",
    textMuted: "#9aa4b2",
    accent: "#5b8def",
  },
  fontSize: {
    sm: 28,
    md: 44,
    lg: 72,
  },
  spacing: {
    sm: 16,
    md: 32,
    lg: 64,
  },
  duration: {
    fast: 15, // frames
    normal: 30,
    slow: 45,
  },
} as const;
