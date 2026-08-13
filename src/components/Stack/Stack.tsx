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
  // min-{height,width}: 0 on the MAIN axis is a deliberate flex-shrink
  // enabler, not a blanket reset — it exists so a `grow` Stack correctly
  // shrinks to (and gives its own children a definite height from) the
  // share of space its flex parent actually allocates it, which is what
  // Camera's `height: 100%` and Card's `align="stretch"` siblings depend
  // on. Applying it unconditionally to a NON-grow, content-sized Stack is
  // actively wrong: the browser's default `min-height: auto` on a flex
  // item is what makes it refuse to shrink below its own content size —
  // exactly the protection a content-sized Stack needs. Without it, a
  // content-sized Stack sitting next to an oversized sibling (e.g. a tall
  // multi-rank Diagram) in an overflowing flex column gets silently
  // squeezed toward zero height by the flex algorithm while its text still
  // paints at full size past that collapsed box — visually indistinguishable
  // from the text overlapping its neighbour. Found via a real repro: an
  // intro scene's hero/subtitle header Stack (no `grow`) measured 1.65px
  // tall next to a 703px-tall diagram, though every pixel of text was still
  // painted on screen. The cross axis keeps min:0 unconditionally — that's
  // the standard fix for long unbreakable content overflowing sideways, and
  // carries no such risk of erasing a sibling's box.
  const mainAxisMinKey = direction === "row" ? "minWidth" : "minHeight";
  const crossAxisMinKey = direction === "row" ? "minHeight" : "minWidth";
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
        [mainAxisMinKey]: grow ? 0 : undefined,
        [crossAxisMinKey]: 0,
      }}
    >
      {children}
    </div>
  );
};
