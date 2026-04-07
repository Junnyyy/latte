import React, { useState, useEffect, useCallback } from "react"
import { Box, Text, useInput, useApp } from "ink"
import type { CaffeinateInfo, TuiResult } from "../types/index.ts"
import { StatusDisplay } from "./components/StatusDisplay.tsx"
import { ActionBar } from "./components/ActionBar.tsx"
import { ConfirmDialog } from "./components/ConfirmDialog.tsx"
import { DurationInput } from "./components/DurationInput.tsx"
import { parseDuration } from "../utils/duration.ts"
import { Effect } from "effect"

type Mode = "idle" | "confirm-on" | "confirm-timed" | "duration-input" | "error"

export interface Props {
  initialInfo: CaffeinateInfo | null
  onStart: (duration?: number) => Promise<TuiResult>
  onStop: () => Promise<TuiResult>
  onDetect: () => Promise<CaffeinateInfo | null>
}

const actions = [
  { key: "o", label: "on" },
  { key: "x", label: "off" },
  { key: "t", label: "timed" },
  { key: "q", label: "quit" },
]

export const App: React.FC<Props> = ({ initialInfo, onStart, onStop, onDetect }) => {
  const { exit } = useApp()
  const [info, setInfo] = useState<CaffeinateInfo | null>(initialInfo)
  const [mode, setMode] = useState<Mode>("idle")
  const [elapsed, setElapsed] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pendingDuration, setPendingDuration] = useState<number | undefined>(undefined)
  const [durationError, setDurationError] = useState<string | null>(null)

  // Tick elapsed every second, re-detect process liveness
  useEffect(() => {
    if (!info) return

    const interval = setInterval(async () => {
      const current = await onDetect()
      if (!current) {
        // Process died externally (or timed session expired)
        setInfo(null)
        setElapsed(0)
      } else {
        // Update info to reflect any external changes (flags, duration, PID)
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

  const handleStart = useCallback(async (duration?: number) => {
    try {
      const result = await onStart(duration)
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
    }
  }, [onStart])

  const handleStop = useCallback(async () => {
    try {
      const result = await onStop()
      // Always clear info — if stop failed, the process is likely already gone.
      // The desired state (no caffeinate) is achieved either way.
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
      setDurationError(`"${value}" is not a valid duration (use e.g. 30m, 2h, 90s)`)
      return
    }

    const seconds = result.value
    setDurationError(null)

    if (info) {
      // Existing caffeinate — need confirmation
      setPendingDuration(seconds)
      setMode("confirm-timed")
    } else {
      handleStart(seconds)
    }
  }, [info, handleStart])

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
        setPendingDuration(undefined)
        setMode("confirm-on")
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
      setDurationError(null)
      setMode("duration-input")
    }
  })

  // onStart already kills existing caffeinate before starting (via Effect.catchAll),
  // so handleConfirm just delegates directly — no separate stop needed.
  const handleConfirm = useCallback(() => {
    handleStart(pendingDuration)
  }, [handleStart, pendingDuration])

  const handleCancel = useCallback(() => {
    setPendingDuration(undefined)
    setMode("idle")
  }, [])

  const handleDurationCancel = useCallback(() => {
    setDurationError(null)
    setMode("idle")
  }, [])

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold>☕ latte</Text>
      </Box>

      <StatusDisplay info={info} elapsed={elapsed} />

      {(mode === "confirm-on" || mode === "confirm-timed") && (
        <ConfirmDialog
          message="Caffeinate is already running. Replace?"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {mode === "duration-input" && (
        <DurationInput
          onSubmit={handleDurationSubmit}
          onCancel={handleDurationCancel}
          error={durationError}
        />
      )}

      {mode === "error" && errorMessage && (
        <Box marginTop={1} flexDirection="column">
          <Text color="red">{errorMessage}</Text>
          <Text dimColor>Press any key to continue</Text>
        </Box>
      )}

      <ActionBar actions={actions} />
    </Box>
  )
}
