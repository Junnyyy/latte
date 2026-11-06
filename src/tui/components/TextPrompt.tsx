import React, { useRef, useState } from "react"
import { Box, Text, useInput } from "ink"
import type { Ticket } from "../sessionStore.ts"

interface Props {
  label: string
  acceptsChar: RegExp
  hint?: string
  submit: (value: string) => Ticket
  onClose: () => void
}

export const TextPrompt: React.FC<Props> = ({ label, acceptsChar, hint, submit, onClose }) => {
  const [value, setValue] = useState("")
  const [refusal, setRefusal] = useState<string | null>(null)
  const pending = useRef<Ticket | null>(null)

  useInput((input, key) => {
    if (key.escape) {
      pending.current?.cancel()
      pending.current = null
      onClose()
      return
    }

    if (key.return) {
      const trimmed = value.trim()
      if (trimmed.length === 0 || pending.current) return
      setRefusal(null)
      const ticket = submit(trimmed)
      pending.current = ticket
      ticket.done.then((outcome) => {
        if (pending.current !== ticket) return
        pending.current = null
        if (outcome.kind === "refused") setRefusal(outcome.reason)
        else onClose()
      })
      return
    }

    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1))
      setRefusal(null)
      return
    }

    if (input && acceptsChar.test(input)) {
      setValue((v) => v + input)
      setRefusal(null)
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
      {refusal && <Text color="red">{refusal}</Text>}
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
