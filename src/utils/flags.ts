const FLAG_DESCRIPTIONS: Record<string, string> = {
  d: "display",
  i: "idle",
  m: "disk",
  s: "system (AC)",
  u: "wake display",
}

/**
 * Convert caffeinate flags like "-imsu" to human-readable descriptions.
 * Returns comma-separated list like "idle, disk, system (AC), wake display".
 * Falls back to the raw flag string if any flag is unrecognized.
 */
export const describeFlags = (flags: string): string => {
  const raw = flags.replace(/^-/, "")
  const descriptions = raw.split("").map((f) => FLAG_DESCRIPTIONS[f])

  if (descriptions.some((d) => d === undefined)) {
    return flags
  }

  return descriptions.join(", ")
}
