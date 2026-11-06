import { useEffect, useState, useSyncExternalStore } from "react"
import type { CaffeinateInfo, TuiResult } from "../types/index.ts"
import type { StartSpec } from "../services/Caffeinate.ts"
import { parseFlagString, type Flag } from "../utils/flags.ts"
import { initialFlagSet } from "../utils/resolveFlags.ts"
import { planChange, type Apply, type Change, type Plan, type Refused, type Request } from "./changes.ts"

export interface SessionIO {
  start: (spec: StartSpec) => Promise<TuiResult>
  stop: () => Promise<TuiResult>
  detect: () => Promise<CaffeinateInfo | null>
  now: () => Date
}

/** A session and the moment it was seen. Elapsed time derives from both, so they never disagree. */
export interface Observed {
  info: CaffeinateInfo
  at: Date
}

export interface Snapshot {
  session: Observed | null
  flags: ReadonlySet<Flag>
  error: string | null
}

export type Outcome =
  | { kind: "applied" }
  | { kind: "unchanged" }
  | { kind: "failed"; error: string }
  | { kind: "dropped" }
  | { kind: "cancelled" }
  | { kind: "refused"; reason: string }

export interface Ticket {
  readonly done: Promise<Outcome>
  /** Withdraws the change if it has not started to run. */
  cancel(): void
}

export interface SessionStore {
  /** Queues a change behind every change submitted before it. A pending request holds its place. */
  submit(request: Request | Promise<Request>): Ticket
  /** Writes the settings at once, then queues a restart of the running session to match them. */
  setFlags(update: (current: ReadonlySet<Flag>) => ReadonlySet<Flag>): void
  dismissError(): void
  subscribe(listener: () => void): () => void
  getSnapshot(): Snapshot
  /** Re-detects the session every second while one runs. Returns a function that stops it. */
  poll(): () => void
}

/** A queued change. `change` is unset while its request still resolves. */
interface Slot {
  change?: Change | Apply
  settle: (outcome: Outcome) => void
}

const unexpected = (e: unknown) => `Unexpected error: ${e instanceof Error ? e.message : String(e)}`

export const createSessionStore = (io: SessionIO, initial: CaffeinateInfo | null): SessionStore => {
  let snapshot: Snapshot = {
    session: initial && { info: initial, at: io.now() },
    // Seeded from the running session, so s on a -dis session started elsewhere turns the screen off.
    flags: (initial && parseFlagString(initial.flags)) ?? initialFlagSet(),
    error: null,
  }
  const listeners = new Set<() => void>()
  const queue: Slot[] = []
  let running = false
  // Bumped when a change starts and on every session write. A status detect lands only if it is unchanged.
  let version = 0

  const write = (patch: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners) listener()
  }

  const writeSession = (session: Observed | null, error = snapshot.error) => {
    version++
    write({ session, error })
  }

  const withdraw = (slot: Slot, outcome: Outcome) => {
    queue.splice(queue.indexOf(slot), 1)
    slot.settle(outcome)
  }

  const execute = async (plan: Plan): Promise<Outcome> => {
    switch (plan.kind) {
      case "nothing":
        return { kind: "unchanged" }
      case "stop":
        // A stop that finds no caffeinate still leaves none running, which is what x asks for.
        await io.stop()
        writeSession(null)
        return { kind: "applied" }
      case "start": {
        const result = await io.start(plan.spec)
        if (result.ok) {
          // Seen at its own start time, so the first frame after a start reads "Running for 0s".
          writeSession(result.info && { info: result.info, at: result.info.startTime })
          return { kind: "applied" }
        }
        // onStart kills before it spawns, so show the failure under what runs now.
        const info = await io.detect()
        writeSession(info && { info, at: io.now() }, result.error)
        return { kind: "failed", error: result.error }
      }
    }
  }

  const run = async (slot: Slot, change: Change | Apply) => {
    running = true
    version++
    const plan = planChange(change, { session: snapshot.session?.info ?? null, flags: snapshot.flags, now: io.now() })
    const outcome = await execute(plan).catch((e: unknown): Outcome => {
      const error = unexpected(e)
      write({ error })
      return { kind: "failed", error }
    })
    running = false
    slot.settle(outcome)
    if (outcome.kind === "failed") {
      for (const waiting of queue.splice(0)) waiting.settle({ kind: "dropped" })
    }
    pump()
  }

  const pump = () => {
    const head = queue[0]
    if (running || head?.change === undefined) return
    queue.shift()
    void run(head, head.change)
  }

  const accept = (slot: Slot, request: Change | Apply | Refused) => {
    if (!queue.includes(slot)) return
    if (request.kind === "refused") withdraw(slot, { kind: "refused", reason: request.reason })
    else slot.change = request
    pump()
  }

  const enqueue = (request: Change | Apply | Refused | Promise<Request>): Ticket => {
    const { promise, resolve } = Promise.withResolvers<Outcome>()
    const slot: Slot = { settle: resolve }
    queue.push(slot)
    Promise.resolve(request).then(
      (resolved) => accept(slot, resolved),
      (e: unknown) => accept(slot, { kind: "refused", reason: unexpected(e) }),
    )
    return {
      done: promise,
      cancel: () => {
        if (!queue.includes(slot)) return
        withdraw(slot, { kind: "cancelled" })
        pump()
      },
    }
  }

  return {
    submit: enqueue,
    setFlags: (update) => {
      write({ flags: update(snapshot.flags) })
      enqueue({ kind: "apply" })
    },
    dismissError: () => {
      if (snapshot.error !== null) write({ error: null })
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => snapshot,
    poll: () => {
      const id = setInterval(() => {
        // A detect issued during a change could land between its kill and its spawn.
        if (running || snapshot.session === null) return
        const issued = version
        void io.detect().then((info) => {
          if (version === issued) writeSession(info && { info, at: io.now() })
        })
      }, 1000)
      return () => clearInterval(id)
    },
  }
}

/** Creates the store once, renders on each snapshot, and polls while mounted. */
export const useSessionStore = (create: () => SessionStore): readonly [SessionStore, Snapshot] => {
  const [store] = useState(create)
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  useEffect(() => store.poll(), [store])
  return [store, snapshot]
}
