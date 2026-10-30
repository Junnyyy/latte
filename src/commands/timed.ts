import { Console, Effect, Option } from "effect"
import { CaffeinateService } from "../services/Caffeinate.ts"
import { fail } from "../utils/exit.ts"
import { bold, green, yellow } from "../utils/format.ts"
import { parseDuration, formatDuration } from "../utils/duration.ts"
import { promptYesNo } from "../utils/prompt.ts"
import type { Selection } from "../utils/flags.ts"
import { resolveFlags } from "../utils/resolveFlags.ts"

export const timedHandler = (durationStr: string, selection: Selection) =>
  Effect.gen(function* () {
    const seconds = yield* parseDuration(durationStr)
    const svc = yield* CaffeinateService
    const existing = yield* svc.detect()

    if (Option.isSome(existing)) {
      const { startTime, duration } = existing.value
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
      const durationLabel = duration !== null ? formatDuration(duration) : "indefinite"

      yield* Console.log(
        `${yellow("⚠")} Caffeinate is already running (${formatDuration(elapsed)}, ${durationLabel})`,
      )

      const confirmed = yield* Effect.promise(() => promptYesNo(`Kill existing and start ${formatDuration(seconds)} timer?`))
      if (!confirmed) {
        yield* Console.log("Cancelled.")
        return
      }

      yield* svc.kill().pipe(Effect.catchAll(() => Effect.void))
    }

    const flags = resolveFlags(selection)
    yield* svc.start(seconds, flags)
    yield* Console.log(
      `${bold("☕")} ${green("Caffeinate started")} — preventing sleep for ${formatDuration(seconds)}`,
    )
  }).pipe(
    Effect.catchAll((e) => {
      if ("_tag" in e && e._tag === "DurationParseError") {
        return fail(`${e.message}`)
      }
      return fail(`Error: ${"message" in e ? e.message : String(e)}`)
    }),
  )
