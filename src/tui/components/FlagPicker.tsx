import React from "react"
import { Box, Text, useInput } from "ink"
import { VALID_FLAGS } from "../../utils/resolveFlags.ts"

const FLAG_LABELS: Record<string, string> = {
  d: "display",
  i: "idle",
  m: "disk",
  s: "system",
  u: "wake",
}

interface Props {
  flags: Set<string>
  onToggle: (flag: string) => void
  onConfirm: () => void
  onCancel: () => void
  onReset: () => void
}

export const FlagPicker: React.FC<Props> = ({ flags, onToggle, onConfirm, onCancel, onReset }) => {
  useInput((input, key) => {
    if (key.return) {
      onConfirm()
      return
    }
    if (key.escape) {
      onCancel()
      return
    }
    if (input === "r") {
      onReset()
      return
    }
    if (VALID_FLAGS.has(input)) {
      onToggle(input)
    }
  })

  const flagEntries = [...VALID_FLAGS].sort()

  return (
    <Box marginTop={1} flexDirection="column">
      <Box gap={2}>
        <Text>Flags:</Text>
        {flagEntries.map((f) => (
          <Box key={f} gap={0}>
            <Text bold color="cyan">[{f}]</Text>
            <Text dimColor> {FLAG_LABELS[f]}</Text>
            {flags.has(f) && <Text color="green"> ●</Text>}
          </Box>
        ))}
      </Box>
      <Box gap={2} marginTop={0}>
        <Box gap={0}>
          <Text bold color="cyan">[enter]</Text>
          <Text dimColor> done</Text>
        </Box>
        <Box gap={0}>
          <Text bold color="cyan">[r]</Text>
          <Text dimColor> reset</Text>
        </Box>
        <Box gap={0}>
          <Text bold color="cyan">[esc]</Text>
          <Text dimColor> cancel</Text>
        </Box>
      </Box>
    </Box>
  )
}
