import React, { useState } from "react"
import { Box, Text, useInput } from "ink"

interface Props {
  label: string
  /** Matches one typed character the prompt keeps. */
  accepts: RegExp
  hint?: string
  onSubmit: (value: string) => void
  onCancel: () => void
  error?: string | null
}

export const TextPrompt: React.FC<Props> = ({ label, accepts, hint, onSubmit, onCancel, error }) => {
  const [value, setValue] = useState("")
  // The error describes this value, so editing the input hides it.
  const [submitted, setSubmitted] = useState<string | null>(null)

  useInput((input, key) => {
    if (key.escape) {
      onCancel()
      return
    }

    if (key.return) {
      const trimmed = value.trim()
      if (trimmed.length > 0) {
        setSubmitted(trimmed)
        onSubmit(trimmed)
      }
      return
    }

    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1))
      return
    }

    if (input && accepts.test(input)) {
      setValue((v) => v + input)
    }
  })

  return (
    <Box marginTop={1} flexDirection="column">
      <Box gap={1}>
        <Text>{label}</Text>
        <Text bold>{value}</Text>
        <Text dimColor>█</Text>
      </Box>
      {hint && <Text dimColor>{hint}</Text>}
      {error && value.trim() === submitted && (
        <Text color="red">{error}</Text>
      )}
      <Box gap={2} marginTop={0}>
        <Box gap={0}>
          <Text bold color="cyan">[enter]</Text>
          <Text dimColor> start</Text>
        </Box>
        <Box gap={0}>
          <Text bold color="cyan">[esc]</Text>
          <Text dimColor> cancel</Text>
        </Box>
      </Box>
    </Box>
  )
}
