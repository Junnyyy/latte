import { Console, Effect, Option } from "effect"
import { CaffeinateService } from "../services/Caffeinate.ts"
import { fail } from "../utils/exit.ts"
import { bold, dim, green, yellow } from "../utils/format.ts"
import { parseDuration, formatDuration } from "../utils/duration.ts"
import { promptYesNo } from "../utils/prompt.ts"
import { describeFlags, PRESET_LID_NOTE, type Selection } from "../utils/flags.ts"
import { resolveFlags } from "../utils/resolveFlags.ts"

export interface StartRequest {
  selection: Selection
  /** A duration such as "30m". Without one the session is indefinite. */
  duration?: string
}

export const startHandler = ({ selection, duration }: StartRequest) =>
  Effect.gen(function* () {
    const seconds = duration === undefined ? undefined : yield* parseDuration(duration)
    const svc = yield* CaffeinateService
    const existing = yield* svc.detect()

    if (Option.isSome(existing)) {
      const { startTime, duration: running } = existing.value
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
      const runningLabel = running !== null ? formatDuration(running) : "indefinite"

      yield* Console.log(
        `${yellow("⚠")} Caffeinate is already running (${formatDuration(elapsed)}, ${runningLabel})`,
      )

      const next = seconds !== undefined ? `${formatDuration(seconds)} timer` : "indefinite"
      const confirmed = yield* Effect.promise(() => promptYesNo(`Kill existing and start ${next}?`))
      if (!confirmed) {
        yield* Console.log("Cancelled.")
        return
      }

      yield* svc.kill().pipe(Effect.catchAll(() => Effect.void))
    }

    const flags = resolveFlags(selection)
    yield* svc.start({ flags, duration: seconds })
    const length = seconds !== undefined ? ` for ${formatDuration(seconds)}` : ""
    yield* Console.log(`${bold("☕")} ${green("On")}${length} — ${describeFlags(flags)}`)
    if (selection.kind === "preset") yield* Console.log(dim(PRESET_LID_NOTE))
  }).pipe(
    Effect.catchAll((e) =>
      e._tag === "DurationParseError" ? fail(e.message) : fail(`Error: ${e.message}`),
    ),
  )
