import { test, expect, describe } from "bun:test"
import { Effect, Exit } from "effect"
import { parseDuration, formatDuration } from "./duration.ts"

describe("parseDuration", () => {
  test("parses seconds", () => {
    const result = Effect.runSyncExit(parseDuration("90s"))
    expect(Exit.isSuccess(result)).toBe(true)
    if (Exit.isSuccess(result)) expect(result.value).toBe(90)
  })

  test("parses minutes", () => {
    const result = Effect.runSyncExit(parseDuration("30m"))
    expect(Exit.isSuccess(result)).toBe(true)
    if (Exit.isSuccess(result)) expect(result.value).toBe(1800)
  })

  test("parses hours", () => {
    const result = Effect.runSyncExit(parseDuration("2h"))
    expect(Exit.isSuccess(result)).toBe(true)
    if (Exit.isSuccess(result)) expect(result.value).toBe(7200)
  })

  test("rejects invalid unit", () => {
    const result = Effect.runSyncExit(parseDuration("30x"))
    expect(Exit.isFailure(result)).toBe(true)
  })

  test("rejects non-numeric value", () => {
    const result = Effect.runSyncExit(parseDuration("abc"))
    expect(Exit.isFailure(result)).toBe(true)
  })

  test("rejects empty string", () => {
    const result = Effect.runSyncExit(parseDuration(""))
    expect(Exit.isFailure(result)).toBe(true)
  })

  test("rejects zero", () => {
    const result = Effect.runSyncExit(parseDuration("0m"))
    expect(Exit.isFailure(result)).toBe(true)
  })

  test("rejects negative values", () => {
    const result = Effect.runSyncExit(parseDuration("-5m"))
    expect(Exit.isFailure(result)).toBe(true)
  })
})

describe("formatDuration", () => {
  test("formats seconds only", () => {
    expect(formatDuration(45)).toBe("45s")
  })

  test("formats minutes only", () => {
    expect(formatDuration(1800)).toBe("30m")
  })

  test("formats hours only", () => {
    expect(formatDuration(7200)).toBe("2h")
  })

  test("formats hours and minutes", () => {
    expect(formatDuration(3720)).toBe("1h 2m")
  })

  test("formats minutes and seconds", () => {
    expect(formatDuration(125)).toBe("2m 5s")
  })

  test("formats hours, minutes, seconds", () => {
    expect(formatDuration(3723)).toBe("1h 2m 3s")
  })

  test("formats zero", () => {
    expect(formatDuration(0)).toBe("0s")
  })
})
