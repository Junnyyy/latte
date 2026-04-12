import { test, expect, describe } from "bun:test"
import React from "react"
import { render } from "ink-testing-library"
import { App } from "./App.tsx"
import type { CaffeinateInfo, TuiResult } from "../types/index.ts"

const activeInfo: CaffeinateInfo = {
  pid: 42,
  flags: "-imsu",
  startTime: new Date(Date.now() - 60_000), // started 1 min ago
  duration: null,
  remaining: null,
}

const timedInfo: CaffeinateInfo = {
  pid: 42,
  flags: "-imsu",
  startTime: new Date(Date.now() - 60_000),
  duration: 1800,
  remaining: 1740,
}

const noop = async (_duration?: number, _flags?: string): Promise<TuiResult> => ({ ok: true, info: null })
const noopDetect = async () => null

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

  test("shows action bar with flags keybind", () => {
    const { lastFrame } = render(
      <App initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
    )
    const frame = lastFrame()
    expect(frame).toContain("[f]")
    expect(frame).toContain("flags")
  })

  test("pressing f opens flag picker", async () => {
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
  })

  test("toggling a flag in picker updates display", async () => {
    const { lastFrame, stdin } = render(
      <App initialInfo={null} onStart={noop} onStop={noop} onDetect={noopDetect} />,
    )

    stdin.write("f")
    await wait()

    // Default flags are imsu (d is off). Toggle d on.
    stdin.write("d")
    await wait()

    const frame = lastFrame()
    expect(frame).toContain("display")
    expect(frame).toContain("●")
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

    expect(startFlags).toBe("-imsu")
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

    expect(startFlags).toBe("-dimsu")
  })
})
