import { Command, Options } from "@effect/cli"
import { onHandler } from "./commands/on.ts"
import { offHandler } from "./commands/off.ts"
import { statusHandler } from "./commands/status.ts"
import { tuiHandler } from "./commands/tui.ts"
import pkg from "../package.json"

// --- Shared flag option definitions ---

const flagConfig = {
  display: Options.boolean("display", { aliases: ["d"] }),
  idle: Options.boolean("idle", { aliases: ["i"] }),
  disk: Options.boolean("disk", { aliases: ["m"] }),
  system: Options.boolean("system", { aliases: ["s"] }),
  wake: Options.boolean("wake", { aliases: ["u"] }),
  noDisplay: Options.boolean("no-display"),
  noIdle: Options.boolean("no-idle"),
  noDisk: Options.boolean("no-disk"),
  noSystem: Options.boolean("no-system"),
  noWake: Options.boolean("no-wake"),
}

/** Convert parsed @effect/cli boolean options to add/remove sets */
const toFlagSets = (opts: {
  display: boolean; idle: boolean; disk: boolean; system: boolean; wake: boolean
  noDisplay: boolean; noIdle: boolean; noDisk: boolean; noSystem: boolean; noWake: boolean
}): { adds: Set<string>; removes: Set<string> } => {
  const adds = new Set<string>()
  const removes = new Set<string>()

  if (opts.display) adds.add("d")
  if (opts.idle) adds.add("i")
  if (opts.disk) adds.add("m")
  if (opts.system) adds.add("s")
  if (opts.wake) adds.add("u")

  if (opts.noDisplay) removes.add("d")
  if (opts.noIdle) removes.add("i")
  if (opts.noDisk) removes.add("m")
  if (opts.noSystem) removes.add("s")
  if (opts.noWake) removes.add("u")

  return { adds, removes }
}

// --- Subcommands ---

const onCommand = Command.make(
  "on",
  { ...flagConfig },
  (opts) => {
    const { adds, removes } = toFlagSets(opts)
    return onHandler(adds, removes)
  },
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
