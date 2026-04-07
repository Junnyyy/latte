import React from "react"
import { Box, Text } from "ink"
import type { CaffeinateInfo } from "../../types/index.ts"
import { describeFlags } from "../../utils/flags.ts"
import { formatDuration } from "../../utils/duration.ts"

interface Props {
  info: CaffeinateInfo | null
  elapsed: number
}

export const StatusDisplay: React.FC<Props> = ({ info, elapsed }) => {
  if (!info) {
    return (
      <Box flexDirection="column">
        <Text dimColor>○ Inactive — no caffeinate running</Text>
      </Box>
    )
  }

  const remaining = info.duration !== null
    ? Math.max(0, info.duration - elapsed)
    : null

  const remainingColor = remaining !== null
    ? remaining < 60
      ? "red"
      : info.duration !== null && remaining < info.duration * 0.1
        ? "yellow"
        : undefined
    : undefined

  return (
    <Box flexDirection="column">
      <Text color="green">● Active — preventing sleep</Text>
      <Text>  {describeFlags(info.flags)}</Text>
      <Text>  Running for {formatDuration(elapsed)}</Text>
      {remaining !== null ? (
        <Text>  Remaining: <Text color={remainingColor}>{formatDuration(remaining)}</Text></Text>
      ) : (
        <Text dimColor>  Duration: indefinite</Text>
      )}
    </Box>
  )
}
