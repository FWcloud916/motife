// Public surface of the compiler package. Stage 3's render/ layer (and
// anything else outside src/compiler/**) should import from here, mirroring
// the discipline src/components/index.ts and src/dsl/index.ts already
// enforce for their own packages.
export type { DslIssue, DslIssueCode, DslIssueSeverity } from "./errors";
export { DslValidationError, formatIssues } from "./errors";

export type { ParseResult } from "./parse";
export { parseDocument, parseDocumentOrThrow } from "./parse";

export { validateDocument } from "./validate";

export {
  StepIndexOutOfRangeError,
  TrackCycleError,
  UnknownTrackError,
  resolveWindowRef,
  trackMapFrom,
} from "./windows";

export type { TimelineEntry } from "./timeline";
export { dslTimeline, dslTotalFrames } from "./timeline";
