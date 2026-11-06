import React from "react"
import { Box, Text } from "ink"

export interface Action {
  key: string
  label: string
  toggled?: boolean
  dim?: boolean
}

interface Props {
  actions: Action[]
}

export const ActionBar: React.FC<Props> = ({ actions }) => (
  <Box marginTop={1} gap={2}>
    {actions.map((action) => (
      <Box key={action.key} gap={0}>
        <Text bold={!action.dim} color={action.dim ? undefined : "cyan"} dimColor={action.dim}>[{action.key}]</Text>
        <Text dimColor> {action.label}</Text>
        {action.toggled === true && <Text color="green"> ●</Text>}
        {action.toggled === false && <Text dimColor> ○</Text>}
      </Box>
    ))}
  </Box>
)
