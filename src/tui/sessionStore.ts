import { useEffect, useState, useSyncExternalStore } from "react"
import type { CaffeinateInfo, TuiResult } from "../types/index.ts"
import type { StartSpec } from "../services/Caffeinate.ts"
import { parseFlagString, type Flag } from "../utils/flags.ts"
import { initialFlagSet } from "../utils/resolveFlags.ts"
import { planChange, type Apply, type Change, type Plan, type Refused, type Request } from "./changes.ts"

export interface SessionIO {
  start: (spec: StartSpec) => Promise<TuiResult>
  stop: () => Promise<unknown>
  detect: () => Promise<CaffeinateInfo | null>
  now: () => Date
}

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
  cancel(): void
}

export interface SessionStore {
  submit(request: Request | Promise<Request>): Ticket
  setFlags(update: (current: ReadonlySet<Flag>) => ReadonlySet<Flag>): void
  dismissError(): void
  subscribe(listener: () => void): () => void
  getSnapshot(): Snapshot
  poll(): () => void
}

interface Slot {
  change: Change | Apply | "resolving"
  settle: (outcome: Outcome) => void
}

const unexpected = (e: unknown) => `Unexpected error: ${e instanceof Error ? e.message : String(e)}`

export const createSessionStore = (io: SessionIO, initial: CaffeinateInfo | null): SessionStore => {
  let snapshot: Snapshot = {
    session: initial && { info: initial, at: io.now() },
    flags: (initial && parseFlagString(initial.flags)) ?? initialFlagSet(),
    error: null,
  }
  const listeners = new Set<() => void>()
  const queue: Slot[] = []
  let running = false
  let sessionVersion = 0

  const write = (patch: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners) listener()
  }

  const writeSession = (session: Observed | null, error = snapshot.error) => {
    sessionVersion++
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
        await io.stop()
        writeSession(null)
        return { kind: "applied" }
      case "start": {
        const result = await io.start(plan.spec)
        if (result.ok) {
          writeSession(result.info && { info: result.info, at: result.info.startTime })
          return { kind: "applied" }
        }
        const info = await io.detect()
        writeSession(info && { info, at: io.now() }, result.error)
        return { kind: "failed", error: result.error }
      }
    }
  }

  const run = async (slot: Slot, change: Change | Apply) => {
    running = true
    sessionVersion++
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
    if (running || !head || head.change === "resolving") return
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
    const slot: Slot = { change: "resolving", settle: resolve }
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
        if (running || snapshot.session === null) return
        const issued = sessionVersion
        void io.detect().then((info) => {
          if (sessionVersion === issued) writeSession(info && { info, at: io.now() })
        })
      }, 1000)
      return () => clearInterval(id)
    },
  }
}

export const useSessionStore = (create: () => SessionStore): readonly [SessionStore, Snapshot] => {
  const [store] = useState(create)
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  useEffect(() => store.poll(), [store])
  return [store, snapshot]
}
