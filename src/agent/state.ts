import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { atomicWriteJson } from "../io/atomicJson";
import { critiqueIssueSchema, critiqueReportSchema } from "../critique/critique";

export { atomicWriteJson } from "../io/atomicJson";

export const STATE_SCHEMA_VERSION = 1;
export const PIPELINE_CONTRACT_VERSION = 1;

export const runStatusSchema = z.enum(["pending", "running", "paused", "completed", "failed"]);
export type RunStatus = z.infer<typeof runStatusSchema>;
export const pipelineStageSchema = z.enum([
  "generate",
  "tts",
  "render",
  "stills",
  "critique",
  "revise",
  "finalize",
]);
export type PipelineStage = z.infer<typeof pipelineStageSchema>;

export const pipelineConfigSchema = z
  .object({
    provider: z.string().min(1),
    model: z.string().min(1),
    critiqueProvider: z.string().min(1),
    critiqueModel: z.string().min(1),
    language: z.string().min(1),
    maxRevisions: z.number().int().min(0),
    tts: z
      .object({
        name: z.string().min(1),
        voice: z.string().min(1),
        model: z.string().min(1),
        instructions: z.string().optional(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type PipelineConfig = z.infer<typeof pipelineConfigSchema>;

const dslIssueStateSchema = z
  .object({
    path: z.string(),
    code: z.string(),
    severity: z.enum(["error", "warning"]),
    message: z.string(),
    fix: z.string(),
  })
  .strict();

const iterationSummaryStateSchema = z
  .object({
    iteration: z.number().int().positive(),
    errors: z.number().int().min(0),
    warnings: z.number().int().min(0),
    issues: z.array(critiqueIssueSchema),
    docWarnings: z.array(dslIssueStateSchema),
  })
  .strict();

export const persistedPipelineResultSchema = z
  .object({
    status: z.enum(["completed", "paused", "failed"]),
    ok: z.boolean(),
    finalMp4: z.string().nullable(),
    generateAttempts: z.number().int().min(0),
    iterations: z.array(iterationSummaryStateSchema),
    clean: z.boolean(),
    outcome: z.enum(["clean", "exhausted", "revision-failed", "aborted", "generation-failed", "paused"]),
    shippedIteration: z.number().int().positive().nullable(),
    failureText: z.string().optional(),
  })
  .strict();

const iterationStateSchema = z
  .object({
    iteration: z.number().int().positive(),
    docJson: z.string(),
    docHash: z.string(),
    ttsInputHash: z.string().optional(),
    renderInputHash: z.string().optional(),
    stillsInputHash: z.string().optional(),
    critiqueInputHash: z.string().optional(),
    critiqueReport: critiqueReportSchema.optional(),
    summary: iterationSummaryStateSchema.optional(),
    revisedDocJson: z.string().optional(),
  })
  .strict();
export type PersistedIteration = z.infer<typeof iterationStateSchema>;

export const runStateSchema = z
  .object({
    kind: z.literal("motife-run-state"),
    schemaVersion: z.literal(STATE_SCHEMA_VERSION),
    contractVersion: z.literal(PIPELINE_CONTRACT_VERSION),
    status: runStatusSchema,
    prompt: z.string().min(1),
    config: pipelineConfigSchema,
    stage: pipelineStageSchema,
    iteration: z.number().int().positive(),
    generateAttempts: z.number().int().min(0),
    llmAttempts: z.array(
      z
        .object({
          kind: z.enum(["generate", "revise"]),
          iteration: z.number().int().positive().nullable(),
          attempt: z.number().int().positive(),
          raw: z.string(),
          issuesText: z.string().nullable(),
        })
        .strict(),
    ),
    acceptedDocJson: z.string().optional(),
    iterations: z.array(iterationStateSchema),
    bestIteration: z.number().int().positive().nullable(),
    result: persistedPipelineResultSchema.optional(),
    lastError: z.string().nullable(),
    elapsedMs: z.number().int().min(0),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type RunState = z.infer<typeof runStateSchema>;

const evalConceptStateSchema = z
  .object({
    slug: z.string().min(1),
    title: z.string().min(1),
    prompt: z.string().min(1),
    status: runStatusSchema,
    stage: pipelineStageSchema,
    result: persistedPipelineResultSchema.optional(),
    elapsedMs: z.number().int().min(0),
    lastError: z.string().nullable(),
  })
  .strict();
export type EvalConceptState = z.infer<typeof evalConceptStateSchema>;

export const evalStateSchema = z
  .object({
    kind: z.literal("motife-eval-state"),
    schemaVersion: z.literal(STATE_SCHEMA_VERSION),
    contractVersion: z.literal(PIPELINE_CONTRACT_VERSION),
    status: runStatusSchema,
    set: z.enum(["baseline", "stress", "all"]),
    label: z.string().nullable(),
    date: z.string(),
    config: pipelineConfigSchema,
    concepts: z.array(evalConceptStateSchema),
    elapsedMs: z.number().int().min(0),
    lastError: z.string().nullable(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type EvalState = z.infer<typeof evalStateSchema>;

export function hashValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function readState<T>(filePath: string, schema: z.ZodType<T>, label: string): Promise<T> {
  let input: unknown;
  try {
    input = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${label} is missing or corrupt (${filePath}): ${(error as Error).message}`);
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`${label} is incompatible or corrupt (${filePath}): ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export function runStatePath(runRoot: string): string {
  return path.join(runRoot, "run-state.json");
}

export function evalStatePath(evalRoot: string): string {
  return path.join(evalRoot, "eval-state.json");
}

export function readRunState(runRoot: string): Promise<RunState> {
  return readState(runStatePath(runRoot), runStateSchema, "run state").then(recoverStaleRunState);
}

export function readEvalState(evalRoot: string): Promise<EvalState> {
  return readState(evalStatePath(evalRoot), evalStateSchema, "eval state").then(recoverStaleEvalState);
}

/** A process killed between two atomic checkpoints cannot run its SIGINT
 * handler. Treat a state left `running` on the next invocation as an
 * interrupted checkpoint, never as work that should be silently skipped. */
function recoverStaleRunState(state: RunState): RunState {
  if (state.status !== "running") return state;
  return {
    ...state,
    status: "paused",
    lastError: state.lastError ?? `Previous process interrupted during ${state.stage}; resuming from this checkpoint.`,
  };
}

function recoverStaleEvalState(state: EvalState): EvalState {
  const concepts = state.concepts.map((concept) =>
    concept.status === "running"
      ? {
          ...concept,
          status: "paused" as const,
          lastError: concept.lastError ?? `Previous process interrupted during ${concept.stage}; resuming from this checkpoint.`,
        }
      : concept,
  );
  if (state.status !== "running" && concepts.every((concept) => concept.status === state.concepts.find((saved) => saved.slug === concept.slug)?.status)) {
    return state;
  }
  return {
    ...state,
    status: state.status === "running" ? "paused" : state.status,
    concepts,
    lastError: state.lastError ?? "Previous process was interrupted; paused concepts are resumable.",
  };
}

export async function writeRunState(runRoot: string, state: RunState): Promise<void> {
  await atomicWriteJson(runStatePath(runRoot), { ...state, updatedAt: new Date().toISOString() });
}

export async function writeEvalState(evalRoot: string, state: EvalState): Promise<void> {
  await atomicWriteJson(evalStatePath(evalRoot), { ...state, updatedAt: new Date().toISOString() });
}

export async function assertDirectoryEmpty(directory: string): Promise<void> {
  try {
    const info = await stat(directory);
    if (!info.isDirectory()) throw new Error(`${directory} exists and is not a directory.`);
    const { readdir } = await import("node:fs/promises");
    if ((await readdir(directory)).length > 0) {
      throw new Error(`${directory} is not empty; use --resume ${directory} or choose a new label/run.`);
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }
}

export function assertConfigMatches(
  saved: PipelineConfig,
  requested: Partial<PipelineConfig>,
): void {
  for (const key of ["provider", "model", "critiqueProvider", "critiqueModel", "language", "maxRevisions"] as const) {
    const value = requested[key];
    if (value !== undefined && value !== saved[key]) {
      throw new Error(`resume configuration mismatch for ${key}: state=${JSON.stringify(saved[key])}, requested=${JSON.stringify(value)}; create a new run instead.`);
    }
  }
  if (requested.tts !== undefined && hashValue(requested.tts) !== hashValue(saved.tts)) {
    throw new Error("resume configuration mismatch for TTS; create a new run instead.");
  }
}
