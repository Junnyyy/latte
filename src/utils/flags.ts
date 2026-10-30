export type Flag = "d" | "i" | "m" | "s" | "u"

export const FLAG_DESCRIPTIONS: Record<Flag, string> = {
  d: "display",
  i: "idle",
  m: "disk",
  s: "system (AC)",
  u: "user active",
}

export const FLAGS = Object.keys(FLAG_DESCRIPTIONS) as Flag[]

export const isFlag = (char: string): char is Flag => char in FLAG_DESCRIPTIONS

export const PRESETS = {
  awake: { flags: new Set<Flag>(["i", "s"]), summary: "Mac stays awake, screen can sleep" },
  screen: { flags: new Set<Flag>(["d", "i", "s"]), summary: "Mac and screen stay awake" },
}

export type Preset = keyof typeof PRESETS

/** No preset holds a lid-close assertion, and caffeinate has none to offer. */
export const PRESET_LID_NOTE = "Closing the lid can still sleep your Mac."

export type Selection =
  | { kind: "preset"; preset: Preset }
  | { kind: "custom"; flags: ReadonlySet<Flag> }

/** e.g. Set(["s", "d", "i"]) → "-dis". Returns "" for an empty set. */
export const flagSetToString = (flags: ReadonlySet<Flag>): string => {
  const sorted = [...flags].sort()
  return sorted.length > 0 ? `-${sorted.join("")}` : ""
}

const sameFlags = (a: ReadonlySet<Flag>, b: ReadonlySet<Flag>): boolean =>
  a.size === b.size && [...a].every((f) => b.has(f))

/**
 * Describe a caffeinate flag string such as "-is" for people.
 * A flag set equal to a preset reads as that preset's summary, in any order.
 * Any other set reads as "custom flags -dm (display, disk)".
 * A string with an unknown letter is returned unchanged.
 */
export const describeFlags = (flagString: string): string => {
  const letters = flagString.replace(/^-/, "").split("")
  if (!letters.every(isFlag)) return flagString

  const flags = new Set(letters)
  const preset = Object.values(PRESETS).find((p) => sameFlags(p.flags, flags))
  if (preset) return preset.summary
  if (flags.size === 0) return "no flags"

  const sorted = [...flags].sort()
  return `custom flags ${flagSetToString(flags)} (${sorted.map((f) => FLAG_DESCRIPTIONS[f]).join(", ")})`
}
