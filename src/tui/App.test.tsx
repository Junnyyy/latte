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

const noop = async (): Promise<TuiResult> => ({ ok: true, info: null })
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
    const onStart = async (duration?: number): Promise<TuiResult> => {
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
})
