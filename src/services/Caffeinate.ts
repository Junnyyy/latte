import { Effect, Option } from "effect"
import { CaffeinateSpawnError, NoCaffeinateError } from "../errors/index.ts"
import { ProcessService } from "./Process.ts"
import type { CaffeinateInfo } from "../types/index.ts"

export class CaffeinateService extends Effect.Service<CaffeinateService>()("CaffeinateService", {
  effect: Effect.gen(function* () {
    const proc = yield* ProcessService

    const detect = (): Effect.Effect<Option.Option<CaffeinateInfo>> =>
      Effect.gen(function* () {
        // Find caffeinate PIDs
        const pgrepOutput = yield* proc.exec(["pgrep", "-x", "caffeinate"]).pipe(
          Effect.catchAll(() => Effect.succeed("")),
        )

        const pids = pgrepOutput.trim().split("\n").filter((l) => l.length > 0)
        if (pids.length === 0) return Option.none()

        const pid = parseInt(pids[0]!, 10)
        if (isNaN(pid)) return Option.none()

        // Get process details
        const psOutput = yield* proc.exec(["ps", "-o", "pid=,lstart=,args=", "-p", String(pid)]).pipe(
          Effect.catchAll(() => Effect.succeed("")),
        )

        const line = psOutput.trim()
        if (line.length === 0) return Option.none()

        return Option.some(parsePsLine(line))
      })

    const start = (duration?: number, flags?: string): Effect.Effect<CaffeinateInfo, CaffeinateSpawnError> =>
      Effect.gen(function* () {
        const flagStr = flags ?? "-imsu"
        const args = flagStr ? ["caffeinate", flagStr] : ["caffeinate"]
        if (duration !== undefined) {
          args.push("-t", String(duration))
        }

        const pid = yield* proc.spawnDetached(args).pipe(
          Effect.mapError((e) => new CaffeinateSpawnError({ message: "Failed to spawn caffeinate", cause: e })),
        )

        // Brief pause to let the process start, then detect to get full info
        yield* Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 100)))

        const info = yield* detect()
        if (Option.isSome(info)) {
          return info.value
        }

        // Fallback: construct info from what we know
        return {
          pid,
          flags: flagStr,
          startTime: new Date(),
          duration: duration ?? null,
          remaining: duration ?? null,
        }
      })

    const kill = (): Effect.Effect<void, NoCaffeinateError> =>
      proc.exec(["pkill", "-x", "caffeinate"]).pipe(
        Effect.map(() => undefined),
        Effect.catchAll(() => Effect.fail(new NoCaffeinateError())),
      )

    return { detect, start, kill }
  }),
  dependencies: [ProcessService.Default],
}) {}

/** Parse a ps output line into CaffeinateInfo. */
function parsePsLine(line: string): CaffeinateInfo {
  // ps -o pid=,lstart=,args= format:
  // "  42 Mon Apr  6 10:00:00 2026 caffeinate -imsu -t 1800"
  const trimmed = line.trim()

  // Extract PID (first number)
  const pidMatch = trimmed.match(/^(\d+)\s+/)
  const pid = pidMatch ? parseInt(pidMatch[1]!, 10) : 0

  // Extract start time — lstart format: "Mon Apr  6 10:00:00 2026"
  // It comes after the PID and before "caffeinate"
  const afterPid = trimmed.slice(pidMatch?.[0].length ?? 0)
  const caffeinateIdx = afterPid.indexOf("caffeinate")
  const lstartStr = caffeinateIdx > 0 ? afterPid.slice(0, caffeinateIdx).trim() : ""
  const startTime = lstartStr ? new Date(lstartStr) : new Date()

  // Extract flags — everything after "caffeinate"
  const argsStr = caffeinateIdx >= 0 ? afterPid.slice(caffeinateIdx) : ""
  const flagMatch = argsStr.match(/caffeinate\s+(-[dimsu]+)/)
  const flags = flagMatch ? flagMatch[1]! : ""

  // Extract -t duration if present
  const durationMatch = argsStr.match(/-t\s+(\d+)/)
  const duration = durationMatch ? parseInt(durationMatch[1]!, 10) : null

  // Compute remaining time
  let remaining: number | null = null
  if (duration !== null) {
    const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
    remaining = Math.max(0, duration - elapsed)
  }

  return { pid, flags, startTime, duration, remaining }
}
