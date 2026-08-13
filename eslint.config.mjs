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
  {
    // Compositions (and Root) reach the component library ONLY through its
    // barrel, src/components/index.ts — a component's internal file layout
    // is not API. src/compiler/** is included too: its render/ subtree
    // (Stage 3) is the DSL interpreter and imports the same library the
    // hand-written compositions do, through the same barrel. Scoped away
    // from src/components/** itself, which must stay free to deep-import
    // its own internals.
    //
    // The pattern is gitignore-style (ESLint feeds `patterns.group` to the
    // `ignore` package, not minimatch), so the trailing `/**` requires a
    // path segment after `components`: "../../../components" passes at any
    // depth, "../components/tokens" and "../../../../components/Scene/Scene"
    // are rejected.
    files: ["src/remotion/**/*.{ts,tsx}", "src/compiler/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/components/**"],
              message:
                "Import from the components barrel (e.g. \"../../../components\") — a component's internal module path is not public API.",
            },
          ],
        },
      ],
    },
  },
];
