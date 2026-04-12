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
