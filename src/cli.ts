import { Command } from "@effect/cli"
import { onHandler } from "./commands/on.ts"
import { offHandler } from "./commands/off.ts"
import { statusHandler } from "./commands/status.ts"
import { tuiHandler } from "./commands/tui.ts"
import pkg from "../package.json"

// --- Subcommands ---

const onCommand = Command.make(
  "on",
  {},
  () => onHandler(),
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
