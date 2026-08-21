// Phase 3 agent-pipeline CLI (`pnpm motife <subcommand>`), run under Node
// via tsx — the one entry point src/'s TypeScript exposes to the shell.
// Every pipeline stage is its own subcommand so the API-driven
// orchestrator (`motife run`) and skill mode (a coding agent driving the
// stages by hand) produce identical run-directory artifacts — the run
// directory, not this process, is the contract between stages (see
// docs/agent-pipeline.md).
//
// Subcommands load lazily: `motife validate` must work on a machine with
// no API keys and must not pay for (or crash on) the AI SDK import.

type CommandRun = (argv: string[]) => Promise<number>;

interface CommandSpec {
  summary: string;
  load: () => Promise<{ run: CommandRun }>;
}

const COMMANDS: Record<string, CommandSpec> = {
  validate: {
    summary: "Parse + validate a DSL document; prints formatIssues() output",
    load: () => import("./commands/validate"),
  },
  generate: {
    summary: "Prompt → validated DSL document via an LLM (retry on validation errors)",
    load: () => import("./commands/generate"),
  },
  tts: {
    summary: "Synthesize per-scene narration audio and backfill scene durations",
    load: () => import("./commands/tts"),
  },
  render: {
    summary: "Render a DSL document (plus optional run-dir audio) to MP4",
    load: () => import("./commands/render"),
  },
  stills: {
    summary: "Extract per-scene critique key frames as PNG stills",
    load: () => import("./commands/stills"),
  },
  critique: {
    summary: "Vision-model review of an iteration's stills → critique report",
    load: () => import("./commands/critique"),
  },
  revise: {
    summary: "Apply a critique report to the DSL via an LLM revision pass",
    load: () => import("./commands/revise"),
  },
  run: {
    summary: "Full pipeline: generate → tts → render → critique → revise (bounded)",
    load: () => import("./commands/run"),
  },
  eval: {
    summary: "Run a concept set (baseline/stress/all) end-to-end and write a scoring report",
    load: () => import("./commands/eval"),
  },
};

function usage(): string {
  const width = Math.max(...Object.keys(COMMANDS).map((name) => name.length));
  const lines = Object.entries(COMMANDS).map(
    ([name, spec]) => `  ${name.padEnd(width)}  ${spec.summary}`,
  );
  return [
    "usage: pnpm motife <subcommand> [options]",
    "",
    "subcommands:",
    ...lines,
    "",
    "Run `pnpm motife <subcommand> --help` for per-command options.",
  ].join("\n");
}

async function main(): Promise<number> {
  const [name, ...rest] = process.argv.slice(2);
  if (!name || name === "--help" || name === "-h") {
    console.log(usage());
    return name ? 0 : 2;
  }
  const spec = COMMANDS[name];
  if (!spec) {
    console.error(`motife: unknown subcommand "${name}"\n\n${usage()}`);
    return 2;
  }
  const { run } = await spec.load();
  return run(rest);
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    process.exitCode = 1;
  },
);
