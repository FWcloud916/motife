import type { FC, ReactNode } from "react";
import { useRevealStyle } from "../motion/useRevealStyle";
import type { Gap, Measure, Window } from "../tokens";
import { MEASURE_WIDTH, tokens } from "../tokens";

// The only layout primitive the DSL can express (motife-plan.md §2 決策2:
// no CSS-like concepts in the schema) — replaces every hand-rolled
// `display: flex` row/column the Phase 1 scenes used. A Stack never states
// a pixel: `gap` is spacing-token driven, `width` is a Measure, and a
// child's own size along the main axis is either "size to content"
// (the CSS default) or `grow` (flex: 1 1 0) — see Callout/Diagram/CodeBlock/
// Terminal's `grow`/`width` props, which is where those live, not here.
// Stack itself is just `display: flex`; it never wraps or measures its
// children.
export interface StackProps {
  direction?: "row" | "column";
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between";
  gap?: Gap;
  /** Semantic width, for a Stack sitting beside a sibling inside a parent
   * Stack row. Omit for a Stack that should size to its own content. */
  width?: Measure;
  /** Take a proportional share of the remaining space in the enclosing
   * Stack's main axis (flex: 1 1 0), and — since a top-level Stack is
   * usually handed directly to a non-flex parent (a Scene's content slot)
   * rather than another Stack — also fill 100% of that parent's height.
   * The semantic replacement for the Phase 1 scenes' `height: "100%"` /
   * `flex: 1`. */
  grow?: boolean;
  window?: Window;
  children?: ReactNode;
}

const GAP_PX: Record<Gap, number> = {
  none: 0,
  sm: tokens.spacing.sm,
  md: tokens.spacing.md,
  lg: tokens.spacing.lg,
  xl: tokens.spacing.xl,
};

const JUSTIFY: Record<NonNullable<StackProps["justify"]>, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
};

const ALIGN: Record<NonNullable<StackProps["align"]>, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

export const Stack: FC<StackProps> = ({
  direction = "column",
  align,
  justify,
  gap = "md",
  width,
  grow,
  window,
  children,
}) => {
  const revealStyle = useRevealStyle(window);
  return (
    <div
      style={{
        ...revealStyle,
        display: "flex",
        flexDirection: direction,
        alignItems: align ? ALIGN[align] : undefined,
        justifyContent: justify ? JUSTIFY[justify] : undefined,
        gap: GAP_PX[gap],
        width: width ? MEASURE_WIDTH[width] : undefined,
        flex: grow ? "1 1 0" : undefined,
        height: grow ? "100%" : undefined,
        minHeight: 0,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
};
