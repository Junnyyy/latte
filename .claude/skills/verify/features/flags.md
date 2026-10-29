# Sleep flags

Flags choose which sleep assertions `caffeinate` holds. The defaults are idle, disk, system, and wake (`-imsu`). `LATTE_FLAGS` adds to the defaults, command-line flags add or remove on top, and latte suggests `LATTE_FLAGS` when a command-line flag adds something new.

## Sub-features

- `flags-add` adds a mode with `--display`, `--idle`, `--disk`, `--system`, `--wake`, or the short forms `-d`, `-i`, `-m`, `-s`, `-u`.
- `flags-remove` removes a mode with `--no-display`, `--no-idle`, `--no-disk`, `--no-system`, or `--no-wake`.
- `flags-env` adds the modes listed in `LATTE_FLAGS`.
- `flags-env-invalid` warns on stderr about invalid characters in `LATTE_FLAGS` and ignores them.
- `flags-tip` prints a `Tip: add export LATTE_FLAGS=...` line only for flags that are not already in the defaults or `LATTE_FLAGS`.

## How to get to it (user POV)

- Append flags to `latte on` or `latte <duration>`.
- Export `LATTE_FLAGS` in the shell.
- Toggle flags in the TUI picker. See [tui.md](./tui.md).

## Driving it with latte-verify

Preconditions:

- Baseline preconditions from the index hold.

- **Add with tip.** Run `V cli add -- on --display`. stdout reads `Caffeinate started` and ``Tip: add `export LATTE_FLAGS="-d"` to your shell profile to always use this flag.``. `caffeinate-after.txt` shows `caffeinate -dimsu`.
- **Confirm modes.** Run `V cli status -- status`. stdout reads `Modes: display, idle, disk, system (AC), wake display`.
- **Remove.** Run `V cli remove -- on --no-wake`. `caffeinate-after.txt` shows `caffeinate -ims`.
- **Env adds, no tip.** Run `LATTE_FLAGS=-d V cli env -- 2m`. `caffeinate-after.txt` shows `caffeinate -dimsu -t 120`, and stdout has no `Tip:` line.
- **Env invalid.** Run `LATTE_FLAGS=-dz V cli env-invalid -- on -d`. stderr reads `latte: ignoring invalid characters in LATTE_FLAGS: z`. `caffeinate-after.txt` shows `caffeinate -dimsu`.
- **Timed path flags.** Run `V cli timed-flags -- 2m --no-disk`. `caffeinate-after.txt` shows `caffeinate -isu -t 120`.
- **Clean up.** Run `V cleanup`.

## Gotchas

- `caffeinate-after.txt` is the authority on which modes are held. latte's printed messages do not echo the final flag string.
- `cmd.txt` records `LATTE_FLAGS`. A stray export in the calling shell changes every result in this file.
