import React, { useState, useEffect, useCallback, useRef } from "react"
import { Box, Text, useInput, useApp } from "ink"
import type { CaffeinateInfo, TuiResult, WatchResult } from "../types/index.ts"
import type { StartSpec } from "../services/Caffeinate.ts"
import { StatusDisplay } from "./components/StatusDisplay.tsx"
import { ActionBar } from "./components/ActionBar.tsx"
import { ConfirmDialog } from "./components/ConfirmDialog.tsx"
import { TextPrompt } from "./components/TextPrompt.tsx"
import { FlagPicker } from "./components/FlagPicker.tsx"
import { parseDuration } from "../utils/duration.ts"
import { describeFlags, flagSetToString, type Flag } from "../utils/flags.ts"
import { initialFlagSet } from "../utils/resolveFlags.ts"
import { Effect } from "effect"

type Mode = "idle" | "confirm" | "duration-input" | "watch-input" | "flag-picker" | "error"

type PendingStart = Omit<StartSpec, "flags">

export interface Props {
  initialInfo: CaffeinateInfo | null
  onStart: (spec: StartSpec) => Promise<TuiResult>
  onStop: () => Promise<TuiResult>
  onDetect: () => Promise<CaffeinateInfo | null>
  onResolveWatch: (query: string) => Promise<WatchResult>
}

const toggle = (flags: ReadonlySet<Flag>, flag: Flag): Set<Flag> => {
  const next = new Set(flags)
  if (next.has(flag)) next.delete(flag)
  else next.add(flag)
  return next
}

export const App: React.FC<Props> = ({ initialInfo, onStart, onStop, onDetect, onResolveWatch }) => {
  const { exit } = useApp()
  const [info, setInfo] = useState<CaffeinateInfo | null>(initialInfo)
  const [mode, setMode] = useState<Mode>("idle")
  const [elapsed, setElapsed] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pendingStart, setPendingStart] = useState<PendingStart>({})
  const [promptError, setPromptError] = useState<string | null>(null)
  const activeWatchSubmit = useRef<symbol | null>(null)
  const startInFlight = useRef(false)
  const [sessionFlags, setSessionFlags] = useState<Set<Flag>>(() => initialFlagSet())
  const [pickerFlags, setPickerFlags] = useState<Set<Flag>>(new Set())

  // Tick elapsed every second, re-detect process liveness
  useEffect(() => {
    if (!info) return

    const interval = setInterval(async () => {
      const current = await onDetect()
      if (!current) {
        setInfo(null)
        setElapsed(0)
      } else {
        setInfo(current)
        const secs = Math.floor((Date.now() - current.startTime.getTime()) / 1000)
        setElapsed(secs)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [info, onDetect])

  // Initialize elapsed on mount / info change
  useEffect(() => {
    if (info) {
      setElapsed(Math.floor((Date.now() - info.startTime.getTime()) / 1000))
    } else {
      setElapsed(0)
    }
  }, [info])

  const handleStart = useCallback(async (start: PendingStart = {}) => {
    if (startInFlight.current) return
    startInFlight.current = true
    try {
      const result = await onStart({ ...start, flags: flagSetToString(sessionFlags) })
      if (result.ok) {
        setInfo(result.info)
        setMode("idle")
      } else {
        setErrorMessage(result.error)
        setMode("error")
      }
    } catch (e: unknown) {
      setErrorMessage(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`)
      setMode("error")
    } finally {
      startInFlight.current = false
    }
  }, [onStart, sessionFlags])

  const handleStop = useCallback(async () => {
    try {
      const result = await onStop()
      setInfo(null)
      setMode("idle")
      if (!result.ok) {
        // Process was already gone — not a real error for the user
      }
    } catch (e: unknown) {
      setErrorMessage(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`)
      setMode("error")
    }
  }, [onStop])

  const handleDurationSubmit = useCallback((value: string) => {
    const result = Effect.runSyncExit(parseDuration(value))
    if (result._tag === "Failure") {
      setPromptError(`"${value}" is not a valid duration (use e.g. 30m, 2h, 90s)`)
      return
    }

    const seconds = result.value
    setPromptError(null)

    if (info) {
      setPendingStart({ duration: seconds })
      setMode("confirm")
    } else {
      handleStart({ duration: seconds })
    }
  }, [info, handleStart])

  const handleWatchSubmit = useCallback(async (query: string) => {
    if (activeWatchSubmit.current !== null) return
    const submit = Symbol(query)
    activeWatchSubmit.current = submit
    try {
      const result = await onResolveWatch(query)
      if (activeWatchSubmit.current !== submit) return

      if (!result.ok) {
        setPromptError(result.error)
        return
      }
      setPromptError(null)

      if (info) {
        setPendingStart({ watch: result.target })
        setMode("confirm")
      } else {
        await handleStart({ watch: result.target })
      }
    } finally {
      if (activeWatchSubmit.current === submit) activeWatchSubmit.current = null
    }
  }, [info, onResolveWatch, handleStart])

  // Flag picker handlers
  const handleFlagToggle = useCallback((flag: Flag) => {
    setPickerFlags((prev) => toggle(prev, flag))
  }, [])

  const handleFlagConfirm = useCallback(() => {
    setSessionFlags(new Set(pickerFlags))
    setMode("idle")
  }, [pickerFlags])

  const handleFlagCancel = useCallback(() => {
    setMode("idle")
  }, [])

  const handleFlagReset = useCallback(() => {
    setPickerFlags(initialFlagSet())
  }, [])

  useInput((input, key) => {
    // Dismiss error on any key
    if (mode === "error") {
      setErrorMessage(null)
      setMode("idle")
      return
    }

    // Don't handle keys in sub-modes (they have their own handlers)
    if (mode !== "idle") return

    if (input === "q" || (input === "c" && key.ctrl)) {
      exit()
      return
    }

    if (input === "o") {
      if (info) {
        setPendingStart({})
        setMode("confirm")
      } else {
        handleStart()
      }
    }

    if (input === "x") {
      if (info) {
        handleStop()
      }
    }

    if (input === "t") {
      setPromptError(null)
      setMode("duration-input")
    }

    if (input === "w") {
      setPromptError(null)
      setMode("watch-input")
    }

    if (input === "s") {
      setSessionFlags((prev) => toggle(prev, "d"))
    }

    if (input === "f") {
      setPickerFlags(new Set(sessionFlags))
      setMode("flag-picker")
    }
  })

  const handleConfirm = useCallback(() => {
    handleStart(pendingStart)
  }, [handleStart, pendingStart])

  const handleCancel = useCallback(() => {
    setPendingStart({})
    setMode("idle")
  }, [])

  const handlePromptCancel = useCallback(() => {
    activeWatchSubmit.current = null
    setPromptError(null)
    setMode("idle")
  }, [])

  const nextStart = describeFlags(flagSetToString(sessionFlags))
  const nextStartDiffers = info !== null && nextStart !== describeFlags(info.flags)

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold>☕ latte</Text>
      </Box>

      <StatusDisplay info={info} elapsed={elapsed} />

      {mode === "idle" && nextStartDiffers && (
        <Box marginTop={1}>
          <Text color="yellow">Next start: {nextStart}. Press o, t, or w to apply.</Text>
        </Box>
      )}

      {mode === "confirm" && (
        <ConfirmDialog
          message="Caffeinate is already running. Replace?"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {mode === "duration-input" && (
        <TextPrompt
          label="Duration:"
          acceptsChar={/^[a-zA-Z0-9]$/}
          onSubmit={handleDurationSubmit}
          onCancel={handlePromptCancel}
          error={promptError}
        />
      )}

      {mode === "watch-input" && (
        <TextPrompt
          label="Stay awake while:"
          acceptsChar={/^[\w .-]$/}
          hint="An app name or PID, e.g. claude, cursor, 4242"
          onSubmit={handleWatchSubmit}
          onCancel={handlePromptCancel}
          error={promptError}
        />
      )}

      {mode === "flag-picker" && (
        <FlagPicker
          flags={pickerFlags}
          onToggle={handleFlagToggle}
          onConfirm={handleFlagConfirm}
          onCancel={handleFlagCancel}
          onReset={handleFlagReset}
        />
      )}

      {mode === "error" && errorMessage && (
        <Box marginTop={1} flexDirection="column">
          <Text color="red">{errorMessage}</Text>
          <Text dimColor>Press any key to continue</Text>
        </Box>
      )}

      {mode !== "flag-picker" && (
        <ActionBar
          actions={[
            { key: "o", label: "on" },
            { key: "x", label: "off" },
            { key: "t", label: "timed" },
            { key: "w", label: "while" },
            { key: "s", label: "screen", toggled: sessionFlags.has("d") },
            { key: "f", label: "advanced" },
            { key: "q", label: "quit" },
          ]}
        />
      )}
    </Box>
  )
}
