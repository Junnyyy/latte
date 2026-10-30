import { Console, Effect, Option } from "effect"
import { CaffeinateService } from "../services/Caffeinate.ts"
import { WatchTargetError } from "../errors/index.ts"
import { fail } from "../utils/exit.ts"
import { bold, dim, green, yellow } from "../utils/format.ts"
import { describeEnd, parseDuration, formatDuration } from "../utils/duration.ts"
import { promptYesNo } from "../utils/prompt.ts"
import { describeFlags, PRESET_LID_NOTE, type Selection } from "../utils/flags.ts"
import { resolveFlags } from "../utils/resolveFlags.ts"
import { resolveWatchTarget } from "../utils/watch.ts"

export interface StartRequest {
  selection: Selection
  /** A duration such as "30m". */
  duration?: string
  /** An app name or PID whose exit ends the session, as given to --while. */
  watch?: string
}

export const startHandler = ({ selection, duration, watch }: StartRequest) =>
  Effect.gen(function* () {
    const seconds = duration === undefined ? undefined : yield* parseDuration(duration)
    const svc = yield* CaffeinateService

    // Resolve before touching a running session, so a typo leaves it alone.
    const target = watch === undefined ? undefined : yield* svc.processes().pipe(
      Effect.mapError(() => new WatchTargetError({ message: `Couldn't list running processes to find ${watch}.` })),
      Effect.flatMap((procs) => resolveWatchTarget(watch, procs, process.pid)),
    )
    const end = describeEnd(seconds ?? null, target ?? null)

    const existing = yield* svc.detect()
    if (Option.isSome(existing)) {
      const { startTime, duration: running, watching } = existing.value
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
      const runningEnd = describeEnd(running, watching) ?? "indefinite"

      yield* Console.log(
        `${yellow("⚠")} Caffeinate is already running (${formatDuration(elapsed)}, ${runningEnd})`,
      )

      const confirmed = yield* Effect.promise(() =>
        promptYesNo(`Kill existing and start a new session (${end ?? "indefinite"})?`),
      )
      if (!confirmed) {
        yield* Console.log("Cancelled.")
        return
      }

      yield* svc.kill().pipe(Effect.catchAll(() => Effect.void))
    }

    const flags = resolveFlags(selection)
    yield* svc.start({ flags, duration: seconds, watch: target })
    const headline = end === null ? "" : seconds !== undefined ? ` for ${end}` : ` ${end}`
    yield* Console.log(`${bold("☕")} ${green("On")}${headline} — ${describeFlags(flags)}`)
    if (selection.kind === "preset") yield* Console.log(dim(PRESET_LID_NOTE))
  }).pipe(
    Effect.catchAll((e) =>
      e._tag === "DurationParseError" || e._tag === "WatchTargetError"
        ? fail(e.message)
        : fail(`Error: ${e.message}`),
    ),
  )
