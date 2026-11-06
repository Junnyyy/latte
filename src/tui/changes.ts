import { Effect } from "effect"
import type { CaffeinateInfo, WatchResult } from "../types/index.ts"
import type { StartSpec } from "../services/Caffeinate.ts"
import type { WatchTarget } from "../utils/watch.ts"
import { flagSetToString, parseFlagString, sameFlags, type Flag } from "../utils/flags.ts"
import { parseDuration } from "../utils/duration.ts"

export type Change =
  | { kind: "on" }
  | { kind: "timed"; seconds: number }
  | { kind: "while"; target: WatchTarget }
  | { kind: "off" }

export type Apply = { kind: "apply" }

export type Refused = { kind: "refused"; reason: string }

export type Request = Change | Refused

export type Plan =
  | { kind: "start"; spec: StartSpec }
  | { kind: "stop" }
  | { kind: "nothing" }

export interface Situation {
  session: CaffeinateInfo | null
  flags: ReadonlySet<Flag>
  now: Date
}

const nothing: Plan = { kind: "nothing" }

export const planChange = (change: Change | Apply, { session, flags, now }: Situation): Plan => {
  const start = (end: Omit<StartSpec, "flags">): Plan =>
    ({ kind: "start", spec: { flags: flagSetToString(flags), ...end } })

  switch (change.kind) {
    case "on":
      return session && session.duration === null && session.watching === null && runsWith(session, flags)
        ? nothing
        : start({})
    case "timed":
      return start({ duration: change.seconds })
    case "while":
      return start({ watch: change.target })
    case "off":
      return session ? { kind: "stop" } : nothing
    case "apply": {
      if (!session || runsWith(session, flags)) return nothing
      const left = remainingSeconds(session, now)
      if (left === 0) return nothing
      return start({
        ...(left !== null && { duration: left }),
        ...(session.watching && { watch: session.watching }),
      })
    }
  }
}

export const timedRequest = (value: string): Request => {
  const parsed = Effect.runSyncExit(parseDuration(value))
  return parsed._tag === "Success"
    ? { kind: "timed", seconds: parsed.value }
    : { kind: "refused", reason: `"${value}" is not a valid duration (use e.g. 30m, 2h, 90s)` }
}

export const whileRequest = (result: WatchResult): Request =>
  result.ok ? { kind: "while", target: result.target } : { kind: "refused", reason: result.error }

export const elapsedSeconds = (info: CaffeinateInfo, at: Date): number =>
  Math.max(0, Math.floor((at.getTime() - info.startTime.getTime()) / 1000))

export const remainingSeconds = (info: CaffeinateInfo, at: Date): number | null =>
  info.duration === null ? null : Math.max(0, info.duration - elapsedSeconds(info, at))

const runsWith = (info: CaffeinateInfo, flags: ReadonlySet<Flag>): boolean => {
  const running = parseFlagString(info.flags)
  return running !== null && sameFlags(running, flags)
}
