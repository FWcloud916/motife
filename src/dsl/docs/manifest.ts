// The only module that imports the DSL document JSON files directly.
// Root.tsx parses each entry via parseDocumentOrThrow() at module scope —
// a malformed baseline fails the bundle loudly rather than rendering
// garbage — and manifest.test.ts pins their frame counts, the same
// discipline storyboard.test.ts used to give the (now-retired) hand-written
// JwtAuthFlow.
import jwtAuth from "./jwt-auth.json";

/** Raw, unvalidated — deliberately typed `unknown`, not `DslDocument`, so
 * nothing downstream can treat these as trusted without going through
 * parseDocument()/parseDocumentOrThrow() first. */
export const RAW_DOCS: readonly unknown[] = [jwtAuth];
