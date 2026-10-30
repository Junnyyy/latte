import { test, expect, describe } from "bun:test"
import { Either } from "effect"
import { nameOf, parsePsTable, resolveWatchTarget } from "./watch.ts"

const SESSION = "/Users/johnny/Library/Application Support/Claude/claude-code/2.1.309/5af865b9901c/claude.app/Contents/MacOS/claude"
const CODEX = "/Applications/Codex.app/Contents/Resources/CodexCLI.app/Contents/MacOS/codex"

// Rows from `ps -axo pid=,ppid=,comm=` on a Mac running these apps.
const PS_OUTPUT = `
    1     0 /sbin/launchd
51616     1 /Applications/Claude.app/Contents/MacOS/Claude
58157 51616 /Applications/Claude.app/Contents/Helpers/disclaimer
58158 58157 ${SESSION}
58700 58158 /bin/zsh
58800 58700 /Users/johnny/.local/bin/latte
51877 51616 /Applications/Claude.app/Contents/Helpers/disclaimer
51878 51877 ${SESSION}
49171     1 /Applications/Ghostty.app/Contents/MacOS/ghostty
49212 49171 ${CODEX}
49439 49171 ${CODEX}
60100     1 /Applications/Cursor.app/Contents/MacOS/Cursor
60101 60100 /Applications/Cursor.app/Contents/Frameworks/Cursor Helper (Renderer).app/Contents/MacOS/Cursor Helper (Renderer)
70000     1 /Applications/Zed.app/Contents/MacOS/zed
70001 70000 /Applications/Zed.app/Contents/MacOS/zed
71000     1 /bin/zsh
71001 71000 /Users/johnny/.local/bin/latte
`

const procs = parsePsTable(PS_OUTPUT)
const LATTE_IN_SESSION = 58800
const LATTE_IN_TERMINAL = 71001

const resolve = (query: string, selfPid = LATTE_IN_TERMINAL) =>
  Either.getOrThrow(resolveWatchTarget(query, procs, selfPid))

const errorOf = (query: string, selfPid = LATTE_IN_TERMINAL) =>
  Either.match(resolveWatchTarget(query, procs, selfPid), {
    onLeft: (e) => e.message,
    onRight: (t) => `resolved to ${t.pid}`,
  })

describe("parsePsTable", () => {
  test("keeps executable paths that contain spaces", () => {
    expect(procs.find((p) => p.pid === 58158)).toEqual({ pid: 58158, ppid: 58157, exe: SESSION })
    expect(procs).toHaveLength(17)
  })
})

describe("resolveWatchTarget", () => {
  test("a PID names that process", () => {
    expect(resolve("60100")).toEqual({ pid: 60100, name: "Cursor" })
    expect(resolve("58158")).toEqual({ pid: 58158, name: "Claude Code" })
  })

  test("a PID that isn't running is an error", () => {
    expect(errorOf("4242")).toBe("No process with PID 4242 is running.")
  })

  test("claude run inside a Claude Code session picks that session", () => {
    expect(resolve("claude", LATTE_IN_SESSION)).toEqual({ pid: 58158, name: "Claude Code" })
  })

  test("claude outside any session lists every session", () => {
    expect(errorOf("claude")).toBe(
      [
        "Several Claude Code processes are running:",
        `  58158  ${SESSION}`,
        `  51878  ${SESSION}`,
        "Run latte from inside the session you mean, or pass a PID, e.g. latte on --while 58158.",
      ].join("\n"),
    )
  })

  test("claude-desktop picks the desktop app, not its sessions", () => {
    expect(resolve("claude-desktop", LATTE_IN_SESSION)).toEqual({ pid: 51616, name: "Claude" })
  })

  test("cursor ignores its helper processes", () => {
    expect(resolve("cursor")).toEqual({ pid: 60100, name: "Cursor" })
    expect(resolve("Cursor")).toEqual({ pid: 60100, name: "Cursor" })
  })

  test("sibling codex processes are ambiguous", () => {
    const message = errorOf("codex")
    expect(message).toStartWith("Several codex processes are running:")
    expect(message).toContain(`  49212  ${CODEX}`)
    expect(message).toContain(`  49439  ${CODEX}`)
  })

  test("a match under another match collapses to the top one", () => {
    expect(resolve("zed")).toEqual({ pid: 70000, name: "Zed" })
  })

  test("an app that isn't running is an error", () => {
    expect(errorOf("vscode")).toBe("VS Code isn't running. Open it first, or pass its PID.")
    expect(errorOf("Xcode")).toBe("Xcode isn't running. Open it first, or pass its PID.")
  })

  test("an empty query is an error", () => {
    expect(errorOf(" ")).toBe("--while needs an app name or PID, e.g. claude, cursor, 4242.")
  })

  test("latte never watches itself", () => {
    expect(resolve("latte")).toEqual({ pid: 58800, name: "latte" })
  })
})

describe("nameOf", () => {
  test("names known apps, bundles, and bare executables", () => {
    expect(nameOf("/Applications/Visual Studio Code.app/Contents/MacOS/Electron")).toBe("VS Code")
    expect(nameOf("/Users/johnny/.local/bin/claude")).toBe("Claude Code")
    expect(nameOf("/Applications/Zed.app/Contents/MacOS/zed")).toBe("Zed")
    expect(nameOf("/bin/zsh")).toBe("zsh")
  })
})
