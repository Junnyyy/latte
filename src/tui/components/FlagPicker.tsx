import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import { FLAGS, FLAG_DESCRIPTIONS, isFlag, toggleFlag, type Flag } from "../../utils/flags.ts"
import { initialFlagSet } from "../../utils/resolveFlags.ts"

interface Props {
  initial: ReadonlySet<Flag>
  onApply: (flags: ReadonlySet<Flag>) => void
  onCancel: () => void
}

export const FlagPicker: React.FC<Props> = ({ initial, onApply, onCancel }) => {
  const [draft, setDraft] = useState(initial)

  useInput((input, key) => {
    if (key.return) {
      onApply(draft)
      return
    }
    if (key.escape) {
      onCancel()
      return
    }
    if (input === "r") {
      setDraft(initialFlagSet())
      return
    }
    if (isFlag(input)) {
      setDraft((current) => toggleFlag(current, input))
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
            {draft.has(f) ? <Text color="green"> ●</Text> : <Text dimColor> ○</Text>}
          </Box>
        ))}
      </Box>
      <Box gap={2} marginTop={1}>
        <Box gap={0}>
          <Text bold color="cyan">[enter]</Text>
          <Text dimColor> apply</Text>
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
