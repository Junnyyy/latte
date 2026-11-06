import { test, expect, describe } from "bun:test"
import type { CaffeinateInfo } from "../types/index.ts"
import type { StartSpec } from "../services/Caffeinate.ts"
import type { Flag } from "../utils/flags.ts"
import { planChange, timedRequest, type Apply, type Change, type Plan } from "./changes.ts"

const now = new Date("2026-11-05T12:00:00Z")
const secondsAgo = (seconds: number) => new Date(now.getTime() - seconds * 1000)
const session = (fields: Partial<CaffeinateInfo> = {}): CaffeinateInfo => ({
  pid: 42,
  flags: "-is",
  startTime: secondsAgo(60),
  duration: null,
  remaining: null,
  watching: null,
  ...fields,
})
const awake = new Set<Flag>(["i", "s"])
const screen = new Set<Flag>(["d", "i", "s"])
const cursor = { pid: 123, name: "Cursor" }
const slack = { pid: 7, name: "Slack" }

const on: Change = { kind: "on" }
const off: Change = { kind: "off" }
const apply: Apply = { kind: "apply" }
const nothing: Plan = { kind: "nothing" }
const starts = (spec: StartSpec): Plan => ({ kind: "start", spec })

const rows: [string, Change | Apply, CaffeinateInfo | null, ReadonlySet<Flag>, Plan][] = [
  ["on with no session starts an indefinite one", on, null, awake, starts({ flags: "-is" })],
  ["on over an indefinite session with the same flags does nothing", on, session(), awake, nothing],
  ["on reads the running flags in any order", on, session({ flags: "-si" }), awake, nothing],
  ["on over an indefinite session with other flags restarts it", on, session(), screen, starts({ flags: "-dis" })],
  ["on over a timed session replaces it with an indefinite one", on, session({ duration: 1800 }), awake, starts({ flags: "-is" })],
  ["on over a watched session replaces it with an indefinite one", on, session({ watching: cursor }), awake, starts({ flags: "-is" })],
  ["timed with no session starts for that long", { kind: "timed", seconds: 90 }, null, awake, starts({ flags: "-is", duration: 90 })],
  ["timed replaces a running session", { kind: "timed", seconds: 90 }, session({ duration: 90 }), awake, starts({ flags: "-is", duration: 90 })],
  ["while replaces a session that watches the same process", { kind: "while", target: cursor }, session({ watching: cursor }), awake, starts({ flags: "-is", watch: cursor })],
  ["off stops a running session", off, session(), awake, { kind: "stop" }],
  ["off with no session does nothing", off, null, awake, nothing],
  ["apply with no session does nothing", apply, null, screen, nothing],
  ["apply over a session that has the flags does nothing", apply, session(), awake, nothing],
  ["apply restarts an indefinite session with the flags", apply, session(), screen, starts({ flags: "-dis" })],
  ["apply restarts a timed session with the seconds left", apply, session({ duration: 1800 }), screen, starts({ flags: "-dis", duration: 1740 })],
  ["apply restarts a watched session on the same process", apply, session({ watching: slack }), screen, starts({ flags: "-dis", watch: slack })],
  ["apply keeps both the seconds left and the watched process", apply, session({ duration: 600, watching: slack }), screen, starts({ flags: "-dis", duration: 540, watch: slack })],
  ["apply does not restart a timed session with no time left", apply, session({ duration: 60 }), screen, nothing],
]

describe("planChange", () => {
  test.each(rows)("%s", (_name, change, running, flags, plan) => {
    expect(planChange(change, { session: running, flags, now })).toEqual(plan)
  })
})

describe("timedRequest", () => {
  test("reads a duration as seconds", () => {
    expect(timedRequest("90s")).toEqual({ kind: "timed", seconds: 90 })
    expect(timedRequest("2h")).toEqual({ kind: "timed", seconds: 7200 })
  })

  test("refuses a value that is not a duration", () => {
    expect(timedRequest("abc")).toEqual({ kind: "refused", reason: '"abc" is not a valid duration (use e.g. 30m, 2h, 90s)' })
  })
})
