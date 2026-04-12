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
        return yield* svc.start()
      }).pipe(Effect.provide(testLayer)),
    )

    expect(spawnedArgs).toEqual(["caffeinate", "-imsu"])
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
        return yield* svc.start(1800)
      }).pipe(Effect.provide(testLayer)),
    )

    expect(spawnedArgs).toEqual(["caffeinate", "-imsu", "-t", "1800"])
    expect(result.duration).toBe(1800)
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
        return yield* svc.start(undefined, "-dimsu")
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
        return yield* svc.start(undefined, "")
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
