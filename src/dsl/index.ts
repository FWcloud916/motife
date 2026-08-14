// Public surface of the DSL package. `src/compiler/**` and any test fixture
// authoring should import from here, not reach into `schema.ts`/`types.ts`
// directly — mirrors the discipline `src/components/index.ts` already
// enforces for the component library.
export {
  absoluteWindowRefSchema,
  beatSchema,
  dslDocumentSchema,
  dslNodeSchema,
  emphasisSchema,
  gapSchema,
  iconNameSchema,
  measureSchema,
  sceneSchema,
  sceneTransitionSchema,
  sizeSchema,
  stepItemSchema,
  stepRangeWindowRefSchema,
  stepWindowRefSchema,
  toneSchema,
  trackSchema,
  windowRefSchema,
} from "./schema";

export type {
  AbsoluteWindowRef,
  DslCard,
  DslDocument,
  DslNode,
  DslNodeOf,
  DslNodeType,
  DslScene,
  StepItem,
  StepRangeWindowRef,
  StepWindowRef,
  Track,
  WindowRef,
} from "./types";
