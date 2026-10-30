# latte verification map

This directory is the maintained source for verifying latte's user-facing behavior. Read this index, then use the matching feature file as the recipe. The `latte-verify` commands are documented in [`../SKILL.md`](../SKILL.md).

## Baseline preconditions

- A run dir from `latte-verify new` holds a binary built by `latte-verify build`.
- `latte-verify doctor` exits 0 and reports `mutating: safe`.
- No `caffeinate` is running unless the recipe starts one.
- `LATTE_FLAGS` is unset unless the recipe sets it.

## Driving conventions

- Write `V` for `.claude/skills/verify/latte-verify` and prefix every call with `LATTE_VERIFY_RUN=<run dir>`.
- Use `cli` for non-interactive paths and `pty` for anything that reads the keyboard.
- Prefer timed sessions such as `2m` when a recipe only needs some running `caffeinate`. A stranded timed process expires by itself.
- Match on the visible strings quoted in each recipe. They are the stable handles.
- Run `V cleanup` at the end of each recipe that starts `caffeinate`.

## Proof and skip reporting

- CLI proof cites `cmd.txt`, `stdout.txt`, `stderr.txt`, `exit.txt`, and `caffeinate-after.txt`.
- TUI proof cites the transcript frames before and after each keystroke, plus `caffeinate-after.txt`.
- A mutation is proven only when a second read, `V cli status -- status` or a later TUI frame, shows the new state.
- Record the feature ID and the entry point with every artifact.
- When `doctor` reports a foreign `caffeinate`, report the mutating sub-features as blocked with the PID. Do not report them as verified through a read-only path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with latte-verify`, and `Gotchas`. The drive section starts with `Preconditions:` and pairs each user action with an exact command and observable result.

## Features

- [Status](./status.md) covers `latte status` and bare `latte` without a terminal.
- [On and off](./on-off.md) covers indefinite sessions, stopping, and replacing a running session.
- [Timed sessions](./timed.md) covers `latte <duration>`, invalid durations, and the replace prompt.
- [Presets and flags](./flags.md) covers the `awake` and `screen` presets, `--screen`, `--flags`, `LATTE_FLAGS`, and the option errors.
- [Interactive TUI](./tui.md) covers the Ink dashboard and its `o`, `x`, `t`, `s`, `f`, and `q` keys.
