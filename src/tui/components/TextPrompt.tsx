import React, { useState } from "react"
import { Box, Text, useInput } from "ink"

interface Props {
  label: string
  acceptsChar: RegExp
  hint?: string
  onSubmit: (value: string) => void
  onCancel: () => void
  error?: string | null
}

export const TextPrompt: React.FC<Props> = ({ label, acceptsChar, hint, onSubmit, onCancel, error }) => {
  const [value, setValue] = useState("")
  const [editedSinceSubmit, setEditedSinceSubmit] = useState(false)

  useInput((input, key) => {
    if (key.escape) {
      onCancel()
      return
    }

    if (key.return) {
      const trimmed = value.trim()
      if (trimmed.length > 0) {
        setEditedSinceSubmit(false)
        onSubmit(trimmed)
      }
      return
    }

    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1))
      setEditedSinceSubmit(true)
      return
    }

    if (input && acceptsChar.test(input)) {
      setValue((v) => v + input)
      setEditedSinceSubmit(true)
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
      {error && !editedSinceSubmit && (
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
