import React, { useState } from "react"
import { Box, Text, useInput, useApp } from "ink"
import type { CaffeinateInfo, TuiResult, WatchResult } from "../types/index.ts"
import type { StartSpec } from "../services/Caffeinate.ts"
import { StatusDisplay } from "./components/StatusDisplay.tsx"
import { ActionBar, type Action } from "./components/ActionBar.tsx"
import { TextPrompt } from "./components/TextPrompt.tsx"
import { FlagPicker } from "./components/FlagPicker.tsx"
import { toggleFlag } from "../utils/flags.ts"
import { timedRequest, whileRequest } from "./changes.ts"
import { createSessionStore, useSessionStore } from "./sessionStore.ts"

type Mode = "idle" | "timed" | "while" | "picker"

export interface Props {
  initialInfo: CaffeinateInfo | null
  onStart: (spec: StartSpec) => Promise<TuiResult>
  onStop: () => Promise<TuiResult>
  onDetect: () => Promise<CaffeinateInfo | null>
  onResolveWatch: (query: string) => Promise<WatchResult>
}

interface KeyAction extends Action {
  run: () => void
}

const now = () => new Date()

export const App: React.FC<Props> = ({ initialInfo, onStart, onStop, onDetect, onResolveWatch }) => {
  const { exit } = useApp()
  const [store, { session, flags, error }] = useSessionStore(() =>
    createSessionStore({ start: onStart, stop: onStop, detect: onDetect, now }, initialInfo),
  )
  const [mode, setMode] = useState<Mode>("idle")
  const close = () => setMode("idle")

  const keys: KeyAction[] = [
    { key: "o", label: "on", run: () => store.submit({ kind: "on" }) },
    { key: "x", label: "off", dim: session === null, run: () => store.submit({ kind: "off" }) },
    { key: "t", label: "timed", run: () => setMode("timed") },
    { key: "w", label: "while", run: () => setMode("while") },
    { key: "s", label: "screen", toggled: flags.has("d"), run: () => store.setFlags((current) => toggleFlag(current, "d")) },
    { key: "f", label: "advanced", run: () => setMode("picker") },
    { key: "q", label: "quit", run: exit },
  ]

  useInput((input, key) => {
    // The error line clears on any key, in any mode, and the key still does its own action.
    store.dismissError()
    if (mode !== "idle") return
    if (input === "c" && key.ctrl) return exit()
    keys.find((action) => action.key === input)?.run()
  })

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold>☕ latte</Text>
      </Box>

      <StatusDisplay session={session} />

      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      {mode === "timed" && (
        <TextPrompt
          label="Duration:"
          acceptsChar={/^[a-zA-Z0-9]$/}
          hint="e.g. 30m, 2h, 90s"
          submit={(value) => store.submit(timedRequest(value))}
          onClose={close}
        />
      )}

      {mode === "while" && (
        <TextPrompt
          label="Stay awake while:"
          acceptsChar={/^[\w .-]$/}
          hint="An app name or PID, e.g. claude, cursor, 4242"
          submit={(query) => store.submit(onResolveWatch(query).then(whileRequest))}
          onClose={close}
        />
      )}

      {mode === "picker" ? (
        <FlagPicker
          initial={flags}
          onApply={(picked) => {
            store.setFlags(() => picked)
            close()
          }}
          onCancel={close}
        />
      ) : (
        <ActionBar actions={keys} />
      )}
    </Box>
  )
}
