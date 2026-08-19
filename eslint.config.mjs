import { config } from "@remotion/eslint-config-flat";

export default [
  {
    // Global ignores. A config object with ONLY `ignores` applies to the
    // whole run, unlike the per-block `files` filters below.
    //
    // `.claude/` is agent tooling, and `.claude/worktrees/` holds nested git
    // worktree checkouts — full copies of this repo. Without this, `eslint .`
    // walks into them and lints another branch's `src/` and `scripts/` as if
    // they were ours. That is not merely wasted work (251 worktree files vs
    // 123 real ones when this was added): the `files: ["scripts/**/*.mjs"]`
    // override below is anchored at the project root, so it does NOT match
    // `.claude/worktrees/*/scripts/*.mjs` — the Node globals never apply
    // there and every `process`/`console` reference reports `no-undef`. The
    // effect is that `pnpm verify` fails for anyone who has a worktree open,
    // with errors pointing at files they never touched.
    //
    // `out/` and `coverage/` are gitignored build/report output. ESLint's
    // flat config already ignores `node_modules/` and `.git/` by default,
    // and it does not read `.gitignore` (nor `.git/info/exclude`, which is
    // where `.claude/worktrees/` had been excluded from git alone).
    ignores: [".claude/**", "out/**", "coverage/**"],
  },
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
        Buffer: "readonly",
      },
    },
  },
  {
    // Phase 3's agent pipeline runs under Node (via tsx), not the browser —
    // same reasoning as the scripts/ override above, but for the TS
    // pipeline packages. Kept to globals only; every Remotion rule still
    // applies (harmlessly) to this non-Remotion code.
    files: ["src/agent/**/*.ts", "src/tts/**/*.ts", "src/critique/**/*.ts"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        fetch: "readonly",
        URL: "readonly",
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
