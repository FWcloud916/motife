import type { CSSProperties, FC } from "react";
import { useRevealStyle } from "../motion/useRevealStyle";
import type { Tone, Window } from "../tokens";
import { tokens } from "../tokens";

export type TextRole = "hero" | "title" | "subtitle" | "label" | "body" | "detail";

/** A single run of text, optionally tone-tagged or bolded — the semantic
 * counterpart of Phase 1's inline `<strong>` runs (e.g. Summary's
 * "Sign · Verify · Authorize"). Reuses CodeSegment's proven shape. */
export type TextRun = string | { text: string; tone?: Tone; strong?: boolean };

export interface TextProps {
  role?: TextRole;
  content: string | TextRun[];
  tone?: Tone;
  align?: "start" | "center" | "end";
  window?: Window;
}

interface RoleStyle {
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  uppercase?: boolean;
  /** Falls back to textMuted instead of text when no explicit `tone` is
   * given — matches the Phase 1 scenes' eyebrow/label/detail text, which
   * was always muted unless a tone made it a specific accent color. */
  mutedByDefault?: boolean;
}

// The one place font size/weight/letter-spacing live for scene text — every
// hand-styled `<div>` text block Phase 1 wrote maps onto exactly one of
// these roles. `hero`/`title` carry Scene's own header sizing verbatim (see
// Scene.tsx's SceneHeaderBlock and Intro.tsx's title), so swapping a
// hand-styled block for `<Text role="hero">` is a byte-identical
// replacement, not an approximation.
const ROLE_STYLE: Record<TextRole, RoleStyle> = {
  hero: { fontSize: tokens.fontSize.xl, fontWeight: 820, letterSpacing: -5 },
  title: { fontSize: tokens.fontSize.lg, fontWeight: 750, letterSpacing: -2.5 },
  subtitle: { fontSize: 28, fontWeight: 600, letterSpacing: 1, mutedByDefault: true },
  label: {
    fontSize: tokens.fontSize.xs,
    fontWeight: 800,
    letterSpacing: 3,
    uppercase: true,
    mutedByDefault: true,
  },
  body: { fontSize: tokens.fontSize.md, fontWeight: 700, letterSpacing: 0 },
  detail: { fontSize: tokens.fontSize.sm, fontWeight: 400, letterSpacing: 0, mutedByDefault: true },
};

const ALIGN_TEXT: Record<NonNullable<TextProps["align"]>, CSSProperties["textAlign"]> = {
  start: "left",
  center: "center",
  end: "right",
};

export const Text: FC<TextProps> = ({ role = "body", content, tone, align, window }) => {
  const revealStyle = useRevealStyle(window);
  const roleStyle = ROLE_STYLE[role];
  const color = tone ? tokens.color.tone[tone].fg : roleStyle.mutedByDefault ? tokens.color.textMuted : tokens.color.text;

  return (
    <div
      style={{
        ...revealStyle,
        color,
        fontFamily: tokens.fontFamily.sans,
        fontSize: roleStyle.fontSize,
        fontWeight: roleStyle.fontWeight,
        letterSpacing: roleStyle.letterSpacing,
        textTransform: roleStyle.uppercase ? "uppercase" : undefined,
        textAlign: align ? ALIGN_TEXT[align] : undefined,
        lineHeight: role === "subtitle" || role === "detail" ? 1.55 : 1.2,
      }}
    >
      {typeof content === "string"
        ? content
        : content.map((run, index) =>
            typeof run === "string" ? (
              <span key={index}>{run}</span>
            ) : (
              <span
                key={index}
                style={{
                  // An explicit tone always wins. Otherwise a `strong` run
                  // brightens to the un-muted text color — e.g. Summary's
                  // "Sign · Verify · Authorize" standing out of its
                  // otherwise-muted `role="detail"` sentence — and a plain
                  // run just inherits its parent Text's color.
                  color: run.tone
                    ? tokens.color.tone[run.tone].fg
                    : run.strong
                      ? tokens.color.text
                      : undefined,
                  fontWeight: run.strong ? 800 : undefined,
                }}
              >
                {run.text}
              </span>
            ),
          )}
    </div>
  );
};
