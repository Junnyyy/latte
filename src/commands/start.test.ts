import { test, expect, describe, beforeEach, afterEach, spyOn } from "bun:test"
import { Effect, Layer } from "effect"
import { CaffeinateService } from "../services/Caffeinate.ts"
import { ProcessService } from "../services/Process.ts"
import { ProcessError } from "../errors/index.ts"
import { startHandler } from "./start.ts"

const originalEnv = process.env.LATTE_FLAGS
beforeEach(() => {
  delete process.env.LATTE_FLAGS
})
afterEach(() => {
  if (originalEnv === undefined) delete process.env.LATTE_FLAGS
  else process.env.LATTE_FLAGS = originalEnv
})

const PROCESS_TABLE = `
    1     0 /sbin/launchd
60100     1 /Applications/Cursor.app/Contents/MacOS/Cursor
60101 60100 /Applications/Cursor.app/Contents/Frameworks/Cursor Helper (Renderer).app/Contents/MacOS/Cursor Helper (Renderer)
`

const strip = (args: unknown[]) => args.join(" ").replace(/\x1b\[[0-9;]*m/g, "")

/**
 * Run a start command with PROCESS_TABLE as the other processes. `running` is
 * the argv of a caffeinate already running, if any. Returns the spawned argv,
 * whether latte killed caffeinate, printed lines, error lines, and exit code.
 */
const runStart = async (effect: Effect.Effect<void, never, CaffeinateService>, running?: string) => {
  let spawned: string[] = []
  let killed = false
  const replies: Record<string, string | undefined> = {
    "ps -axo pid=,ppid=,comm=": PROCESS_TABLE,
    "ps -o comm= -p 60100": "/Applications/Cursor.app/Contents/MacOS/Cursor\n",
    "pgrep -x caffeinate": running && "42\n",
    "ps -o pid=,lstart=,args= -p 42": running && `42 ${new Date(Date.now() - 300_000).toString().slice(0, 24)} ${running}\n`,
  }
  const processLayer = Layer.succeed(ProcessService, {
    exec: (args: string[]) => {
      const command = args.join(" ")
      if (command === "pkill -x caffeinate") {
        killed = true
        return Effect.succeed("")
      }
      const reply = replies[command]
      return reply !== undefined
        ? Effect.succeed(reply)
        : Effect.fail(new ProcessError({ command, cause: "none running" }))
    },
    spawnDetached: (args: string[]) => {
      spawned = args
      return Effect.succeed(12345)
    },
  } as any)
  const layer = CaffeinateService.DefaultWithoutDependencies.pipe(Layer.provide(processLayer))

  const log = spyOn(console, "log").mockImplementation(() => {})
  const error = spyOn(console, "error").mockImplementation(() => {})
  const exitCode = process.exitCode
  try {
    await Effect.runPromise(effect.pipe(Effect.provide(layer)))
    return {
      spawned,
      killed,
      lines: log.mock.calls.map(strip),
      errors: error.mock.calls.map(strip),
      exitCode: process.exitCode,
    }
  } finally {
    log.mockRestore()
    error.mockRestore()
    process.exitCode = exitCode
  }
}

describe("latte on", () => {
  test("starts the awake preset and warns about the lid", async () => {
    const { spawned, lines } = await runStart(startHandler({ selection: { kind: "preset", preset: "awake" } }))
    expect(spawned).toEqual(["caffeinate", "-is"])
    expect(lines).toEqual([
      "☕ On — Mac stays awake, screen can sleep",
      "Closing the lid can still sleep your Mac.",
    ])
  })

  test("--screen keeps the screen on", async () => {
    const { spawned, lines } = await runStart(startHandler({ selection: { kind: "preset", preset: "screen" } }))
    expect(spawned).toEqual(["caffeinate", "-dis"])
    expect(lines[0]).toBe("☕ On — Mac and screen stay awake")
  })

  test("custom flags name their modes and skip the lid note", async () => {
    const { spawned, lines } = await runStart(startHandler({ selection: { kind: "custom", flags: new Set(["m", "d"]) } }))
    expect(spawned).toEqual(["caffeinate", "-dm"])
    expect(lines).toEqual(["☕ On — custom flags -dm (display, disk)"])
  })
})

describe("latte <duration>", () => {
  test("starts a timed preset session", async () => {
    const { spawned, lines } = await runStart(startHandler({ selection: { kind: "preset", preset: "awake" }, duration: "30m" }))
    expect(spawned).toEqual(["caffeinate", "-is", "-t", "1800"])
    expect(lines).toEqual([
      "☕ On for 30m — Mac stays awake, screen can sleep",
      "Closing the lid can still sleep your Mac.",
    ])
  })
})

describe("--while", () => {
  const awake = { kind: "preset", preset: "awake" } as const

  test("latte on --while stays awake until the app exits", async () => {
    const { spawned, lines } = await runStart(startHandler({ selection: awake, watch: "cursor" }))
    expect(spawned).toEqual(["caffeinate", "-is", "-w", "60100"])
    expect(lines).toEqual([
      "☕ On until Cursor exits — Mac stays awake, screen can sleep",
      "Closing the lid can still sleep your Mac.",
    ])
  })

  test("a duration with --while ends at whichever comes first", async () => {
    const { spawned, lines } = await runStart(startHandler({ selection: awake, duration: "2h", watch: "60100" }))
    expect(spawned).toEqual(["caffeinate", "-is", "-w", "60100", "-t", "7200"])
    expect(lines[0]).toBe("☕ On for 2h or until Cursor exits — Mac stays awake, screen can sleep")
  })

  test("an app that isn't running starts nothing and exits 1", async () => {
    const { spawned, lines, errors, exitCode } = await runStart(startHandler({ selection: awake, watch: "zed" }))
    expect(spawned).toEqual([])
    expect(lines).toEqual([])
    expect(errors).toEqual(["zed isn't running. Open it first, or pass its PID."])
    expect(exitCode).toBe(1)
  })

  test("a target that doesn't resolve leaves a running session alone", async () => {
    const { spawned, killed, exitCode } = await runStart(
      startHandler({ selection: awake, watch: "4242" }),
      "caffeinate -is",
    )
    expect(killed).toBe(false)
    expect(spawned).toEqual([])
    expect(exitCode).toBe(1)
  })

  test("replacing a watched session names what it was waiting for", async () => {
    const { killed, lines } = await runStart(
      startHandler({ selection: awake, duration: "30m" }),
      "caffeinate -is -w 60100 -t 7200",
    )
    expect(lines[0]).toStartWith("⚠ Caffeinate is already running (5m")
    expect(lines[0]).toEndWith(", 2h or until Cursor exits)")
    expect(killed).toBe(true)
  })
})
