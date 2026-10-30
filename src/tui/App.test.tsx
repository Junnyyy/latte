import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import React from "react"
import { render } from "ink-testing-library"
import { App } from "./App.tsx"
import type { CaffeinateInfo, TuiResult } from "../types/index.ts"

const activeInfo: CaffeinateInfo = {
  pid: 42,
  flags: "-is",
  startTime: new Date(Date.now() - 60_000), // started 1 min ago
  duration: null,
  remaining: null,
}

const timedInfo: CaffeinateInfo = {
  pid: 42,
  flags: "-is",
  startTime: new Date(Date.now() - 60_000),
  duration: 1800,
  remaining: 1740,
}

const noop = async (_duration?: number, _flags?: string): Promise<TuiResult> => ({ ok: true, info: null })
const noopDetect = async () => null

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
      <App initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
    )
    const frame = lastFrame()
    expect(frame).toContain("Inactive")
    expect(frame).toContain("no caffeinate running")
  })

  test("renders active state with caffeinate info", () => {
    const { lastFrame } = render(
      <App initialInfo={activeInfo} onStart={noop} onStop={noop} onDetect={async () => activeInfo} />,
    )
    const frame = lastFrame()
    expect(frame).toContain("Active")
    expect(frame).toContain("preventing sleep")
  })

  test("renders timed session with remaining", () => {
    const { lastFrame } = render(
      <App initialInfo={timedInfo} onStart={noop} onStop={noop} onDetect={async () => timedInfo} />,
    )
    const frame = lastFrame()
    expect(frame).toContain("Active")
    expect(frame).toContain("Remaining")
  })

  test("shows action bar with keybinds", () => {
    const { lastFrame } = render(
      <App initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
    )
    const frame = lastFrame()
    expect(frame).toContain("[o]")
    expect(frame).toContain("[x]")
    expect(frame).toContain("[t]")
    expect(frame).toContain("[q]")
  })

  test("pressing o on inactive state starts caffeinate", async () => {
    let startCalled = false
    const onStart = async (duration?: number, _flags?: string): Promise<TuiResult> => {
      startCalled = true
      expect(duration).toBeUndefined()
      return { ok: true, info: activeInfo }
    }

    const { stdin } = render(
      <App initialInfo={null} onStart={onStart} onStop={noop} onDetect={noopDetect} />,
    )

    stdin.write("o")
    await wait()

    expect(startCalled).toBe(true)
  })

  test("pressing o on active state shows confirm dialog", async () => {
    const { lastFrame, stdin } = render(
      <App initialInfo={activeInfo} onStart={noop} onStop={noop} onDetect={async () => activeInfo} />,
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
      <App initialInfo={activeInfo} onStart={noop} onStop={onStop} onDetect={async () => activeInfo} />,
    )

    stdin.write("x")
    await wait()

    expect(stopCalled).toBe(true)
  })

  test("pressing t shows duration input", async () => {
    const { lastFrame, stdin } = render(
      <App initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
    )

    stdin.write("t")
    await wait()

    const frame = lastFrame()
    expect(frame).toContain("Duration:")
    expect(frame).toContain("[enter]")
    expect(frame).toContain("[esc]")
  })

  test("cancelling confirm dialog returns to list", async () => {
    const { lastFrame, stdin } = render(
      <App initialInfo={activeInfo} onStart={noop} onStop={noop} onDetect={async () => activeInfo} />,
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
      <App initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
    )
    const frame = lastFrame()
    expect(frame).toContain("[s] screen ○")
    expect(frame).toContain("[f] advanced")
  })

  test("active state describes the preset", () => {
    const { lastFrame } = render(
      <App initialInfo={activeInfo} onStart={noop} onStop={noop} onDetect={async () => activeInfo} />,
    )
    expect(lastFrame()).toContain("Mac stays awake, screen can sleep")
  })

  test("pressing s turns the screen on for the next start", async () => {
    let startFlags: string | undefined
    const onStart = async (_duration: number | undefined, flags: string): Promise<TuiResult> => {
      startFlags = flags
      return { ok: true, info: { ...activeInfo, flags } }
    }

    const { lastFrame, stdin } = render(
      <App initialInfo={null} onStart={onStart} onStop={noop} onDetect={noopDetect} />,
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
      <App initialInfo={activeInfo} onStart={noop} onStop={noop} onDetect={async () => activeInfo} />,
    )
    expect(lastFrame()).not.toContain("Next start")

    stdin.write("s")
    await wait()
    expect(lastFrame()).toContain("Next start: Mac and screen stay awake. Press o or t to apply.")

    stdin.write("s")
    await wait()
    expect(lastFrame()).not.toContain("Next start")
  })

  test("pressing s with no session shows no next-start line", async () => {
    const { lastFrame, stdin } = render(
      <App initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
    )
    stdin.write("s")
    await wait()
    expect(lastFrame()).toContain("[s] screen ●")
    expect(lastFrame()).not.toContain("Next start")
  })

  test("pressing s twice turns the screen back off", async () => {
    let startFlags: string | undefined
    const onStart = async (_duration: number | undefined, flags: string): Promise<TuiResult> => {
      startFlags = flags
      return { ok: true, info: activeInfo }
    }

    const { lastFrame, stdin } = render(
      <App initialInfo={null} onStart={onStart} onStop={noop} onDetect={noopDetect} />,
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
      <App initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
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
    const onStart = async (_duration: number | undefined, flags: string): Promise<TuiResult> => {
      startFlags = flags
      return { ok: true, info: activeInfo }
    }

    const { stdin } = render(
      <App initialInfo={null} onStart={onStart} onStop={noop} onDetect={noopDetect} />,
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
      <App initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
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
      <App initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
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
      <App initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
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
    const onStart = async (duration?: number, flags?: string): Promise<TuiResult> => {
      startFlags = flags
      return { ok: true, info: activeInfo }
    }

    const { lastFrame, stdin } = render(
      <App initialInfo={null} onStart={onStart} onStop={noop} onDetect={noopDetect} />,
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
    const onStart = async (duration?: number, flags?: string): Promise<TuiResult> => {
      startFlags = flags
      return { ok: true, info: { ...activeInfo, flags: "-dimsu" } }
    }

    const { stdin } = render(
      <App initialInfo={null} onStart={onStart} onStop={noop} onDetect={noopDetect} />,
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
