// Shared composition defaults — extracted from the now-deleted
// jwt-auth/storyboard.ts (Stage 7 cutover) so ComponentGallery and any
// future non-DSL composition still have a single source for these without
// depending on a specific video's own file. DSL documents carry their own
// fps/width/height (src/dsl/schema.ts's dslDocumentSchema defaults), so this
// file is for the hand-written TSX side of the codebase only.
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
