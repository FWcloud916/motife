// Numeric CLI option parsing. Bare `Number()` turns "abc" into NaN, which
// `??` does NOT replace — it then flows into loop bounds and path segments
// (`iter-NaN`). Every numeric option goes through here instead; commands
// catch OptionError and exit 2 with their usage text.

export class OptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OptionError";
  }
}

interface IntegerOptionSpec {
  min?: number;
  max?: number;
  fallback?: number;
}

export function integerOption(
  name: string,
  raw: string | undefined,
  spec: IntegerOptionSpec & { fallback: number },
): number;
export function integerOption(
  name: string,
  raw: string | undefined,
  spec?: IntegerOptionSpec,
): number | undefined;
export function integerOption(
  name: string,
  raw: string | undefined,
  spec: IntegerOptionSpec = {},
): number | undefined {
  if (raw === undefined) return spec.fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || rangeViolated(value, spec)) {
    throw new OptionError(`${name} must be ${describeRange("an integer", spec)} (got "${raw}")`);
  }
  return value;
}

interface NumberOptionSpec {
  min?: number;
  fallback?: number;
}

export function numberOption(
  name: string,
  raw: string | undefined,
  spec: NumberOptionSpec = {},
): number | undefined {
  if (raw === undefined) return spec.fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || rangeViolated(value, spec)) {
    throw new OptionError(`${name} must be ${describeRange("a number", spec)} (got "${raw}")`);
  }
  return value;
}

function rangeViolated(value: number, spec: { min?: number; max?: number }): boolean {
  return (
    (spec.min !== undefined && value < spec.min) || (spec.max !== undefined && value > spec.max)
  );
}

function describeRange(noun: string, spec: { min?: number; max?: number }): string {
  if (spec.min !== undefined && spec.max !== undefined) {
    return `${noun} between ${spec.min} and ${spec.max}`;
  }
  if (spec.min !== undefined) return `${noun} >= ${spec.min}`;
  if (spec.max !== undefined) return `${noun} <= ${spec.max}`;
  return noun;
}
