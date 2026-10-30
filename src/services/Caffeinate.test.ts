import { test, expect, describe } from "bun:test"
import { Effect, Layer, Option } from "effect"
import { CaffeinateService } from "./Caffeinate.ts"
import { ProcessService } from "./Process.ts"
import { ProcessError } from "../errors/index.ts"

// Helper to create a mock ProcessService
const mockProcessService = (responses: Record<string, string | Error>) =>
  Layer.succeed(ProcessService, {
    exec: (args: string[]) => {
      const key = args.join(" ")
      for (const [pattern, response] of Object.entries(responses)) {
        if (key.includes(pattern)) {
          if (response instanceof Error) {
            return Effect.fail(new ProcessError({ command: key, cause: response }))
          }
          return Effect.succeed(response)
        }
      }
      return Effect.fail(new ProcessError({ command: key, cause: new Error("unexpected command") }))
    },
    spawnDetached: (_args: string[]) => Effect.succeed(12345),
  } as any)

const runWithMock = <A, E>(
  responses: Record<string, string | Error>,
  effect: Effect.Effect<A, E, CaffeinateService>,
) => {
  const testLayer = CaffeinateService.DefaultWithoutDependencies.pipe(
    Layer.provide(mockProcessService(responses)),
  )
  return Effect.runPromise(Effect.provide(effect, testLayer))
}

describe("CaffeinateService.detect", () => {
  test("returns None when no caffeinate is running", async () => {
    const result = await runWithMock(
      { pgrep: new Error("no match") },
      Effect.gen(function* () {
        const svc = yield* CaffeinateService
        return yield* svc.detect()
      }),
    )
    expect(Option.isNone(result)).toBe(true)
  })

  test("returns info when caffeinate is running (indefinite)", async () => {
    const result = await runWithMock(
      {
        pgrep: "42\n",
        ps: "42 Mon Apr  6 10:00:00 2026 caffeinate -imsu\n",
      },
      Effect.gen(function* () {
        const svc = yield* CaffeinateService
        return yield* svc.detect()
      }),
    )
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.pid).toBe(42)
      expect(result.value.flags).toBe("-imsu")
      expect(result.value.duration).toBeNull()
    }
  })

  test("returns info with duration when caffeinate has -t flag", async () => {
    const result = await runWithMock(
      {
        pgrep: "42\n",
        ps: "42 Mon Apr  6 10:00:00 2026 caffeinate -imsu -t 1800\n",
      },
      Effect.gen(function* () {
        const svc = yield* CaffeinateService
        return yield* svc.detect()
      }),
    )
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.pid).toBe(42)
      expect(result.value.flags).toBe("-imsu")
      expect(result.value.duration).toBe(1800)
    }
  })

  test("returns empty flags when caffeinate has no mode flags", async () => {
    const result = await runWithMock(
      {
        pgrep: "42\n",
        ps: "42 Mon Apr  6 10:00:00 2026 caffeinate -t 1800\n",
      },
      Effect.gen(function* () {
        const svc = yield* CaffeinateService
        return yield* svc.detect()
      }),
    )
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.flags).toBe("")
      expect(result.value.duration).toBe(1800)
    }
  })

  test("names the watched process from its executable", async () => {
    const result = await runWithMock(
      {
        pgrep: "42\n",
        "comm=": "/Applications/Cursor.app/Contents/MacOS/Cursor\n",
        ps: "42 Mon Apr  6 10:00:00 2026 caffeinate -is -w 4242\n",
      },
      Effect.gen(function* () {
        const svc = yield* CaffeinateService
        return yield* svc.detect()
      }),
    )
    expect(Option.getOrThrow(result).watching).toEqual({ pid: 4242, name: "Cursor" })
    expect(Option.getOrThrow(result).flags).toBe("-is")
  })

  test("falls back to the PID when the watched process can't be looked up", async () => {
    const result = await runWithMock(
      {
        pgrep: "42\n",
        "comm=": new Error("gone"),
        ps: "42 Mon Apr  6 10:00:00 2026 caffeinate -is -w 4242 -t 600\n",
      },
      Effect.gen(function* () {
        const svc = yield* CaffeinateService
        return yield* svc.detect()
      }),
    )
    expect(Option.getOrThrow(result).watching).toEqual({ pid: 4242, name: "PID 4242" })
    expect(Option.getOrThrow(result).duration).toBe(600)
  })

  test("a session without -w watches nothing", async () => {
    const result = await runWithMock(
      { pgrep: "42\n", ps: "42 Mon Apr  6 10:00:00 2026 caffeinate -is\n" },
      Effect.gen(function* () {
        const svc = yield* CaffeinateService
        return yield* svc.detect()
      }),
    )
    expect(Option.getOrThrow(result).watching).toBeNull()
  })
})

describe("CaffeinateService.processes", () => {
  test("parses the process table", async () => {
    const result = await runWithMock(
      { "ps -axo": "  1     0 /sbin/launchd\n60100     1 /Applications/Cursor.app/Contents/MacOS/Cursor\n" },
      Effect.gen(function* () {
        const svc = yield* CaffeinateService
        return yield* svc.processes()
      }),
    )
    expect(result).toEqual([
      { pid: 1, ppid: 0, exe: "/sbin/launchd" },
      { pid: 60100, ppid: 1, exe: "/Applications/Cursor.app/Contents/MacOS/Cursor" },
    ])
  })
})

describe("CaffeinateService.start", () => {
  test("spawns caffeinate without -t for indefinite", async () => {
    let spawnedArgs: string[] = []
    const testLayer = CaffeinateService.DefaultWithoutDependencies.pipe(
      Layer.provide(
        Layer.succeed(ProcessService, {
          exec: (args: string[]) => {
            if (args.join(" ").includes("pgrep")) return Effect.fail(new ProcessError({ command: "", cause: "" }))
            if (args.join(" ").includes("ps")) return Effect.succeed("12345 Mon Apr  6 10:00:00 2026 caffeinate -imsu\n")
            return Effect.succeed("")
          },
          spawnDetached: (args: string[]) => {
            spawnedArgs = args
            return Effect.succeed(12345)
          },
        } as any),
      ),
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* CaffeinateService
        return yield* svc.start({ flags: "-is" })
      }).pipe(Effect.provide(testLayer)),
    )

    expect(spawnedArgs).toEqual(["caffeinate", "-is"])
    expect(result.pid).toBe(12345)
  })

  test("spawns caffeinate with -t for timed session", async () => {
    let spawnedArgs: string[] = []
    const testLayer = CaffeinateService.DefaultWithoutDependencies.pipe(
      Layer.provide(
        Layer.succeed(ProcessService, {
          exec: (args: string[]) => {
            if (args.join(" ").includes("pgrep")) return Effect.fail(new ProcessError({ command: "", cause: "" }))
            if (args.join(" ").includes("ps")) return Effect.succeed("12345 Mon Apr  6 10:00:00 2026 caffeinate -imsu -t 1800\n")
            return Effect.succeed("")
          },
          spawnDetached: (args: string[]) => {
            spawnedArgs = args
            return Effect.succeed(12345)
          },
        } as any),
      ),
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* CaffeinateService
        return yield* svc.start({ flags: "-is", duration: 1800 })
      }).pipe(Effect.provide(testLayer)),
    )

    expect(spawnedArgs).toEqual(["caffeinate", "-is", "-t", "1800"])
    expect(result.duration).toBe(1800)
  })

  test("spawns caffeinate with -w before -t for a watched session", async () => {
    let spawnedArgs: string[] = []
    const testLayer = CaffeinateService.DefaultWithoutDependencies.pipe(
      Layer.provide(
        Layer.succeed(ProcessService, {
          exec: (args: string[]) => Effect.fail(new ProcessError({ command: args.join(" "), cause: "" })),
          spawnDetached: (args: string[]) => {
            spawnedArgs = args
            return Effect.succeed(12345)
          },
        } as any),
      ),
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* CaffeinateService
        return yield* svc.start({ flags: "-is", duration: 600, watch: { pid: 4242, name: "Cursor" } })
      }).pipe(Effect.provide(testLayer)),
    )

    expect(spawnedArgs).toEqual(["caffeinate", "-is", "-w", "4242", "-t", "600"])
    expect(result.watching).toEqual({ pid: 4242, name: "Cursor" })
  })

  test("spawns caffeinate with custom flags", async () => {
    let spawnedArgs: string[] = []
    const testLayer = CaffeinateService.DefaultWithoutDependencies.pipe(
      Layer.provide(
        Layer.succeed(ProcessService, {
          exec: (args: string[]) => {
            if (args.join(" ").includes("pgrep")) return Effect.fail(new ProcessError({ command: "", cause: "" }))
            if (args.join(" ").includes("ps")) return Effect.succeed("12345 Mon Apr  6 10:00:00 2026 caffeinate -dimsu\n")
            return Effect.succeed("")
          },
          spawnDetached: (args: string[]) => {
            spawnedArgs = args
            return Effect.succeed(12345)
          },
        } as any),
      ),
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* CaffeinateService
        return yield* svc.start({ flags: "-dimsu" })
      }).pipe(Effect.provide(testLayer)),
    )

    expect(spawnedArgs).toEqual(["caffeinate", "-dimsu"])
    expect(result.pid).toBe(12345)
  })

  test("spawns caffeinate with no flags when empty string", async () => {
    let spawnedArgs: string[] = []
    const testLayer = CaffeinateService.DefaultWithoutDependencies.pipe(
      Layer.provide(
        Layer.succeed(ProcessService, {
          exec: (args: string[]) => {
            if (args.join(" ").includes("pgrep")) return Effect.fail(new ProcessError({ command: "", cause: "" }))
            if (args.join(" ").includes("ps")) return Effect.succeed("12345 Mon Apr  6 10:00:00 2026 caffeinate\n")
            return Effect.succeed("")
          },
          spawnDetached: (args: string[]) => {
            spawnedArgs = args
            return Effect.succeed(12345)
          },
        } as any),
      ),
    )

    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* CaffeinateService
        return yield* svc.start({ flags: "" })
      }).pipe(Effect.provide(testLayer)),
    )

    expect(spawnedArgs).toEqual(["caffeinate"])
  })
})

describe("CaffeinateService.kill", () => {
  test("kills caffeinate when running", async () => {
    let killedWith: string[] = []
    const testLayer = CaffeinateService.DefaultWithoutDependencies.pipe(
      Layer.provide(
        Layer.succeed(ProcessService, {
          exec: (args: string[]) => {
            if (args.join(" ").includes("pkill")) {
              killedWith = args
              return Effect.succeed("")
            }
            return Effect.succeed("")
          },
          spawnDetached: () => Effect.succeed(0),
        } as any),
      ),
    )

    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* CaffeinateService
        yield* svc.kill()
      }).pipe(Effect.provide(testLayer)),
    )

    expect(killedWith).toEqual(["pkill", "-x", "caffeinate"])
  })
})
