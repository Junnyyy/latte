import { Effect } from "effect"
import { ProcessError } from "../errors/index.ts"

export class ProcessService extends Effect.Service<ProcessService>()("ProcessService", {
  sync: () => ({
    exec: (args: string[]) =>
      Effect.tryPromise({
        try: async () => {
          const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" })
          const exitCode = await proc.exited
          const stdout = await new Response(proc.stdout).text()
          const stderr = await new Response(proc.stderr).text()
          if (exitCode !== 0) {
            throw { exitCode, stderr, stdout }
          }
          return stdout
        },
        catch: (e) =>
          new ProcessError({
            command: args.join(" "),
            cause: e,
          }),
      }),

    /** Spawn a detached process that outlives the parent. Returns the PID. */
    spawnDetached: (args: string[]) =>
      Effect.try({
        try: () => {
          const proc = Bun.spawn(args, {
            stdout: "ignore",
            stderr: "ignore",
            stdin: "ignore",
          })
          // Unreference so the parent can exit without waiting
          proc.unref()
          return proc.pid
        },
        catch: (e) =>
          new ProcessError({
            command: args.join(" "),
            cause: e,
          }),
      }),
  }),
}) {}
