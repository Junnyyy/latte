import { Effect } from "effect"
import { DurationParseError } from "../errors/index.ts"

const UNIT_MULTIPLIERS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
}

/**
 * Parse a duration string like "30m", "2h", "90s" into seconds.
 * Returns an Effect that fails with DurationParseError on invalid input.
 */
export const parseDuration = (input: string): Effect.Effect<number, DurationParseError> => {
  const trimmed = input.trim()

  if (trimmed.length === 0) {
    return Effect.fail(new DurationParseError({ input, message: "Duration cannot be empty" }))
  }

  const match = trimmed.match(/^(\d+)\s*(s|m|h)$/i)

  if (!match) {
    return Effect.fail(
      new DurationParseError({
        input,
        message: `Invalid duration "${input}". Use a number followed by s, m, or h (e.g. 30m, 2h, 90s)`,
      }),
    )
  }

  const value = parseInt(match[1]!, 10)
  const unit = match[2]!.toLowerCase()

  if (value <= 0) {
    return Effect.fail(
      new DurationParseError({ input, message: "Duration must be greater than zero" }),
    )
  }

  const seconds = value * UNIT_MULTIPLIERS[unit]!
  return Effect.succeed(seconds)
}

/**
 * Format seconds into a human-readable duration string.
 * Examples: 1800 -> "30m", 3723 -> "1h 2m 3s"
 */
export const formatDuration = (totalSeconds: number): string => {
  if (totalSeconds <= 0) return "0s"

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0) parts.push(`${seconds}s`)

  return parts.join(" ")
}
