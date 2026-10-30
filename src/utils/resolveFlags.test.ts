import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { Either } from "effect"
import { initialFlagSet, parseEnvFlags, parseStartArgs, resolveFlags, toSelection } from "./resolveFlags.ts"

const originalEnv = process.env.LATTE_FLAGS
beforeEach(() => {
  delete process.env.LATTE_FLAGS
})
afterEach(() => {
  if (originalEnv === undefined) delete process.env.LATTE_FLAGS
  else process.env.LATTE_FLAGS = originalEnv
})

const captureStderr = (fn: () => void): string => {
  const chunks: string[] = []
  const orig = process.stderr.write.bind(process.stderr)
  process.stderr.write = ((chunk: unknown) => {
    chunks.push(String(chunk))
    return true
  }) as typeof process.stderr.write
  try {
    fn()
  } finally {
    process.stderr.write = orig
  }
  return chunks.join("")
}

/** The caffeinate flag string `latte 30m <args>` would run. */
const resolvedArgs = (...args: string[]): string =>
  resolveFlags(Either.getOrThrow(parseStartArgs(args)).selection)

const argsError = (...args: string[]): string | undefined =>
  Either.match(parseStartArgs(args), { onLeft: (e) => e.message, onRight: () => undefined })

describe("parseEnvFlags", () => {
  test("parses flags with dashes and whitespace", () => {
    expect(parseEnvFlags("-d -s")).toEqual(new Set(["d", "s"]))
    expect(parseEnvFlags(" --d ")).toEqual(new Set(["d"]))
  })

  test("returns empty set for empty string", () => {
    expect(parseEnvFlags("")).toEqual(new Set())
  })

  test("ignores invalid characters with a warning", () => {
    let result: Set<string> = new Set()
    const stderr = captureStderr(() => {
      result = parseEnvFlags("-dxz")
    })
    expect(result).toEqual(new Set(["d"]))
    expect(stderr).toBe("latte: ignoring invalid characters in LATTE_FLAGS: x, z\n")
  })
})

describe("selecting flags from arguments", () => {
  test("defaults to the awake preset", () => {
    expect(resolvedArgs()).toBe("-is")
  })

  test("--screen and -d select the screen preset", () => {
    expect(resolvedArgs("--screen")).toBe("-dis")
    expect(resolvedArgs("-d")).toBe("-dis")
  })

  test("--flags is exact, with or without a dash", () => {
    expect(resolvedArgs("--flags", "dm")).toBe("-dm")
    expect(resolvedArgs("--flags", "-dm")).toBe("-dm")
    expect(resolvedArgs("--flags=md")).toBe("-dm")
  })

  test("--flags ignores LATTE_FLAGS", () => {
    process.env.LATTE_FLAGS = "-u"
    expect(resolvedArgs("--flags", "dm")).toBe("-dm")
  })

  test("LATTE_FLAGS adds to a preset", () => {
    process.env.LATTE_FLAGS = "-d"
    expect(resolvedArgs()).toBe("-dis")
    process.env.LATTE_FLAGS = "-u"
    expect(resolvedArgs("--screen")).toBe("-disu")
  })

  test("invalid LATTE_FLAGS characters warn and are ignored for a preset", () => {
    process.env.LATTE_FLAGS = "-dz"
    let flags = ""
    const stderr = captureStderr(() => {
      flags = resolvedArgs()
    })
    expect(flags).toBe("-dis")
    expect(stderr).toContain("ignoring invalid characters in LATTE_FLAGS: z")
  })

  test("--screen with --flags is an error", () => {
    const message = "--screen and --flags can't be combined. Add d to --flags to keep the screen on."
    expect(argsError("--screen", "--flags", "d")).toBe(message)
    expect(argsError("--flags=d", "-d")).toBe(message)
  })

  test("unknown --flags letters are an error", () => {
    expect(argsError("--flags", "iz")).toBe('Unknown flag letter "z" in --flags. Use any of d, i, m, s, u.')
  })

  test("empty --flags is an error", () => {
    const message = "--flags needs at least one letter. Use any of d, i, m, s, u."
    expect(argsError("--flags", "")).toBe(message)
    expect(argsError("--flags", "-")).toBe(message)
    expect(argsError("--flags")).toBe(message)
  })

  test("any other argument is an error", () => {
    expect(argsError("--no-system")).toBe("Unknown option --no-system. Use --flags for exact caffeinate flags.")
    expect(argsError("--screen", "-m")).toBe("Unknown option -m. Use --flags for exact caffeinate flags.")
  })
})

describe("--while after a duration", () => {
  const watchOf = (...args: string[]) => Either.getOrThrow(parseStartArgs(args)).watch

  test("takes the app or PID as the next argument or after =", () => {
    expect(watchOf()).toBeUndefined()
    expect(watchOf("--while", "cursor")).toBe("cursor")
    expect(watchOf("--while=4242")).toBe("4242")
    expect(watchOf("--while")).toBe("")
    expect(watchOf("--screen", "--while", "Visual Studio Code")).toBe("Visual Studio Code")
  })

  test("combines with the flag selection", () => {
    expect(resolvedArgs("--while", "claude", "--screen")).toBe("-dis")
  })
})

describe("toSelection", () => {
  test("maps parsed `latte on` options the same way", () => {
    expect(resolveFlags(Either.getOrThrow(toSelection({ screen: false, flags: undefined })))).toBe("-is")
    expect(resolveFlags(Either.getOrThrow(toSelection({ screen: true, flags: undefined })))).toBe("-dis")
    expect(resolveFlags(Either.getOrThrow(toSelection({ screen: false, flags: "u" })))).toBe("-u")
    expect(Either.isLeft(toSelection({ screen: true, flags: "d" }))).toBe(true)
  })
})

describe("initialFlagSet", () => {
  test("is the awake preset without LATTE_FLAGS", () => {
    expect(initialFlagSet()).toEqual(new Set(["i", "s"]))
  })

  test("adds LATTE_FLAGS", () => {
    process.env.LATTE_FLAGS = "-d"
    expect(initialFlagSet()).toEqual(new Set(["d", "i", "s"]))
  })
})
