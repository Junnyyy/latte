#!/usr/bin/env bun
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { ValidationError } from "@effect/cli"
import { Effect, Either, Layer } from "effect"
import { cli } from "./cli.ts"
import { startHandler } from "./commands/start.ts"
import { CaffeinateService } from "./services/Caffeinate.ts"
import { ProcessService } from "./services/Process.ts"
import { fail } from "./utils/exit.ts"
import { parseStartArgs } from "./utils/resolveFlags.ts"

const AppLayer = CaffeinateService.Default.pipe(
  Layer.provideMerge(ProcessService.Default),
)

const MainLayer = Layer.merge(AppLayer, BunContext.layer)

// Pre-parse: if the first user arg looks like a duration (e.g. "30m", "2h", "90s"),
// route directly to startHandler instead of @effect/cli (which uses subcommands).
const userArgs = process.argv.slice(2)
const durationPattern = /^\d+(s|m|h)$/i
const firstArg = userArgs[0]

const program = firstArg && durationPattern.test(firstArg)
  ? Either.match(parseStartArgs(userArgs.slice(1)), {
      onLeft: (e) => fail(e.message),
      onRight: ({ selection, watch }) =>
        startHandler({ selection, duration: firstArg, watch }).pipe(Effect.provide(MainLayer)),
    })
  : cli(process.argv).pipe(
      Effect.provide(MainLayer),
      Effect.catchIf(
        ValidationError.isValidationError,
        (e) =>
          ValidationError.isHelpRequested(e)
            ? Effect.void
            : Effect.sync(() => { process.exitCode = 1 }),
      ),
    )

program.pipe(BunRuntime.runMain)
