export interface CaffeinateInfo {
  pid: number
  flags: string
  startTime: Date
  duration: number | null
  remaining: number | null
}

export type TuiAction =
  | { type: "start"; duration?: number }
  | { type: "stop" }

export type TuiResult =
  | { ok: true; info: CaffeinateInfo | null }
  | { ok: false; error: string }
