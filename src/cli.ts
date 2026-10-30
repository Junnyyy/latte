import { Command, Options } from "@effect/cli"
import { Either, Option } from "effect"
import { offHandler } from "./commands/off.ts"
import { startHandler } from "./commands/start.ts"
import { statusHandler } from "./commands/status.ts"
import { tuiHandler } from "./commands/tui.ts"
import { fail } from "./utils/exit.ts"
import { toSelection } from "./utils/resolveFlags.ts"
import pkg from "../package.json"

const onCommand = Command.make(
  "on",
  {
    screen: Options.boolean("screen", { aliases: ["d"] }).pipe(
      Options.withDescription("Keep the screen on too"),
    ),
    flags: Options.text("flags").pipe(
      Options.withDescription("Advanced: exact caffeinate flags, e.g. dims. Replaces the preset."),
      Options.optional,
    ),
    watch: Options.text("while").pipe(
      Options.withDescription("Stay awake until this app or PID exits, e.g. claude, cursor, 4242"),
      Options.optional,
    ),
  },
  ({ screen, flags, watch }) =>
    Either.match(toSelection({ screen, flags: Option.getOrUndefined(flags) }), {
      onLeft: (e) => fail(e.message),
      onRight: (selection) => startHandler({ selection, watch: Option.getOrUndefined(watch) }),
    }),
)

const offCommand = Command.make(
  "off",
  {},
  () => offHandler(),
)

const statusCommand = Command.make(
  "status",
  {},
  () => statusHandler(),
)

// --- Root command ---

const rootCommand = Command.make(
  "latte",
  {},
  () =>
    // If stderr is a TTY, launch interactive TUI; otherwise show status
    process.stderr.isTTY ? tuiHandler() : statusHandler(),
)

const command = rootCommand.pipe(
  Command.withSubcommands([onCommand, offCommand, statusCommand]),
)

// --- Export CLI runner ---

export const cli = Command.run(command, {
  name: "latte",
  version: pkg.version,
})
