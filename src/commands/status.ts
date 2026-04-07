import { Console, Effect, Option } from "effect"
import { CaffeinateService } from "../services/Caffeinate.ts"
import { fail } from "../utils/exit.ts"
import { bold, green, dim } from "../utils/format.ts"
import { describeFlags } from "../utils/flags.ts"
import { formatDuration } from "../utils/duration.ts"

export const statusHandler = () =>
  Effect.gen(function* () {
    const svc = yield* CaffeinateService
    const info = yield* svc.detect()

    if (Option.isNone(info)) {
      yield* Console.log(`${bold("☕")} No caffeinate running`)
      return
    }

    const { flags, startTime, duration, remaining } = info.value
    const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)

    yield* Console.log(`${bold("☕")} ${green("Active")} — preventing sleep`)
    yield* Console.log(`   Modes: ${describeFlags(flags)}`)
    yield* Console.log(`   Running for: ${formatDuration(elapsed)}`)

    if (duration !== null && remaining !== null) {
      yield* Console.log(`   Remaining: ${formatDuration(remaining)}`)
    } else {
      yield* Console.log(`   Duration: ${dim("indefinite")}`)
    }
  }).pipe(
    Effect.catchAll((e: unknown) => fail(`Error: ${e instanceof Error ? e.message : String(e)}`)),
  )
