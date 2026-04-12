import { test, expect, describe } from "bun:test"
import { parseEnvFlags, resolveFlags, buildHint } from "./resolveFlags.ts"

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
})

describe("buildHint", () => {
  test("returns hint for non-default CLI add", () => {
    const orig = process.env.LATTE_FLAGS
    delete process.env.LATTE_FLAGS
    try {
      const hint = buildHint(new Set(["d"]))
      expect(hint).toBe(
        'Tip: add `export LATTE_FLAGS="-d"` to your shell profile to always use this flag.',
      )
    } finally {
      if (orig !== undefined) process.env.LATTE_FLAGS = orig
    }
  })

  test("returns null when no non-default CLI adds", () => {
    expect(buildHint(new Set())).toBeNull()
  })

  test("returns null when add is already in defaults", () => {
    expect(buildHint(new Set(["i"]))).toBeNull()
  })

  test("returns null when add is already in LATTE_FLAGS", () => {
    const orig = process.env.LATTE_FLAGS
    process.env.LATTE_FLAGS = "-d"
    try {
      expect(buildHint(new Set(["d"]))).toBeNull()
    } finally {
      if (orig === undefined) delete process.env.LATTE_FLAGS
      else process.env.LATTE_FLAGS = orig
    }
  })

  test("shows multiple flags in hint", () => {
    const orig = process.env.LATTE_FLAGS
    delete process.env.LATTE_FLAGS
    try {
      const hint = buildHint(new Set(["d"]))
      expect(hint).toContain("-d")
    } finally {
      if (orig !== undefined) process.env.LATTE_FLAGS = orig
    }
  })
})
