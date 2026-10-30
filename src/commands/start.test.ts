import { test, expect, describe, beforeEach, afterEach, spyOn } from "bun:test"
import { Effect, Layer } from "effect"
import { CaffeinateService } from "../services/Caffeinate.ts"
import { ProcessService } from "../services/Process.ts"
import { ProcessError } from "../errors/index.ts"
import { onHandler } from "./on.ts"
import { timedHandler } from "./timed.ts"

const originalEnv = process.env.LATTE_FLAGS
beforeEach(() => {
  delete process.env.LATTE_FLAGS
})
afterEach(() => {
  if (originalEnv === undefined) delete process.env.LATTE_FLAGS
  else process.env.LATTE_FLAGS = originalEnv
})

/** Run a start command with nothing running. Returns the spawned argv and printed lines. */
const runStart = async (effect: Effect.Effect<void, never, CaffeinateService>) => {
  let spawned: string[] = []
  const processLayer = Layer.succeed(ProcessService, {
    exec: (args: string[]) => Effect.fail(new ProcessError({ command: args.join(" "), cause: "none running" })),
    spawnDetached: (args: string[]) => {
      spawned = args
      return Effect.succeed(12345)
    },
  } as any)
  const layer = CaffeinateService.DefaultWithoutDependencies.pipe(Layer.provide(processLayer))

  const log = spyOn(console, "log").mockImplementation(() => {})
  try {
    await Effect.runPromise(effect.pipe(Effect.provide(layer)))
    const lines = log.mock.calls.map((args) => args.join(" ").replace(/\x1b\[[0-9;]*m/g, ""))
    return { spawned, lines }
  } finally {
    log.mockRestore()
  }
}

describe("latte on", () => {
  test("starts the awake preset and warns about the lid", async () => {
    const { spawned, lines } = await runStart(onHandler({ kind: "preset", preset: "awake" }))
    expect(spawned).toEqual(["caffeinate", "-is"])
    expect(lines).toEqual([
      "☕ On — Mac stays awake, screen can sleep",
      "Closing the lid can still sleep your Mac.",
    ])
  })

  test("--screen keeps the screen on", async () => {
    const { spawned, lines } = await runStart(onHandler({ kind: "preset", preset: "screen" }))
    expect(spawned).toEqual(["caffeinate", "-dis"])
    expect(lines[0]).toBe("☕ On — Mac and screen stay awake")
  })

  test("custom flags name their modes and skip the lid note", async () => {
    const { spawned, lines } = await runStart(onHandler({ kind: "custom", flags: new Set(["m", "d"]) }))
    expect(spawned).toEqual(["caffeinate", "-dm"])
    expect(lines).toEqual(["☕ On — custom flags -dm (display, disk)"])
  })
})

describe("latte <duration>", () => {
  test("starts a timed preset session", async () => {
    const { spawned, lines } = await runStart(timedHandler("30m", { kind: "preset", preset: "awake" }))
    expect(spawned).toEqual(["caffeinate", "-is", "-t", "1800"])
    expect(lines).toEqual([
      "☕ On for 30m — Mac stays awake, screen can sleep",
      "Closing the lid can still sleep your Mac.",
    ])
  })
})
