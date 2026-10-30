import type { WatchTarget } from "../utils/watch.ts"

export interface CaffeinateInfo {
  pid: number
  flags: string
  startTime: Date
  duration: number | null
  remaining: number | null
  /** The process whose exit ends the session (caffeinate -w). */
  watching: WatchTarget | null
}

export type WatchResult =
  | { ok: true; target: WatchTarget }
  | { ok: false; error: string }

export type TuiResult =
  | { ok: true; info: CaffeinateInfo | null }
  | { ok: false; error: string }
