import { config } from "@remotion/eslint-config-flat";

export default [
  ...config,
  {
    // @remotion/eslint-config-flat targets Remotion source (browser
    // globals only) — the Node-side smoke-test script needs its own
    // globals declared, not disabled Remotion rules.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
      },
    },
  },
];
