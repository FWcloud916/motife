import type { FC } from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type { TimelineEntry } from "./timeline";

export interface SceneComponentProps {
  durationInFrames: number;
}

export interface SceneSeriesProps<Id extends string> {
  timeline: readonly TimelineEntry<Id>[];
  /** Id → component. A Record (not a lookup function) so a timeline entry
   * without a component is a compile error, not a blank screen. */
  components: Record<Id, FC<SceneComponentProps>>;
}

/**
 * Renders a timeline as a TransitionSeries, inserting a transition wherever
 * an entry asks for one. Shared by every composition so the transition
 * wiring exists once — which also means ComponentGallery's fade exercises
 * the exact code path the eval-set videos would use if they ever enable one.
 *
 * Children are emitted as a FLAT array, not fragments: TransitionSeries
 * inspects its direct children to pair sequences with transitions, so a
 * fragment wrapper around a (sequence, transition) pair would hide the
 * transition from it.
 *
 * Each scene receives its own `durationInFrames` — that's what lets every
 * Window-based component inside resolve fractional timing against the
 * scene it actually lives in (see components/Scene/SceneContext.ts).
 */
export function SceneSeries<Id extends string>({
  timeline,
  components,
}: SceneSeriesProps<Id>): React.ReactNode {
  const children: React.ReactNode[] = [];

  for (const entry of timeline) {
    // Annotated rather than inferred: an indexed access on a generic
    // Record resolves to a type parameter TS won't accept as a JSX tag.
    const SceneComponent: FC<SceneComponentProps> = components[entry.id];
    children.push(
      <TransitionSeries.Sequence
        key={entry.id}
        name={entry.id}
        durationInFrames={entry.durationInFrames}
      >
        <SceneComponent durationInFrames={entry.durationInFrames} />
      </TransitionSeries.Sequence>,
    );

    if (entry.transitionToNext === "fade") {
      children.push(
        <TransitionSeries.Transition
          key={`${entry.id}-fade`}
          presentation={fade()}
          timing={linearTiming({ durationInFrames: entry.overlapWithNext })}
        />,
      );
    }
  }

  return <TransitionSeries>{children}</TransitionSeries>;
}
