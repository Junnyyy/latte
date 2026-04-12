import { test, expect, describe } from "bun:test"
import { parseEnvFlags } from "./resolveFlags.ts"

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
