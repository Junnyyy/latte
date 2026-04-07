import { test, expect, describe } from "bun:test"
import { describeFlags } from "./flags.ts"

describe("describeFlags", () => {
  test("describes standard latte flags", () => {
    expect(describeFlags("-imsu")).toBe("idle, disk, system (AC), wake display")
  })

  test("describes single flag", () => {
    expect(describeFlags("-i")).toBe("idle")
  })

  test("describes display flag", () => {
    expect(describeFlags("-d")).toBe("display")
  })

  test("handles flags without leading dash", () => {
    expect(describeFlags("imsu")).toBe("idle, disk, system (AC), wake display")
  })

  test("returns raw flags for unknown flags", () => {
    expect(describeFlags("-xyz")).toBe("-xyz")
  })

  test("handles mixed known and unknown", () => {
    expect(describeFlags("-iz")).toBe("-iz")
  })
})
