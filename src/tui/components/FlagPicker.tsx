import React from "react"
import { Box, Text, useInput } from "ink"
import { FLAGS, FLAG_DESCRIPTIONS, isFlag, type Flag } from "../../utils/flags.ts"

interface Props {
  flags: ReadonlySet<Flag>
  onToggle: (flag: Flag) => void
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
    if (isFlag(input)) {
      onToggle(input)
    }
  })

  return (
    <Box marginTop={1} flexDirection="column">
      <Box gap={2}>
        <Text>Flags:</Text>
        {FLAGS.map((f) => (
          <Box key={f} gap={0}>
            <Text bold color="cyan">[{f}]</Text>
            <Text dimColor> {FLAG_DESCRIPTIONS[f]}</Text>
            {flags.has(f) ? <Text color="green"> ●</Text> : <Text dimColor> ○</Text>}
          </Box>
        ))}
      </Box>
      <Box gap={2} marginTop={1}>
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
