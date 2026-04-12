export const VALID_FLAGS = new Set(["d", "i", "m", "s", "u"])
export const DEFAULT_FLAGS = new Set(["i", "m", "s", "u"])

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
 * Build a hint string suggesting the user add flags to LATTE_FLAGS,
 * but only for flags that are genuinely new (not in defaults or env).
 * Returns null if there's nothing to suggest.
 */
export const buildHint = (cliAdds: Set<string>): string | null => {
  // Compute what's already "on" before CLI
  const baseline = new Set(DEFAULT_FLAGS)
  const envValue = process.env.LATTE_FLAGS
  if (envValue) {
    for (const f of parseEnvFlags(envValue)) {
      baseline.add(f)
    }
  }

  // Find flags the user added via CLI that aren't already in the baseline
  const newFlags = [...cliAdds].filter((f) => !baseline.has(f)).sort()
  if (newFlags.length === 0) return null

  const flagStr = `-${newFlags.join("")}`
  return `Tip: add \`export LATTE_FLAGS="${flagStr}"\` to your shell profile to always use this flag.`
}
