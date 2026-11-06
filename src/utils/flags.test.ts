import { test, expect, describe } from "bun:test"
import { describeFlags, parseFlagString, toggleFlag, type Flag } from "./flags.ts"

describe("describeFlags", () => {
  test("describes the awake preset in any order", () => {
    expect(describeFlags("-is")).toBe("Mac stays awake, screen can sleep")
    expect(describeFlags("-si")).toBe("Mac stays awake, screen can sleep")
  })

  test("describes the screen preset in any order", () => {
    expect(describeFlags("-dis")).toBe("Mac and screen stay awake")
    expect(describeFlags("-sdi")).toBe("Mac and screen stay awake")
  })

  test("handles flags without leading dash", () => {
    expect(describeFlags("is")).toBe("Mac stays awake, screen can sleep")
  })

  test("describes other sets as custom flags", () => {
    expect(describeFlags("-md")).toBe("custom flags -dm (display, disk)")
    expect(describeFlags("-imsu")).toBe("custom flags -imsu (idle, disk, system (AC), user active)")
  })

  test("a preset with an extra flag is custom", () => {
    expect(describeFlags("-ims")).toBe("custom flags -ims (idle, disk, system (AC))")
  })

  test("describes an empty flag string", () => {
    expect(describeFlags("")).toBe("no flags")
  })

  test("returns raw flags for unknown flags", () => {
    expect(describeFlags("-xyz")).toBe("-xyz")
    expect(describeFlags("-iz")).toBe("-iz")
  })
})

describe("parseFlagString", () => {
  test("reads letters with or without a leading dash", () => {
    expect(parseFlagString("-dis")).toEqual(new Set<Flag>(["d", "i", "s"]))
    expect(parseFlagString("si")).toEqual(new Set<Flag>(["i", "s"]))
    expect(parseFlagString("")).toEqual(new Set<Flag>())
  })

  test("returns null for a string with an unknown letter", () => {
    expect(parseFlagString("-iz")).toBeNull()
  })
})

describe("toggleFlag", () => {
  test("adds a missing flag and removes a present one without changing the input", () => {
    const flags = new Set<Flag>(["i", "s"])
    expect(toggleFlag(flags, "d")).toEqual(new Set<Flag>(["d", "i", "s"]))
    expect(toggleFlag(flags, "s")).toEqual(new Set<Flag>(["i"]))
    expect(flags).toEqual(new Set<Flag>(["i", "s"]))
  })
})
