import { Console, Effect, Option } from "effect"
import { CaffeinateService } from "../services/Caffeinate.ts"
import { fail } from "../utils/exit.ts"
import { bold, green, yellow } from "../utils/format.ts"
import { formatDuration } from "../utils/duration.ts"

export const onHandler = () =>
  Effect.gen(function* () {
    const svc = yield* CaffeinateService
    const existing = yield* svc.detect()

    if (Option.isSome(existing)) {
      const { startTime, duration } = existing.value
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
      const durationStr = duration !== null ? formatDuration(duration) : "indefinite"

      yield* Console.log(
        `${yellow("⚠")} Caffeinate is already running (${formatDuration(elapsed)}, ${durationStr})`,
      )

      // Prompt for confirmation
      const confirmed = yield* Effect.promise(() => promptYesNo("Kill existing and start indefinite?"))
      if (!confirmed) {
        yield* Console.log("Cancelled.")
        return
      }

      yield* svc.kill().pipe(Effect.catchAll(() => Effect.void))
    }

    yield* svc.start()
    yield* Console.log(`${bold("☕")} ${green("Caffeinate started")} — preventing sleep`)
  }).pipe(
    Effect.catchAll((e) => fail(`Error: ${"message" in e ? e.message : String(e)}`)),
  )

function promptYesNo(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    process.stdout.write(`${question} (y/n) `)
    process.stdin.setRawMode?.(true)
    process.stdin.resume()
    process.stdin.setEncoding("utf8")

    const onData = (data: string) => {
      process.stdin.removeListener("data", onData)
      process.stdin.setRawMode?.(false)
      process.stdin.pause()
      process.stdout.write(`${data}\n`)
      resolve(data.toLowerCase() === "y")
    }

    process.stdin.on("data", onData)
  })
}
