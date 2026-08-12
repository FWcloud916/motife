import { Config } from "@remotion/cli/config";

// Guards against a future `src/index.ts` silently shadowing the Remotion
// entry point (the CLI's entry-point search checks src/index.ts before
// src/remotion/index.ts).
Config.setEntryPoint("src/remotion/index.ts");

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// NOTE: this file only affects the Remotion CLI and Studio. It has NO
// effect on @remotion/renderer's SSR APIs (bundle()/renderMedia()/
// renderStill()) — those must set equivalent options directly as call
// arguments. In particular, scripts/smoke.mjs passes `rspack: true` to
// bundle() to match Config.setRspack(true) above; if these two drift,
// the CLI and the programmatic smoke test will use different bundlers.
