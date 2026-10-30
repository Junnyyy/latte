import { test, expect, spyOn } from "bun:test"
import { Effect, Layer } from "effect"
import { CaffeinateService } from "../services/Caffeinate.ts"
import { ProcessService } from "../services/Process.ts"
import { statusHandler } from "./status.ts"

const statusLines = async (psArgs: string) => {
  const processLayer = Layer.succeed(ProcessService, {
    exec: (args: string[]) =>
      Effect.succeed(args[0] === "pgrep" ? "42\n" : `42 ${new Date().toString().slice(0, 24)} ${psArgs}\n`),
    spawnDetached: () => Effect.die("status must not spawn"),
  } as any)
  const layer = CaffeinateService.DefaultWithoutDependencies.pipe(Layer.provide(processLayer))

  const log = spyOn(console, "log").mockImplementation(() => {})
  try {
    await Effect.runPromise(statusHandler().pipe(Effect.provide(layer)))
    return log.mock.calls.map((args) => args.join(" ").replace(/\x1b\[[0-9;]*m/g, ""))
  } finally {
    log.mockRestore()
  }
}

test("status headlines a preset session by its summary", async () => {
  const lines = await statusLines("caffeinate -dis")
  expect(lines[0]).toBe("☕ Active — Mac and screen stay awake")
  expect(lines[1]).toStartWith("   Running for:")
  expect(lines[2]).toBe("   Duration: indefinite")
  expect(lines).toHaveLength(3)
})

test("status names the modes of a custom session", async () => {
  const lines = await statusLines("caffeinate -dm -t 1800")
  expect(lines[0]).toBe("☕ Active — custom flags -dm (display, disk)")
  expect(lines[2]).toStartWith("   Remaining:")
})
