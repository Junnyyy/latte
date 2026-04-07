import React from "react"
import { Box, Text } from "ink"

interface Action {
  key: string
  label: string
}

interface Props {
  actions: Action[]
}

export const ActionBar: React.FC<Props> = ({ actions }) => (
  <Box marginTop={1} gap={2}>
    {actions.map((action) => (
      <Box key={action.key} gap={0}>
        <Text bold color="cyan">[{action.key}]</Text>
        <Text dimColor> {action.label}</Text>
      </Box>
    ))}
  </Box>
)
