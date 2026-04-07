import { Console, Effect, Option } from "effect"
import { CaffeinateService } from "../services/Caffeinate.ts"
import { fail } from "../utils/exit.ts"
import { bold, green, dim } from "../utils/format.ts"

export const offHandler = () =>
  Effect.gen(function* () {
    const svc = yield* CaffeinateService
    const existing = yield* svc.detect()

    if (Option.isNone(existing)) {
      yield* Console.log(`${bold("☕")} ${dim("No caffeinate running")}`)
      return
    }

    yield* svc.kill().pipe(Effect.catchAll(() => Effect.void))
    yield* Console.log(`${bold("☕")} ${green("Caffeinate stopped")}`)
  }).pipe(
    Effect.catchAll((e: unknown) => fail(`Error: ${e instanceof Error ? e.message : String(e)}`)),
  )
