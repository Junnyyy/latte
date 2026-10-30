import { Either } from "effect"
import { SelectionError } from "../errors/index.ts"
import { FLAGS, PRESETS, flagSetToString, isFlag, type Flag, type Preset, type Selection } from "./flags.ts"

const LETTERS = FLAGS.join(", ")

/**
 * Parse a LATTE_FLAGS value into flags. Dashes and whitespace are stripped.
 * Other characters are ignored, with a warning on stderr when `warn` is set.
 */
export const parseEnvFlags = (value: string, warn = true): Set<Flag> => {
  const valid = new Set<Flag>()
  const invalid: string[] = []

  for (const char of value.replace(/[-\s]/g, "")) {
    if (isFlag(char)) valid.add(char)
    else invalid.push(char)
  }

  if (warn && invalid.length > 0) {
    process.stderr.write(
      `latte: ignoring invalid characters in LATTE_FLAGS: ${invalid.join(", ")}\n`,
    )
  }

  return valid
}

const presetFlags = (preset: Preset, warn: boolean): Set<Flag> =>
  new Set([...PRESETS[preset].flags, ...parseEnvFlags(process.env.LATTE_FLAGS ?? "", warn)])

/**
 * The caffeinate flag string for a selection. A preset adds LATTE_FLAGS to its
 * own flags. Custom flags are used exactly and ignore LATTE_FLAGS.
 */
export const resolveFlags = (selection: Selection): string =>
  flagSetToString(selection.kind === "custom" ? selection.flags : presetFlags(selection.preset, true))

/** The TUI's starting flag set: the awake preset plus LATTE_FLAGS. */
export const initialFlagSet = (): Set<Flag> =>
  presetFlags("awake", false)

/**
 * Turn the --screen and --flags options into a selection.
 * --flags takes caffeinate letters, with or without a leading dash.
 */
export const toSelection = (opts: {
  screen: boolean
  flags: string | undefined
}): Either.Either<Selection, SelectionError> => {
  if (opts.flags === undefined) {
    return Either.right({ kind: "preset", preset: opts.screen ? "screen" : "awake" })
  }
  if (opts.screen) {
    return Either.left(new SelectionError({
      message: "--screen and --flags can't be combined. Add d to --flags to keep the screen on.",
    }))
  }

  const letters = [...opts.flags.replace(/^-/, "")]
  if (letters.length === 0) {
    return Either.left(new SelectionError({ message: `--flags needs at least one letter. Use any of ${LETTERS}.` }))
  }
  if (!letters.every(isFlag)) {
    const unknown = letters.find((c) => !isFlag(c))
    return Either.left(new SelectionError({
      message: `Unknown flag letter "${unknown}" in --flags. Use any of ${LETTERS}.`,
    }))
  }
  return Either.right({ kind: "custom", flags: new Set(letters) })
}

/**
 * Parse the arguments after a duration, as in `latte 30m --screen`.
 * @effect/cli parses `latte on`, so only this path reads raw argv.
 */
export const parseSelectionArgs = (args: readonly string[]): Either.Either<Selection, SelectionError> => {
  let screen = false
  let flags: string | undefined

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === "--screen" || arg === "-d") {
      screen = true
    } else if (arg === "--flags") {
      flags = args[++i] ?? ""
    } else if (arg.startsWith("--flags=")) {
      flags = arg.slice("--flags=".length)
    } else {
      return Either.left(new SelectionError({
        message: `Unknown option ${arg}. Use --flags for exact caffeinate flags.`,
      }))
    }
  }

  return toSelection({ screen, flags })
}
