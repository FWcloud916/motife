import { defineConfig } from "vitest/config";

// Component-library unit tests target pure logic (motion/timing.ts,
// token completeness) — no DOM, no Remotion render pipeline — so plain
// Node is enough. Explicit `include` keeps vitest from also picking up
// scripts/ or any future e2e-style files.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      // Scoped to src/ so scripts/ and config files don't dilute the
      // numbers. Note the React component layer (components/**,
      // compiler/render/*.tsx) is intentionally verified by `pnpm smoke`'s
      // real renders + manifest.test.ts's frame pins, which coverage can't
      // instrument — its low unit numbers here are expected, not a gap.
      include: ["src/**"],
    },
  },
});
