import { Effect, Option } from "effect"
import { CaffeinateSpawnError, NoCaffeinateError, ProcessError } from "../errors/index.ts"
import { ProcessService } from "./Process.ts"
import type { CaffeinateInfo } from "../types/index.ts"
import { nameOf, parsePsTable, type ProcessEntry, type WatchTarget } from "../utils/watch.ts"

export interface StartSpec {
  flags: string
  /** Seconds until caffeinate exits on its own (-t). */
  duration?: number
  /** caffeinate exits when this process exits (-w). */
  watch?: WatchTarget
}

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

        const { watchPid, ...info } = parsePsLine(line)
        if (watchPid === null) return Option.some({ ...info, watching: null })

        const exe = yield* proc.exec(["ps", "-o", "comm=", "-p", String(watchPid)]).pipe(
          Effect.map((out) => out.trim()),
          Effect.catchAll(() => Effect.succeed("")),
        )
        const name = exe ? nameOf(exe) : `PID ${watchPid}`
        return Option.some({ ...info, watching: { pid: watchPid, name } })
      })

    const processes = (): Effect.Effect<ProcessEntry[], ProcessError> =>
      proc.exec(["ps", "-axo", "pid=,ppid=,comm="]).pipe(Effect.map(parsePsTable))

    const start = ({ flags, duration, watch }: StartSpec): Effect.Effect<CaffeinateInfo, CaffeinateSpawnError> =>
      Effect.gen(function* () {
        const args = flags ? ["caffeinate", flags] : ["caffeinate"]
        if (watch !== undefined) {
          args.push("-w", String(watch.pid))
        }
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
          flags,
          startTime: new Date(),
          duration: duration ?? null,
          remaining: duration ?? null,
          watching: watch ?? null,
        }
      })

    const kill = (): Effect.Effect<void, NoCaffeinateError> =>
      proc.exec(["pkill", "-x", "caffeinate"]).pipe(
        Effect.map(() => undefined),
        Effect.catchAll(() => Effect.fail(new NoCaffeinateError())),
      )

    return { detect, start, kill, processes }
  }),
  dependencies: [ProcessService.Default],
}) {}

/** Parse a ps output line into CaffeinateInfo, with the raw -w PID in place of its name. */
function parsePsLine(line: string): Omit<CaffeinateInfo, "watching"> & { watchPid: number | null } {
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

  const watchMatch = argsStr.match(/-w\s+(\d+)/)
  const watchPid = watchMatch ? parseInt(watchMatch[1]!, 10) : null

  // Compute remaining time
  let remaining: number | null = null
  if (duration !== null) {
    const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
    remaining = Math.max(0, duration - elapsed)
  }

  return { pid, flags, startTime, duration, remaining, watchPid }
}
