import { Either } from "effect"
import { WatchTargetError } from "../errors/index.ts"

export interface ProcessEntry {
  pid: number
  ppid: number
  exe: string
}

/** A process a session stays awake for. `name` is for people, e.g. "Claude Code". */
export interface WatchTarget {
  pid: number
  name: string
}

/** Parse `ps -axo pid=,ppid=,comm=`. comm is the executable path and may contain spaces. */
export const parsePsTable = (output: string): ProcessEntry[] =>
  output.split("\n").flatMap((line) => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/)
    return match ? [{ pid: Number(match[1]), ppid: Number(match[2]), exe: match[3]! }] : []
  })

const basename = (exe: string): string => exe.slice(exe.lastIndexOf("/") + 1)

const BUNDLE_EXECUTABLE = /\/([^/]+)\.app\/Contents\/MacOS\/[^/]+$/

interface KnownApp {
  queries: readonly string[]
  name: string
  matches: (exe: string) => boolean
}

const KNOWN_APPS: readonly KnownApp[] = [
  // Case-sensitive, so the desktop app's `Claude` executable is not a Claude Code session.
  { queries: ["claude"], name: "Claude Code", matches: (exe) => basename(exe) === "claude" },
  {
    queries: ["claude-desktop"],
    name: "Claude",
    matches: (exe) => exe.endsWith("/Claude.app/Contents/MacOS/Claude"),
  },
  {
    queries: ["code", "vscode"],
    name: "VS Code",
    matches: (exe) => exe.includes("/Visual Studio Code.app/Contents/MacOS/"),
  },
]

/**
 * Matches an executable named `query`, or the main executable of `<query>.app`.
 * Helper executables live in nested bundles under Contents/Frameworks, so they don't match.
 */
const genericMatcher = (query: string) => {
  const name = query.toLowerCase()
  const bundlePath = `/${name}.app/contents/macos/`
  return (exe: string) => basename(exe).toLowerCase() === name || exe.toLowerCase().includes(bundlePath)
}

/** The human name for an executable path, e.g. "Cursor" for /Applications/Cursor.app/Contents/MacOS/Cursor. */
export const nameOf = (exe: string): string =>
  KNOWN_APPS.find((app) => app.matches(exe))?.name ?? exe.match(BUNDLE_EXECUTABLE)?.[1] ?? basename(exe)

const ancestorsOf = (pid: number, byPid: ReadonlyMap<number, ProcessEntry>): number[] => {
  const ancestors: number[] = []
  const seen = new Set([pid])
  for (let next = byPid.get(pid)?.ppid; next !== undefined && !seen.has(next); next = byPid.get(next)?.ppid) {
    seen.add(next)
    ancestors.push(next)
  }
  return ancestors
}

const failure = (message: string) => Either.left(new WatchTargetError({ message }))

/**
 * Pick the process a `--while` query names. A PID names itself. An app name
 * prefers the nearest match among latte's own ancestors, so running latte from
 * inside a Claude Code session watches that session. Otherwise exactly one
 * top-level match must remain.
 */
export const resolveWatchTarget = (
  query: string,
  procs: readonly ProcessEntry[],
  selfPid: number,
): Either.Either<WatchTarget, WatchTargetError> => {
  const byPid = new Map(procs.map((p) => [p.pid, p]))
  const toTarget = (p: ProcessEntry): WatchTarget => ({ pid: p.pid, name: nameOf(p.exe) })

  const trimmed = query.trim()
  if (trimmed === "") return failure("--while needs an app name or PID, e.g. claude, cursor, 4242.")
  if (/^\d+$/.test(trimmed)) {
    const proc = byPid.get(Number(trimmed))
    return proc ? Either.right(toTarget(proc)) : failure(`No process with PID ${trimmed} is running.`)
  }

  const known = KNOWN_APPS.find((app) => app.queries.includes(trimmed.toLowerCase()))
  const matches = known?.matches ?? genericMatcher(trimmed)
  const displayName = known?.name ?? trimmed

  const found = procs.filter((p) => p.pid !== selfPid && matches(p.exe))
  if (found.length === 0) {
    return failure(`${displayName} isn't running. Open it first, or pass its PID.`)
  }

  const matched = new Set(found.map((p) => p.pid))
  const enclosing = ancestorsOf(selfPid, byPid).find((pid) => matched.has(pid))
  if (enclosing !== undefined) return Either.right(toTarget(byPid.get(enclosing)!))

  const topLevel = found.filter((p) => !ancestorsOf(p.pid, byPid).some((pid) => matched.has(pid)))
  if (topLevel.length === 1) return Either.right(toTarget(topLevel[0]!))

  return failure(
    [
      `Several ${displayName} processes are running:`,
      ...topLevel.map((p) => `  ${p.pid}  ${p.exe}`),
      `Run latte from inside the session you mean, or pass a PID, e.g. latte on --while ${topLevel[0]!.pid}.`,
    ].join("\n"),
  )
}
