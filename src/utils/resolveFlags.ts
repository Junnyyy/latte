export const VALID_FLAGS = new Set(["d", "i", "m", "s", "u"])
export const DEFAULT_FLAGS = new Set(["i", "m", "s", "u"])

/**
 * Parse LATTE_FLAGS env var value into a set of valid flag characters (pure, no warning).
 * Leading dashes and whitespace are stripped. Invalid characters are silently ignored.
 */
const parseEnvFlagsSilent = (value: string): Set<string> => {
  const cleaned = value.replace(/[-\s]/g, "")
  const result = new Set<string>()
  for (const char of cleaned) {
    if (VALID_FLAGS.has(char)) result.add(char)
  }
  return result
}

/**
 * Parse LATTE_FLAGS env var value into a set of valid flag characters.
 * Leading dashes and whitespace are stripped. Invalid characters produce
 * a warning to stderr and are ignored.
 */
export const parseEnvFlags = (value: string): Set<string> => {
  const cleaned = value.replace(/[-\s]/g, "")
  const valid = new Set<string>()
  const invalid: string[] = []

  for (const char of cleaned) {
    if (VALID_FLAGS.has(char)) {
      valid.add(char)
    } else {
      invalid.push(char)
    }
  }

  if (invalid.length > 0) {
    process.stderr.write(
      `latte: ignoring invalid characters in LATTE_FLAGS: ${invalid.join(", ")}\n`,
    )
  }

  return valid
}

/**
 * Resolve the final caffeinate flag string from three layers:
 * 1. Built-in defaults (-imsu)
 * 2. LATTE_FLAGS env var (additive)
 * 3. CLI overrides (adds and removes)
 *
 * Returns a flag string like "-dimsu" or "" if all flags removed.
 */
export const resolveFlags = (cliAdds: Set<string>, cliRemoves: Set<string>): string => {
  const flags = new Set(DEFAULT_FLAGS)

  // Layer 2: env var (additive only)
  const envValue = process.env.LATTE_FLAGS
  if (envValue) {
    for (const f of parseEnvFlags(envValue)) {
      flags.add(f)
    }
  }

  // Layer 3: CLI adds
  for (const f of cliAdds) {
    flags.add(f)
  }

  // Layer 3: CLI removes (applied after adds, so removes win)
  for (const f of cliRemoves) {
    flags.delete(f)
  }

  const sorted = [...flags].sort()
  return sorted.length > 0 ? `-${sorted.join("")}` : ""
}

/**
 * Convert a flag set to a caffeinate flag string.
 * e.g., Set(["d", "i", "m", "s", "u"]) → "-dimsu"
 * Returns "" for an empty set.
 */
export const flagSetToString = (flags: Set<string>): string => {
  const sorted = [...flags].sort()
  return sorted.length > 0 ? `-${sorted.join("")}` : ""
}

/**
 * Compute the initial flag set from defaults + LATTE_FLAGS env var.
 * Used by the TUI to initialize session flag state.
 */
export const initialFlagSet = (): Set<string> => {
  const flags = new Set(DEFAULT_FLAGS)
  const envValue = process.env.LATTE_FLAGS
  if (envValue) {
    for (const f of parseEnvFlagsSilent(envValue)) {
      flags.add(f)
    }
  }
  return flags
}

const ADD_MAP: Record<string, string> = {
  "--display": "d", "-d": "d",
  "--idle": "i", "-i": "i",
  "--disk": "m", "-m": "m",
  "--system": "s", "-s": "s",
  "--wake": "u", "-u": "u",
}

const REMOVE_MAP: Record<string, string> = {
  "--no-display": "d",
  "--no-idle": "i",
  "--no-disk": "m",
  "--no-system": "s",
  "--no-wake": "u",
}

/**
 * Parse raw argv for flag arguments. Used by the duration shortcut path
 * where @effect/cli doesn't handle flag parsing.
 * Unknown args are silently ignored.
 */
export const parseArgvFlags = (
  args: string[],
): { adds: Set<string>; removes: Set<string> } => {
  const adds = new Set<string>()
  const removes = new Set<string>()

  for (const arg of args) {
    const addFlag = ADD_MAP[arg]
    if (addFlag) {
      adds.add(addFlag)
      continue
    }
    const removeFlag = REMOVE_MAP[arg]
    if (removeFlag) {
      removes.add(removeFlag)
    }
  }

  return { adds, removes }
}

/**
 * Build a hint string suggesting the user add flags to LATTE_FLAGS,
 * but only for flags that are genuinely new (not in defaults or env)
 * and were not also removed in the same invocation.
 * Returns null if there's nothing to suggest.
 */
export const buildHint = (cliAdds: Set<string>, cliRemoves: Set<string>): string | null => {
  // Compute what's already "on" before CLI (silent parse to avoid double warning)
  const baseline = new Set(DEFAULT_FLAGS)
  const envValue = process.env.LATTE_FLAGS
  if (envValue) {
    for (const f of parseEnvFlagsSilent(envValue)) {
      baseline.add(f)
    }
  }

  // Find flags the user added via CLI that aren't already in the baseline
  // and weren't also removed in the same invocation
  const newFlags = [...cliAdds]
    .filter((f) => !baseline.has(f) && !cliRemoves.has(f))
    .sort()
  if (newFlags.length === 0) return null

  const flagStr = `-${newFlags.join("")}`
  return `Tip: add \`export LATTE_FLAGS="${flagStr}"\` to your shell profile to always use this flag.`
}
