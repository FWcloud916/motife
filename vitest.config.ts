import { defineConfig } from "vitest/config";

// Component-library unit tests target pure logic (motion/timing.ts,
// token completeness) — no DOM, no Remotion render pipeline — so plain
// Node is enough. Explicit `include` keeps vitest from also picking up
// scripts/ or any future e2e-style files.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
