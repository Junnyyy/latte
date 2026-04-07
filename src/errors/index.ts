import { Data } from "effect"

export class CaffeinateSpawnError extends Data.TaggedError("CaffeinateSpawnError")<{
  message: string
  cause?: unknown
}> {}

export class NoCaffeinateError extends Data.TaggedError("NoCaffeinateError")<{}> {}

export class ProcessError extends Data.TaggedError("ProcessError")<{
  command: string
  cause: unknown
}> {}

export class DurationParseError extends Data.TaggedError("DurationParseError")<{
  input: string
  message: string
}> {}
