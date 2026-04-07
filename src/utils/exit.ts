import { Console, Effect } from "effect"

/** Log error to stderr and set exit code to 1. */
export const fail = (msg: string) =>
  Console.error(msg).pipe(Effect.andThen(Effect.sync(() => { process.exitCode = 1 })))
