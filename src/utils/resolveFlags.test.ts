import { test, expect, describe } from "bun:test"
import { parseEnvFlags, resolveFlags, buildHint, parseArgvFlags, flagSetToString, initialFlagSet } from "./resolveFlags.ts"

describe("parseEnvFlags", () => {
  test("parses single flag", () => {
    expect(parseEnvFlags("-d")).toEqual(new Set(["d"]))
  })

  test("parses multiple flags", () => {
    expect(parseEnvFlags("-ds")).toEqual(new Set(["d", "s"]))
  })

  test("strips leading dashes", () => {
    expect(parseEnvFlags("--d")).toEqual(new Set(["d"]))
  })

  test("strips whitespace", () => {
    expect(parseEnvFlags(" -d ")).toEqual(new Set(["d"]))
  })

  test("returns empty set for empty string", () => {
    expect(parseEnvFlags("")).toEqual(new Set())
  })

  test("parses space-separated flags", () => {
    expect(parseEnvFlags("-d -s")).toEqual(new Set(["d", "s"]))
  })

  test("ignores invalid characters and returns valid ones", () => {
    const warn: string[] = []
    const orig = process.stderr.write.bind(process.stderr)
    process.stderr.write = ((chunk: any) => {
      warn.push(String(chunk))
      return true
    }) as any
    const result = parseEnvFlags("-dxz")
    process.stderr.write = orig
    expect(result).toEqual(new Set(["d"]))
    expect(warn.some((w) => w.includes("x") && w.includes("z"))).toBe(true)
  })

  test("deduplicates flags", () => {
    expect(parseEnvFlags("-ddi")).toEqual(new Set(["d", "i"]))
  })
})

describe("resolveFlags", () => {
  test("returns defaults when no overrides", () => {
    expect(resolveFlags(new Set(), new Set())).toBe("-imsu")
  })

  test("adds a flag", () => {
    expect(resolveFlags(new Set(["d"]), new Set())).toBe("-dimsu")
  })

  test("removes a flag", () => {
    expect(resolveFlags(new Set(), new Set(["s"]))).toBe("-imu")
  })

  test("adds and removes", () => {
    expect(resolveFlags(new Set(["d"]), new Set(["s"]))).toBe("-dimu")
  })

  test("remove wins over add for same flag", () => {
    expect(resolveFlags(new Set(["d"]), new Set(["d"]))).toBe("-imsu")
  })

  test("adding existing default is a no-op", () => {
    expect(resolveFlags(new Set(["i"]), new Set())).toBe("-imsu")
  })

  test("returns empty string when all flags removed", () => {
    expect(resolveFlags(new Set(), new Set(["i", "m", "s", "u"]))).toBe("")
  })

  test("merges env flags additively", () => {
    const orig = process.env.LATTE_FLAGS
    process.env.LATTE_FLAGS = "-d"
    try {
      expect(resolveFlags(new Set(), new Set())).toBe("-dimsu")
    } finally {
      if (orig === undefined) delete process.env.LATTE_FLAGS
      else process.env.LATTE_FLAGS = orig
    }
  })

  test("CLI remove overrides env add", () => {
    const orig = process.env.LATTE_FLAGS
    process.env.LATTE_FLAGS = "-d"
    try {
      expect(resolveFlags(new Set(), new Set(["d"]))).toBe("-imsu")
    } finally {
      if (orig === undefined) delete process.env.LATTE_FLAGS
      else process.env.LATTE_FLAGS = orig
    }
  })

  test("env add and CLI remove of different flag", () => {
    const orig = process.env.LATTE_FLAGS
    process.env.LATTE_FLAGS = "-d"
    try {
      expect(resolveFlags(new Set(), new Set(["i"]))).toBe("-dmsu")
    } finally {
      if (orig === undefined) delete process.env.LATTE_FLAGS
      else process.env.LATTE_FLAGS = orig
    }
  })
})

describe("buildHint", () => {
  test("returns hint for non-default CLI add", () => {
    const orig = process.env.LATTE_FLAGS
    delete process.env.LATTE_FLAGS
    try {
      const hint = buildHint(new Set(["d"]), new Set())
      expect(hint).toBe(
        'Tip: add `export LATTE_FLAGS="-d"` to your shell profile to always use this flag.',
      )
    } finally {
      if (orig !== undefined) process.env.LATTE_FLAGS = orig
    }
  })

  test("returns null when no non-default CLI adds", () => {
    expect(buildHint(new Set(), new Set())).toBeNull()
  })

  test("returns null when add is already in defaults", () => {
    expect(buildHint(new Set(["i"]), new Set())).toBeNull()
  })

  test("returns null when add is already in LATTE_FLAGS", () => {
    const orig = process.env.LATTE_FLAGS
    process.env.LATTE_FLAGS = "-d"
    try {
      expect(buildHint(new Set(["d"]), new Set())).toBeNull()
    } finally {
      if (orig === undefined) delete process.env.LATTE_FLAGS
      else process.env.LATTE_FLAGS = orig
    }
  })

  test("shows hint containing the flag", () => {
    const orig = process.env.LATTE_FLAGS
    delete process.env.LATTE_FLAGS
    try {
      const hint = buildHint(new Set(["d"]), new Set())
      expect(hint).toContain("-d")
    } finally {
      if (orig !== undefined) process.env.LATTE_FLAGS = orig
    }
  })

  test("returns null when flag is both added and removed (contradictory)", () => {
    const orig = process.env.LATTE_FLAGS
    delete process.env.LATTE_FLAGS
    try {
      expect(buildHint(new Set(["d"]), new Set(["d"]))).toBeNull()
    } finally {
      if (orig !== undefined) process.env.LATTE_FLAGS = orig
    }
  })
})

describe("parseArgvFlags", () => {
  test("parses --display into adds", () => {
    const { adds, removes } = parseArgvFlags(["--display"])
    expect(adds).toEqual(new Set(["d"]))
    expect(removes).toEqual(new Set())
  })

  test("parses -d into adds", () => {
    const { adds, removes } = parseArgvFlags(["-d"])
    expect(adds).toEqual(new Set(["d"]))
    expect(removes).toEqual(new Set())
  })

  test("parses --no-system into removes", () => {
    const { adds, removes } = parseArgvFlags(["--no-system"])
    expect(adds).toEqual(new Set())
    expect(removes).toEqual(new Set(["s"]))
  })

  test("parses mixed adds and removes", () => {
    const { adds, removes } = parseArgvFlags(["-d", "--no-system"])
    expect(adds).toEqual(new Set(["d"]))
    expect(removes).toEqual(new Set(["s"]))
  })

  test("ignores unknown args", () => {
    const { adds, removes } = parseArgvFlags(["--unknown", "-d", "30m"])
    expect(adds).toEqual(new Set(["d"]))
    expect(removes).toEqual(new Set())
  })

  test("returns empty sets for no args", () => {
    const { adds, removes } = parseArgvFlags([])
    expect(adds).toEqual(new Set())
    expect(removes).toEqual(new Set())
  })

  test("parses all short flags", () => {
    const { adds } = parseArgvFlags(["-d", "-i", "-m", "-s", "-u"])
    expect(adds).toEqual(new Set(["d", "i", "m", "s", "u"]))
  })

  test("parses all long remove flags", () => {
    const { removes } = parseArgvFlags([
      "--no-display", "--no-idle", "--no-disk", "--no-system", "--no-wake",
    ])
    expect(removes).toEqual(new Set(["d", "i", "m", "s", "u"]))
  })
})

describe("flagSetToString", () => {
  test("converts set to sorted flag string", () => {
    expect(flagSetToString(new Set(["d", "i", "m", "s", "u"]))).toBe("-dimsu")
  })

  test("returns empty string for empty set", () => {
    expect(flagSetToString(new Set())).toBe("")
  })

  test("sorts flags alphabetically", () => {
    expect(flagSetToString(new Set(["u", "d", "i"]))).toBe("-diu")
  })
})

describe("initialFlagSet", () => {
  test("returns defaults when no LATTE_FLAGS", () => {
    const orig = process.env.LATTE_FLAGS
    delete process.env.LATTE_FLAGS
    try {
      expect(initialFlagSet()).toEqual(new Set(["i", "m", "s", "u"]))
    } finally {
      if (orig !== undefined) process.env.LATTE_FLAGS = orig
    }
  })

  test("merges LATTE_FLAGS with defaults", () => {
    const orig = process.env.LATTE_FLAGS
    process.env.LATTE_FLAGS = "-d"
    try {
      expect(initialFlagSet()).toEqual(new Set(["d", "i", "m", "s", "u"]))
    } finally {
      if (orig === undefined) delete process.env.LATTE_FLAGS
      else process.env.LATTE_FLAGS = orig
    }
  })
})
