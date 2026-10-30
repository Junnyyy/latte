import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import React from "react"
import { render } from "ink-testing-library"
import { App } from "./App.tsx"
import type { CaffeinateInfo, TuiResult, WatchResult } from "../types/index.ts"
import type { StartSpec } from "../services/Caffeinate.ts"

const activeInfo: CaffeinateInfo = {
  pid: 42,
  flags: "-is",
  startTime: new Date(Date.now() - 60_000), // started 1 min ago
  duration: null,
  remaining: null,
  watching: null,
}

const timedInfo: CaffeinateInfo = {
  pid: 42,
  flags: "-is",
  startTime: new Date(Date.now() - 60_000),
  duration: 1800,
  remaining: 1740,
  watching: null,
}

const noop = async (_spec?: StartSpec): Promise<TuiResult> => ({ ok: true, info: null })
const noopDetect = async () => null
const unresolved = async (query: string): Promise<WatchResult> => ({ ok: false, error: `${query} isn't running.` })
const cursor = { pid: 123, name: "Cursor" }
const resolvesCursor = async (_query: string): Promise<WatchResult> => ({ ok: true, target: cursor })

const originalEnv = process.env.LATTE_FLAGS
beforeEach(() => {
  delete process.env.LATTE_FLAGS
})
afterEach(() => {
  if (originalEnv === undefined) delete process.env.LATTE_FLAGS
  else process.env.LATTE_FLAGS = originalEnv
})

function wait(ms: number = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe("App", () => {
  test("renders inactive state when no caffeinate", () => {
    const { lastFrame } = render(
      <App onResolveWatch={unresolved} initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
    )
    const frame = lastFrame()
    expect(frame).toContain("Inactive")
    expect(frame).toContain("no caffeinate running")
  })

  test("renders active state with caffeinate info", () => {
    const { lastFrame } = render(
      <App onResolveWatch={unresolved} initialInfo={activeInfo} onStart={noop} onStop={noop} onDetect={async () => activeInfo} />,
    )
    const frame = lastFrame()
    expect(frame).toContain("Active")
    expect(frame).toContain("preventing sleep")
  })

  test("renders timed session with remaining", () => {
    const { lastFrame } = render(
      <App onResolveWatch={unresolved} initialInfo={timedInfo} onStart={noop} onStop={noop} onDetect={async () => timedInfo} />,
    )
    const frame = lastFrame()
    expect(frame).toContain("Active")
    expect(frame).toContain("Remaining")
  })

  test("renders what a watched session waits for instead of indefinite", () => {
    const watchedInfo: CaffeinateInfo = { ...activeInfo, watching: { pid: 123, name: "Cursor" } }
    const { lastFrame } = render(
      <App onResolveWatch={unresolved} initialInfo={watchedInfo} onStart={noop} onStop={noop} onDetect={async () => watchedInfo} />,
    )
    expect(lastFrame()).toContain("Until Cursor exits (PID 123)")
    expect(lastFrame()).not.toContain("indefinite")
  })

  test("shows action bar with keybinds", () => {
    const { lastFrame } = render(
      <App onResolveWatch={unresolved} initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
    )
    const frame = lastFrame()
    expect(frame).toContain("[o]")
    expect(frame).toContain("[x]")
    expect(frame).toContain("[t]")
    expect(frame).toContain("[q]")
  })

  test("pressing o on inactive state starts caffeinate", async () => {
    let startCalled = false
    const onStart = async ({ duration }: StartSpec): Promise<TuiResult> => {
      startCalled = true
      expect(duration).toBeUndefined()
      return { ok: true, info: activeInfo }
    }

    const { stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={null} onStart={onStart} onStop={noop} onDetect={noopDetect} />,
    )

    stdin.write("o")
    await wait()

    expect(startCalled).toBe(true)
  })

  test("pressing o on active state shows confirm dialog", async () => {
    const { lastFrame, stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={activeInfo} onStart={noop} onStop={noop} onDetect={async () => activeInfo} />,
    )

    stdin.write("o")
    await wait()

    const frame = lastFrame()
    expect(frame).toContain("Replace")
    expect(frame).toContain("[y]")
    expect(frame).toContain("[n]")
  })

  test("pressing x on active state stops caffeinate", async () => {
    let stopCalled = false
    const onStop = async (): Promise<TuiResult> => {
      stopCalled = true
      return { ok: true, info: null }
    }

    const { stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={activeInfo} onStart={noop} onStop={onStop} onDetect={async () => activeInfo} />,
    )

    stdin.write("x")
    await wait()

    expect(stopCalled).toBe(true)
  })

  test("pressing t shows duration input", async () => {
    const { lastFrame, stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
    )

    stdin.write("t")
    await wait()

    const frame = lastFrame()
    expect(frame).toContain("Duration:")
    expect(frame).toContain("[enter]")
    expect(frame).toContain("[esc]")
  })

  test("an invalid duration shows its error until the value changes", async () => {
    const { lastFrame, stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
    )

    stdin.write("t")
    await wait()
    for (const c of "abc") {
      stdin.write(c)
      await wait()
    }
    stdin.write("\r")
    await wait()
    expect(lastFrame()).toContain('"abc" is not a valid duration')

    stdin.write("\u007F")
    await wait()
    expect(lastFrame()).toContain("Duration: ab")
    expect(lastFrame()).not.toContain("not a valid duration")
  })

  test("a duration entered during a session starts after the replace confirm", async () => {
    const starts: StartSpec[] = []
    const onStart = async (spec: StartSpec): Promise<TuiResult> => {
      starts.push(spec)
      return { ok: true, info: timedInfo }
    }

    const { lastFrame, stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={activeInfo} onStart={onStart} onStop={noop} onDetect={async () => activeInfo} />,
    )

    stdin.write("t")
    await wait()
    for (const c of "90s") {
      stdin.write(c)
      await wait()
    }
    stdin.write("\r")
    await wait()
    expect(lastFrame()).toContain("Replace?")
    expect(starts).toEqual([])

    stdin.write("y")
    await wait()
    expect(starts).toEqual([{ duration: 90, flags: "-is" }])
  })

  test("pressing w asks what to stay awake for", async () => {
    const { lastFrame, stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
    )
    expect(lastFrame()).toContain("[w] while")

    stdin.write("w")
    await wait()

    expect(lastFrame()).toContain("Stay awake while:")
    expect(lastFrame()).toContain("An app name or PID, e.g. claude, cursor, 4242")
  })

  test("a resolved app starts a session that waits for it", async () => {
    const queries: string[] = []
    const starts: StartSpec[] = []
    const onResolveWatch = async (query: string): Promise<WatchResult> => {
      queries.push(query)
      return { ok: true, target: cursor }
    }
    const onStart = async (spec: StartSpec): Promise<TuiResult> => {
      starts.push(spec)
      return { ok: true, info: { ...activeInfo, watching: cursor } }
    }

    const { lastFrame, stdin } = render(
      <App onResolveWatch={onResolveWatch} initialInfo={null} onStart={onStart} onStop={noop} onDetect={async () => ({ ...activeInfo, watching: cursor })} />,
    )

    stdin.write("w")
    await wait()
    for (const c of "cursor") {
      stdin.write(c)
      await wait()
    }
    stdin.write("\r")
    await wait()

    expect(queries).toEqual(["cursor"])
    expect(starts).toEqual([{ watch: cursor, flags: "-is" }])
    expect(lastFrame()).toContain("Until Cursor exits (PID 123)")
  })

  test("an app that is not running shows why and starts nothing", async () => {
    const starts: StartSpec[] = []
    const onStart = async (spec: StartSpec): Promise<TuiResult> => {
      starts.push(spec)
      return { ok: true, info: activeInfo }
    }

    const { lastFrame, stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={null} onStart={onStart} onStop={noop} onDetect={noopDetect} />,
    )

    stdin.write("w")
    await wait()
    for (const c of "zed") {
      stdin.write(c)
      await wait()
    }
    stdin.write("\r")
    await wait()

    expect(lastFrame()).toContain("zed isn't running.")
    expect(lastFrame()).toContain("Stay awake while: zed")
    expect(starts).toEqual([])
  })

  test("cancelling while an app resolves starts nothing", async () => {
    let finish: (result: WatchResult) => void = () => {}
    const onResolveWatch = (_query: string) => new Promise<WatchResult>((resolve) => { finish = resolve })
    const starts: StartSpec[] = []
    const onStart = async (spec: StartSpec): Promise<TuiResult> => {
      starts.push(spec)
      return { ok: true, info: activeInfo }
    }

    const { lastFrame, stdin } = render(
      <App onResolveWatch={onResolveWatch} initialInfo={null} onStart={onStart} onStop={noop} onDetect={noopDetect} />,
    )

    stdin.write("w")
    await wait()
    stdin.write("c")
    await wait()
    stdin.write("\r")
    await wait()
    stdin.write("\u001B")
    await wait()
    finish({ ok: true, target: cursor })
    await wait()

    expect(starts).toEqual([])
    expect(lastFrame()).toContain("Inactive")
    expect(lastFrame()).not.toContain("Stay awake while:")
  })

  test("a second enter while a watched session starts does not start another", async () => {
    let finish: (result: TuiResult) => void = () => {}
    const starts: StartSpec[] = []
    const onStart = (spec: StartSpec) => {
      starts.push(spec)
      return new Promise<TuiResult>((resolve) => { finish = resolve })
    }

    const { stdin } = render(
      <App onResolveWatch={resolvesCursor} initialInfo={null} onStart={onStart} onStop={noop} onDetect={noopDetect} />,
    )

    stdin.write("w")
    await wait()
    stdin.write("c")
    await wait()
    stdin.write("\r")
    await wait()
    stdin.write("\r")
    await wait()
    finish({ ok: true, info: { ...activeInfo, watching: cursor } })
    await wait()

    expect(starts).toEqual([{ watch: cursor, flags: "-is" }])
  })

  test("an enter whose resolve lands after the first start finishes starts nothing", async () => {
    const resolves: ((result: WatchResult) => void)[] = []
    const onResolveWatch = (_query: string) => new Promise<WatchResult>((resolve) => { resolves.push(resolve) })
    let finishStart: (result: TuiResult) => void = () => {}
    const starts: StartSpec[] = []
    const onStart = (spec: StartSpec) => {
      starts.push(spec)
      return new Promise<TuiResult>((resolve) => { finishStart = resolve })
    }

    const { stdin } = render(
      <App onResolveWatch={onResolveWatch} initialInfo={null} onStart={onStart} onStop={noop} onDetect={noopDetect} />,
    )

    stdin.write("w")
    await wait()
    stdin.write("c")
    await wait()
    stdin.write("\r")
    await wait()
    resolves[0]!({ ok: true, target: cursor })
    await wait()
    stdin.write("\r")
    await wait()
    finishStart({ ok: true, info: { ...activeInfo, watching: cursor } })
    await wait()
    resolves[1]?.({ ok: true, target: cursor })
    await wait()

    expect(starts).toEqual([{ watch: cursor, flags: "-is" }])
  })

  test("a resolve from a cancelled submit is ignored after the same query is resubmitted", async () => {
    const resolves: ((result: WatchResult) => void)[] = []
    const onResolveWatch = (_query: string) => new Promise<WatchResult>((resolve) => { resolves.push(resolve) })
    const starts: StartSpec[] = []
    const onStart = async (spec: StartSpec): Promise<TuiResult> => {
      starts.push(spec)
      return { ok: true, info: activeInfo }
    }

    const { stdin } = render(
      <App onResolveWatch={onResolveWatch} initialInfo={null} onStart={onStart} onStop={noop} onDetect={noopDetect} />,
    )

    stdin.write("w")
    await wait()
    stdin.write("c")
    await wait()
    stdin.write("\r")
    await wait()
    stdin.write("\u001B")
    await wait()
    stdin.write("w")
    await wait()
    stdin.write("c")
    await wait()
    stdin.write("\r")
    await wait()
    resolves[0]!({ ok: true, target: { pid: 1, name: "stale" } })
    await wait()
    expect(starts).toEqual([])

    resolves[1]!({ ok: true, target: cursor })
    await wait()
    expect(starts).toEqual([{ watch: cursor, flags: "-is" }])
  })

  test("pressing o twice while a session starts starts it once", async () => {
    let finish: (result: TuiResult) => void = () => {}
    let starts = 0
    const onStart = (_spec: StartSpec) => {
      starts++
      return new Promise<TuiResult>((resolve) => { finish = resolve })
    }

    const { stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={null} onStart={onStart} onStop={noop} onDetect={noopDetect} />,
    )

    stdin.write("o")
    await wait()
    stdin.write("o")
    await wait()
    finish({ ok: true, info: activeInfo })
    await wait()

    expect(starts).toBe(1)
  })

  test("waiting for an app during a session replaces it after confirm", async () => {
    const starts: StartSpec[] = []
    const onStart = async (spec: StartSpec): Promise<TuiResult> => {
      starts.push(spec)
      return { ok: true, info: { ...activeInfo, watching: cursor } }
    }

    const { lastFrame, stdin } = render(
      <App onResolveWatch={resolvesCursor} initialInfo={activeInfo} onStart={onStart} onStop={noop} onDetect={async () => activeInfo} />,
    )

    stdin.write("w")
    await wait()
    stdin.write("c")
    await wait()
    stdin.write("\r")
    await wait()
    expect(lastFrame()).toContain("Replace?")
    expect(starts).toEqual([])

    stdin.write("y")
    await wait()
    expect(starts).toEqual([{ watch: cursor, flags: "-is" }])
  })

  test("cancelling confirm dialog returns to list", async () => {
    const { lastFrame, stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={activeInfo} onStart={noop} onStop={noop} onDetect={async () => activeInfo} />,
    )

    stdin.write("o")
    await wait()
    expect(lastFrame()).toContain("Replace")

    stdin.write("n")
    await wait()

    const frame = lastFrame()
    expect(frame).not.toContain("Replace")
    expect(frame).toContain("Active")
  })

  test("shows the screen toggle off and the advanced picker in the action bar", () => {
    const { lastFrame } = render(
      <App onResolveWatch={unresolved} initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
    )
    const frame = lastFrame()
    expect(frame).toContain("[s] screen ○")
    expect(frame).toContain("[f] advanced")
  })

  test("active state describes the preset", () => {
    const { lastFrame } = render(
      <App onResolveWatch={unresolved} initialInfo={activeInfo} onStart={noop} onStop={noop} onDetect={async () => activeInfo} />,
    )
    expect(lastFrame()).toContain("Mac stays awake, screen can sleep")
  })

  test("pressing s turns the screen on for the next start", async () => {
    let startFlags: string | undefined
    const onStart = async ({ flags }: StartSpec): Promise<TuiResult> => {
      startFlags = flags
      return { ok: true, info: { ...activeInfo, flags } }
    }

    const { lastFrame, stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={null} onStart={onStart} onStop={noop} onDetect={noopDetect} />,
    )

    stdin.write("s")
    await wait()
    expect(lastFrame()).toContain("[s] screen ●")

    stdin.write("o")
    await wait()

    expect(startFlags).toBe("-dis")
    expect(lastFrame()).toContain("Mac and screen stay awake")
  })

  test("pressing s during a session says the change applies to the next start", async () => {
    const { lastFrame, stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={activeInfo} onStart={noop} onStop={noop} onDetect={async () => activeInfo} />,
    )
    expect(lastFrame()).not.toContain("Next start")

    stdin.write("s")
    await wait()
    expect(lastFrame()).toContain("Next start: Mac and screen stay awake. Press o, t, or w to apply.")

    stdin.write("s")
    await wait()
    expect(lastFrame()).not.toContain("Next start")
  })

  test("pressing s with no session shows no next-start line", async () => {
    const { lastFrame, stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
    )
    stdin.write("s")
    await wait()
    expect(lastFrame()).toContain("[s] screen ●")
    expect(lastFrame()).not.toContain("Next start")
  })

  test("pressing s twice turns the screen back off", async () => {
    let startFlags: string | undefined
    const onStart = async ({ flags }: StartSpec): Promise<TuiResult> => {
      startFlags = flags
      return { ok: true, info: activeInfo }
    }

    const { lastFrame, stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={null} onStart={onStart} onStop={noop} onDetect={noopDetect} />,
    )

    stdin.write("s")
    await wait()
    stdin.write("s")
    await wait()
    expect(lastFrame()).toContain("[s] screen ○")

    stdin.write("o")
    await wait()

    expect(startFlags).toBe("-is")
  })

  test("the screen toggle and the picker share one flag set", async () => {
    const { lastFrame, stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
    )

    stdin.write("f")
    await wait()
    stdin.write("d")
    await wait()
    stdin.write("\r")
    await wait()

    expect(lastFrame()).toContain("[s] screen ●")
  })

  test("picker reset returns to the awake preset", async () => {
    let startFlags: string | undefined
    const onStart = async ({ flags }: StartSpec): Promise<TuiResult> => {
      startFlags = flags
      return { ok: true, info: activeInfo }
    }

    const { stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={null} onStart={onStart} onStop={noop} onDetect={noopDetect} />,
    )

    stdin.write("s")
    await wait()
    stdin.write("f")
    await wait()
    stdin.write("m")
    await wait()
    stdin.write("r")
    await wait()
    stdin.write("\r")
    await wait()
    stdin.write("o")
    await wait()

    expect(startFlags).toBe("-is")
  })

  test("pressing f opens flag picker and hides action bar", async () => {
    const { lastFrame, stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
    )

    stdin.write("f")
    await wait()

    const frame = lastFrame()
    expect(frame).toContain("Flags:")
    expect(frame).toContain("[d]")
    expect(frame).toContain("[enter]")
    expect(frame).toContain("[esc]")
    // ActionBar should be hidden
    expect(frame).not.toContain("[o]")
    expect(frame).not.toContain("[q]")
    // Disabled flags show ○
    expect(frame).toContain("○")
  })

  test("toggling a flag in picker updates display", async () => {
    const { lastFrame, stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
    )

    stdin.write("f")
    await wait()

    expect(lastFrame()).toContain("[d] display ○")
    stdin.write("d")
    await wait()

    expect(lastFrame()).toContain("[d] display ●")
  })

  test("confirming flag picker returns to idle", async () => {
    const { lastFrame, stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
    )

    stdin.write("f")
    await wait()
    expect(lastFrame()).toContain("Flags:")

    // Press enter to confirm
    stdin.write("\r")
    await wait()

    const frame = lastFrame()
    expect(frame).not.toContain("Flags:")
    expect(frame).toContain("[o]")
  })

  test("cancelling flag picker discards changes", async () => {
    let startFlags: string | undefined
    const onStart = async ({ flags }: StartSpec): Promise<TuiResult> => {
      startFlags = flags
      return { ok: true, info: activeInfo }
    }

    const { lastFrame, stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={null} onStart={onStart} onStop={noop} onDetect={noopDetect} />,
    )

    // Open picker, toggle display on
    stdin.write("f")
    await wait()
    stdin.write("d")
    await wait()

    // Cancel with escape
    stdin.write("\u001B") // ESC
    await wait()

    // Start — should use defaults (no display)
    stdin.write("o")
    await wait()

    expect(startFlags).toBe("-is")
  })

  test("onStart receives session flags after picker confirm", async () => {
    let startFlags: string | undefined
    const onStart = async ({ flags }: StartSpec): Promise<TuiResult> => {
      startFlags = flags
      return { ok: true, info: { ...activeInfo, flags: "-dimsu" } }
    }

    const { stdin } = render(
      <App onResolveWatch={unresolved} initialInfo={null} onStart={onStart} onStop={noop} onDetect={noopDetect} />,
    )

    // Open picker, toggle display on, confirm
    stdin.write("f")
    await wait()
    stdin.write("d")
    await wait()
    stdin.write("\r")
    await wait()

    // Start — should include display
    stdin.write("o")
    await wait()

    expect(startFlags).toBe("-dis")
  })
})
