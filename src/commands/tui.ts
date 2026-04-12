import React from "react"
import { render } from "ink"
import { Effect, Runtime, Option } from "effect"
import { CaffeinateService } from "../services/Caffeinate.ts"
import { App } from "../tui/App.tsx"
import type { CaffeinateInfo, TuiResult } from "../types/index.ts"

export const tuiHandler = () =>
  Effect.gen(function* () {
    const svc = yield* CaffeinateService
    const initialInfo = yield* svc.detect().pipe(
      Effect.map(Option.getOrNull),
    )
    const rt = yield* Effect.runtime<CaffeinateService>()

    const onStart = async (duration?: number, flags?: string): Promise<TuiResult> => {
      const program = Effect.gen(function* () {
        const s = yield* CaffeinateService
        yield* s.kill().pipe(Effect.catchAll(() => Effect.void))
        const info = yield* s.start(duration, flags)
        return { ok: true as const, info }
      }).pipe(
        Effect.catchAll((e): Effect.Effect<TuiResult> =>
          Effect.succeed({
            ok: false,
            error: `Failed to start: ${"message" in e ? e.message : String(e)}`,
          }),
        ),
      )
      return await Runtime.runPromise(rt)(program)
    }

    const onStop = async (): Promise<TuiResult> => {
      const program = Effect.gen(function* () {
        const s = yield* CaffeinateService
        yield* s.kill()
        return { ok: true as const, info: null }
      }).pipe(
        Effect.catchAll((e): Effect.Effect<TuiResult> =>
          Effect.succeed({
            ok: false,
            error: `Failed to stop: ${"message" in e ? e.message : String(e)}`,
          }),
        ),
      )
      return await Runtime.runPromise(rt)(program)
    }

    const onDetect = async (): Promise<CaffeinateInfo | null> => {
      const program = Effect.gen(function* () {
        const s = yield* CaffeinateService
        return yield* s.detect().pipe(Effect.map(Option.getOrNull))
      }).pipe(Effect.catchAll(() => Effect.succeed(null)))
      return await Runtime.runPromise(rt)(program)
    }

    // Render Ink TUI to stderr (same as WT) so stdout stays clean
    yield* Effect.async<void, never>((resume) => {
      try {
        const { waitUntilExit } = render(
          React.createElement(App, { initialInfo, onStart, onStop, onDetect }),
          { stdout: process.stderr, stdin: process.stdin, stderr: process.stderr, patchConsole: false },
        )

        waitUntilExit().then(
          () => resume(Effect.void),
          () => resume(Effect.void),
        )
      } catch (err) {
        process.stderr.write(`TUI error: ${err}\n`)
        resume(Effect.void)
      }
    })
  })
