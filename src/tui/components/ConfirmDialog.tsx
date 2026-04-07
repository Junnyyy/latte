import React from "react"
import { Box, Text, useInput } from "ink"

interface Props {
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog: React.FC<Props> = ({ message, onConfirm, onCancel }) => {
  useInput((input) => {
    if (input === "y" || input === "Y") {
      onConfirm()
    } else if (input === "n" || input === "N" || input === "q") {
      onCancel()
    }
  })

  return (
    <Box marginTop={1} flexDirection="column">
      <Text color="yellow">⚠ {message}</Text>
      <Box gap={2}>
        <Box gap={0}>
          <Text bold color="cyan">[y]</Text>
          <Text dimColor> confirm</Text>
        </Box>
        <Box gap={0}>
          <Text bold color="cyan">[n]</Text>
          <Text dimColor> cancel</Text>
        </Box>
      </Box>
    </Box>
  )
}
