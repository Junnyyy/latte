# Presets and flags

latte picks the sleep assertions for the user. The `awake` preset (`-is`) keeps the Mac awake and lets the screen sleep. The `screen` preset (`-dis`) keeps the screen on too. `LATTE_FLAGS` adds to either preset. `--flags` replaces the preset with exact `caffeinate` flags and ignores `LATTE_FLAGS`.

## Sub-features

- `flags-awake` is the default. latte prints `On — Mac stays awake, screen can sleep` and then `Closing the lid can still sleep your Mac.`
- `flags-screen` selects the screen preset with `--screen` or `-d` and prints `Mac and screen stay awake`.
- `flags-custom` runs exact flags with `--flags <letters>` or `--flags=<letters>`, with or without a leading dash. latte prints `custom flags -dm (display, disk)` and no lid line.
- `flags-env` adds the modes listed in `LATTE_FLAGS` to a preset. A preset plus `LATTE_FLAGS=-d` reads as the screen preset.
- `flags-env-invalid` warns on stderr about invalid characters in `LATTE_FLAGS` and ignores them.
- `flags-conflict` rejects `--screen` with `--flags`.
- `flags-invalid` rejects an unknown or missing `--flags` letter.
- `flags-unknown` rejects any other option, including the removed `--no-*` and mode flags, on both `latte on` and the duration path.

## How to get to it (user POV)

- Append `--screen` or `--flags <letters>` to `latte on` or `latte <duration>`.
- Export `LATTE_FLAGS` in the shell.
- Press `s` or open the advanced picker with `f` in the TUI. See [tui.md](./tui.md).

## Driving it with latte-verify

Preconditions:

- Baseline preconditions from the index hold.

- **Awake.** Run `V cli awake -- on`. stdout reads `☕ On — Mac stays awake, screen can sleep` and `Closing the lid can still sleep your Mac.`. `caffeinate-after.txt` shows `caffeinate -is`.
- **Screen.** Run `V cli screen -- 2m --screen`. stdout reads `☕ On for 2m — Mac and screen stay awake`. `caffeinate-after.txt` shows `caffeinate -dis -t 120`.
- **Confirm from status.** Run `V cli status -- status`. stdout reads `☕ Active — Mac and screen stay awake` and has no `Modes:` line.
- **Custom.** Run `V cli custom -- on --flags dm`. stdout reads `☕ On — custom flags -dm (display, disk)` with no lid line. `caffeinate-after.txt` shows `caffeinate -dm`.
- **Custom ignores env.** Run `LATTE_FLAGS=-u V cli custom-env -- 2m --flags=-im`. `caffeinate-after.txt` shows `caffeinate -im -t 120`.
- **Env adds.** Run `LATTE_FLAGS=-d V cli env -- 2m`. stdout reads `Mac and screen stay awake`. `caffeinate-after.txt` shows `caffeinate -dis -t 120`.
- **Env invalid.** Run `LATTE_FLAGS=-dz V cli env-invalid -- on`. stderr reads `latte: ignoring invalid characters in LATTE_FLAGS: z`. `caffeinate-after.txt` shows `caffeinate -dis`.
- **Conflict.** Run `V cli conflict -- 2m --screen --flags d`. stderr reads `--screen and --flags can't be combined. Add d to --flags to keep the screen on.`, exit is `1`, and `caffeinate-after.txt` is unchanged. `on --screen --flags d` prints the same.
- **Invalid letter.** Run `V cli bad-letter -- on --flags z`. stderr reads `Unknown flag letter "z" in --flags. Use any of d, i, m, s, u.` and exit is `1`.
- **Unknown option after a duration.** Run `V cli old-flag -- 2m --no-system`. stderr reads `Unknown option --no-system. Use --flags for exact caffeinate flags.` and exit is `1`.
- **Unknown option on `on`.** Run `V cli on-old-flag -- on --no-system`. stderr reads `Received unknown argument: '--no-system'` and exit is `1`.
- **Clean up.** Run `V cleanup`.

## Gotchas

- `caffeinate-after.txt` is the authority on which modes are held. The printed summary comes from the same flag string, but only the process shows what `caffeinate` received.
- The lid line depends on how the session was chosen, not on its flags. A preset widened by `LATTE_FLAGS=-m` prints `custom flags -ims (...)` and still prints the lid line.
- `cmd.txt` records `LATTE_FLAGS`. A stray export in the calling shell changes every preset result in this file.
- `@effect/cli` parses `latte on`, and latte's own parser reads the arguments after a duration. Their unknown-option errors differ. Prove each error path on both.
