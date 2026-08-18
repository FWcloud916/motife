// Pure box math — no React, no tokens import (same discipline nodeSizing.ts
// and computeLayout.ts already use: this module must stay importable from
// src/compiler/validate.ts via the barrel, and from node-env unit tests,
// without dragging in anything that isn't plain arithmetic). The constants
// below ARE Scene.tsx's clearances, moved here so both the renderer and the
// compiler's validator compute the same box from the same numbers instead
// of two copies drifting apart.

// Reserved space around the content area when a header/caption is present —
// mirrors the Phase 0 scenes' shared convention (header at y=72, content
// starting around y=250) without every scene re-deriving it.
export const HEADER_CLEARANCE = 210;
export const CAPTION_CLEARANCE = 150;
// tokens.spacing.xl — kept literal for the reason above. Applied on every
// edge when there's no header/caption to clear, and always on left/right.
export const CONTENT_EDGE_PAD = 96;

export interface SafeArea {
  width: number;
  height: number;
}

/**
 * The pixel box a Scene's `content` actually has to work with, after its
 * header/caption reserve their own space. `hasCaption` must match
 * `DslSceneView.tsx`'s caption presence rule exactly: a scene has a caption
 * unless it explicitly opts out (`caption: null`) — an omitted `caption`
 * falls back to the scene's narration, so it still reserves the clearance.
 */
export function computeSafeArea(opts: {
  width: number;
  height: number;
  hasHeader: boolean;
  hasCaption: boolean;
}): SafeArea {
  return {
    width: opts.width - 2 * CONTENT_EDGE_PAD,
    height:
      opts.height -
      (opts.hasHeader ? HEADER_CLEARANCE : CONTENT_EDGE_PAD) -
      (opts.hasCaption ? CAPTION_CLEARANCE : CONTENT_EDGE_PAD),
  };
}
