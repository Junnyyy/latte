import React, { useState } from "react"
import { Box, Text, useInput } from "ink"

interface Props {
  onSubmit: (value: string) => void
  onCancel: () => void
  error?: string | null
}

export const DurationInput: React.FC<Props> = ({ onSubmit, onCancel, error }) => {
  const [value, setValue] = useState("")

  useInput((input, key) => {
    if (key.escape) {
      onCancel()
      return
    }

    if (key.return) {
      if (value.trim().length > 0) {
        onSubmit(value.trim())
      }
      return
    }

    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1))
      return
    }

    // Only allow alphanumeric input
    if (input && /^[a-zA-Z0-9]$/.test(input)) {
      setValue((v) => v + input)
    }
  })

  return (
    <Box marginTop={1} flexDirection="column">
      <Box gap={1}>
        <Text>Duration:</Text>
        <Text bold>{value}</Text>
        <Text dimColor>█</Text>
      </Box>
      {error && (
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
