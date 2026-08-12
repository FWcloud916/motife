// DEPRECATED — superseded by src/components/tokens/. Kept only so the
// Phase 0 scenes (src/remotion/compositions/jwt-auth/visuals.tsx and
// scenes/*) keep compiling unchanged while Phase 1 builds the component
// library alongside them. New code must import `tokens` from
// "../../components/tokens" (or the src/components barrel) instead. This
// file — and everything that still imports it — is deleted in PR 4 once
// JwtAuthFlowV2 replaces the Phase 0 scenes.
import { tokens } from "../components/tokens";

export const theme = {
  color: tokens.color,
  fontSize: tokens.fontSize,
  spacing: tokens.spacing,
  duration: tokens.duration,
  radius: tokens.radius,
} as const;
