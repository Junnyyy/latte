import { test, expect, describe, beforeEach, afterEach, jest } from "bun:test"
import type { CaffeinateInfo, TuiResult, WatchResult } from "../types/index.ts"
import type { StartSpec } from "../services/Caffeinate.ts"
import type { Flag } from "../utils/flags.ts"
import { whileRequest, type Request } from "./changes.ts"
import { createSessionStore, type SessionIO, type Ticket } from "./sessionStore.ts"

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
const startedAs = (spec: StartSpec): TuiResult => ({
  ok: true,
  info: session({ flags: spec.flags, startTime: now, duration: spec.duration ?? null, watching: spec.watch ?? null }),
})
const cursor = { pid: 123, name: "Cursor" }
const boom: TuiResult = { ok: false, error: "Failed to start: boom" }

const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

const outcomeSoFar = (ticket: Ticket) =>
  Promise.race([ticket.done, flush().then(() => "pending" as const)])

const fakeIO = () => {
  const starts: StartSpec[] = []
  const startResults: ((result: TuiResult | Promise<never>) => void)[] = []
  const detectResults: ((info: CaffeinateInfo | null) => void)[] = []
  const io: SessionIO = {
    start: (spec) => {
      starts.push(spec)
      return new Promise((resolve) => startResults.push(resolve))
    },
    stop: async () => ({ ok: true, info: null }),
    detect: () => new Promise((resolve) => detectResults.push(resolve)),
    now: () => now,
  }
  return {
    io,
    starts,
    pendingDetects: () => detectResults.length,
    finishStart: async (result: TuiResult | Promise<never>) => {
      startResults.shift()!(result)
      await flush()
    },
    finishDetect: async (info: CaffeinateInfo | null) => {
      detectResults.shift()!(info)
      await flush()
    },
  }
}

const originalEnv = process.env.LATTE_FLAGS
beforeEach(() => {
  delete process.env.LATTE_FLAGS
})
afterEach(() => {
  if (originalEnv === undefined) delete process.env.LATTE_FLAGS
  else process.env.LATTE_FLAGS = originalEnv
})

describe("submit", () => {
  test("runs changes one at a time in submit order", async () => {
    const fake = fakeIO()
    const store = createSessionStore(fake.io, null)

    store.submit({ kind: "on" })
    store.submit({ kind: "timed", seconds: 90 })
    await flush()
    expect(fake.starts).toEqual([{ flags: "-is" }])

    await fake.finishStart(startedAs({ flags: "-is" }))
    expect(fake.starts).toEqual([{ flags: "-is" }, { flags: "-is", duration: 90 }])
  })

  test("decides each change from the session as it is when the change runs", async () => {
    const fake = fakeIO()
    const store = createSessionStore(fake.io, null)

    store.submit({ kind: "on" })
    const second = store.submit({ kind: "on" })
    await flush()
    await fake.finishStart(startedAs({ flags: "-is" }))

    expect(await second.done).toEqual({ kind: "unchanged" })
    expect(fake.starts).toEqual([{ flags: "-is" }])
  })

  test("a pending request holds its place ahead of later changes", async () => {
    const fake = fakeIO()
    const store = createSessionStore(fake.io, null)
    const { promise: resolved, resolve } = Promise.withResolvers<WatchResult>()

    store.submit(resolved.then(whileRequest))
    store.submit({ kind: "on" })
    await flush()
    expect(fake.starts).toEqual([])

    resolve({ ok: true, target: cursor })
    await flush()
    await fake.finishStart(startedAs({ flags: "-is", watch: cursor }))
    expect(fake.starts).toEqual([{ flags: "-is", watch: cursor }, { flags: "-is" }])
  })

  test("a refusal settles at once, even behind a running change", async () => {
    const fake = fakeIO()
    const store = createSessionStore(fake.io, null)

    store.submit({ kind: "on" })
    const refused = store.submit(Promise.resolve<Request>({ kind: "refused", reason: "zed isn't running." }))

    expect(await outcomeSoFar(refused)).toEqual({ kind: "refused", reason: "zed isn't running." })
    expect(fake.starts).toEqual([{ flags: "-is" }])
  })

  test("cancel withdraws a waiting change and leaves a running one alone", async () => {
    const fake = fakeIO()
    const store = createSessionStore(fake.io, null)

    const first = store.submit({ kind: "on" })
    const second = store.submit({ kind: "timed", seconds: 90 })
    await flush()
    first.cancel()
    second.cancel()
    await fake.finishStart(startedAs({ flags: "-is" }))

    expect(await first.done).toEqual({ kind: "applied" })
    expect(await second.done).toEqual({ kind: "cancelled" })
    expect(fake.starts).toEqual([{ flags: "-is" }])
  })

  test("a refusal that lands after its request was cancelled leaves later changes queued", async () => {
    const fake = fakeIO()
    const store = createSessionStore(fake.io, null)
    const { promise: resolved, resolve } = Promise.withResolvers<WatchResult>()

    store.submit({ kind: "on" })
    store.submit(resolved.then(whileRequest)).cancel()
    store.submit({ kind: "timed", seconds: 90 })
    resolve({ ok: false, error: "zed isn't running." })
    await flush()
    await fake.finishStart(startedAs({ flags: "-is" }))

    expect(fake.starts).toEqual([{ flags: "-is" }, { flags: "-is", duration: 90 }])
  })
})

describe("a failed start", () => {
  test("drops the changes queued behind it, including one still resolving", async () => {
    const fake = fakeIO()
    const store = createSessionStore(fake.io, null)
    const { promise: resolved, resolve } = Promise.withResolvers<WatchResult>()

    store.submit({ kind: "on" })
    const timed = store.submit({ kind: "timed", seconds: 90 })
    const watched = store.submit(resolved.then(whileRequest))
    await flush()
    await fake.finishStart(boom)
    await fake.finishDetect(null)
    resolve({ ok: true, target: cursor })
    await flush()

    expect(await timed.done).toEqual({ kind: "dropped" })
    expect(await watched.done).toEqual({ kind: "dropped" })
    expect(fake.starts).toEqual([{ flags: "-is" }])
  })

  test("shows its error over the session that runs after it", async () => {
    const fake = fakeIO()
    const store = createSessionStore(fake.io, session({ duration: 1800 }))

    store.submit({ kind: "on" })
    await flush()
    await fake.finishStart(boom)
    await fake.finishDetect(null)

    expect(store.getSnapshot().error).toBe("Failed to start: boom")
    expect(store.getSnapshot().session).toBeNull()
  })

  test("that throws shows an unexpected error, and changes submitted later still run", async () => {
    const fake = fakeIO()
    const store = createSessionStore(fake.io, null)

    store.submit({ kind: "on" })
    const queued = store.submit({ kind: "timed", seconds: 90 })
    await flush()
    await fake.finishStart(Promise.reject(new Error("spawn")))

    expect(store.getSnapshot().error).toBe("Unexpected error: spawn")
    expect(await queued.done).toEqual({ kind: "dropped" })

    store.submit({ kind: "timed", seconds: 60 })
    await flush()
    expect(fake.starts).toEqual([{ flags: "-is" }, { flags: "-is", duration: 60 }])
  })

  test("leaves the error until it is dismissed, and dismissing without one notifies nobody", async () => {
    const fake = fakeIO()
    const store = createSessionStore(fake.io, null)
    let notified = 0
    store.subscribe(() => notified++)

    store.dismissError()
    expect(notified).toBe(0)

    store.submit({ kind: "on" })
    await flush()
    await fake.finishStart(boom)
    await fake.finishDetect(null)
    store.dismissError()
    expect(store.getSnapshot().error).toBeNull()
  })
})

describe("setFlags", () => {
  test("restarts a timed session at once with the new flags and its seconds left", async () => {
    const fake = fakeIO()
    const store = createSessionStore(fake.io, session({ duration: 1800 }))

    store.setFlags((flags) => new Set<Flag>([...flags, "d"]))
    expect(store.getSnapshot().flags).toEqual(new Set<Flag>(["d", "i", "s"]))
    await flush()

    expect(fake.starts).toEqual([{ flags: "-dis", duration: 1740 }])
  })

  test("restarts a watched session on the same process", async () => {
    const fake = fakeIO()
    const store = createSessionStore(fake.io, session({ watching: cursor }))

    store.setFlags((flags) => new Set<Flag>([...flags, "d"]))
    await flush()

    expect(fake.starts).toEqual([{ flags: "-dis", watch: cursor }])
  })

  test("with no session changes only the flags", async () => {
    const fake = fakeIO()
    const store = createSessionStore(fake.io, null)

    store.setFlags(() => new Set<Flag>(["d", "i", "s"]))
    await flush()

    expect(store.getSnapshot().flags).toEqual(new Set<Flag>(["d", "i", "s"]))
    expect(fake.starts).toEqual([])
  })

  test("queued behind a start applies to the session that start produced", async () => {
    const fake = fakeIO()
    const store = createSessionStore(fake.io, null)

    store.submit({ kind: "on" })
    await flush()
    store.setFlags((flags) => new Set<Flag>([...flags, "d"]))
    await fake.finishStart(startedAs({ flags: "-is" }))

    expect(fake.starts).toEqual([{ flags: "-is" }, { flags: "-dis" }])
  })
})

describe("the status tick", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  test("re-detects the session every second", async () => {
    const fake = fakeIO()
    const store = createSessionStore(fake.io, session())
    const stop = store.poll()

    jest.advanceTimersByTime(1000)
    await fake.finishDetect(session({ flags: "-dis" }))
    stop()

    expect(store.getSnapshot().session?.info.flags).toBe("-dis")
    expect(store.getSnapshot().session?.at).toEqual(now)
  })

  test("discards a detect issued before a change", async () => {
    const fake = fakeIO()
    const store = createSessionStore(fake.io, session())
    const stop = store.poll()

    jest.advanceTimersByTime(1000)
    store.submit({ kind: "timed", seconds: 90 })
    await flush()
    await fake.finishStart(startedAs({ flags: "-is", duration: 90 }))
    await fake.finishDetect(null)
    stop()

    expect(store.getSnapshot().session?.info.duration).toBe(90)
  })

  test("issues no detect while a change runs, so a restart never shows no session between its kill and spawn", async () => {
    const fake = fakeIO()
    const store = createSessionStore(fake.io, session())
    const stop = store.poll()

    store.submit({ kind: "timed", seconds: 90 })
    await flush()
    jest.advanceTimersByTime(3000)
    stop()

    expect(fake.pendingDetects()).toBe(0)
  })
})

test("the initial flags come from a running session, else the awake preset", () => {
  expect(createSessionStore(fakeIO().io, session({ flags: "-dis" })).getSnapshot().flags)
    .toEqual(new Set<Flag>(["d", "i", "s"]))
  expect(createSessionStore(fakeIO().io, null).getSnapshot().flags)
    .toEqual(new Set<Flag>(["i", "s"]))
})
