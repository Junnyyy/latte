# Timed sessions

A timed session keeps the Mac awake for a duration such as `30m`, `2h`, or `90s`, then `caffeinate` exits by itself.

## Sub-features

- `timed-start` starts `caffeinate -is -t <seconds>` and prints the duration.
- `timed-zero` rejects `0m` with `Duration must be greater than zero`.
- `timed-bad-unit` rejects a word like `5x` as an unknown subcommand.
- `timed-replace-prompt` asks `Kill existing and start <duration> timer? (y/n)` at a terminal.
- `timed-expiry` shows status as idle after the timer ends.

## How to get to it (user POV)

- Run `latte <number><s|m|h>`, optionally followed by `--screen` or `--flags <letters>`.

## Driving it with latte-verify

Preconditions:

- Baseline preconditions from the index hold.

- **Start.** Run `V cli timed -- 2m`. stdout reads `☕ On for 2m — Mac stays awake, screen can sleep`. `caffeinate-after.txt` shows `caffeinate -is -t 120`.
- **Confirm state.** Run `V cli status-timed -- status`. stdout shows `Remaining:` counting down from `2m`.
- **Replace at a terminal.** Run `V pty replace 'wait:(y/n)' send:y 'wait:On for 2m' -- 2m --screen`. The transcript shows `Kill existing and start 2m timer? (y/n) y`. `caffeinate-after.txt` shows `caffeinate -dis -t 120` with a new PID.
- **Zero.** Run `V cli zero -- 0m`. stderr reads `Duration must be greater than zero`, exit is `1`, and `caffeinate-after.txt` is unchanged.
- **Bad unit.** Run `V cli bad-unit -- 5x`. stderr reads `Invalid subcommand for latte - use one of 'on', 'off', 'status'`, and exit is `1`.
- **Expiry.** Run `V cli short -- 5s`, then `V pty wait sleep:6 'wait:Inactive' send:q`. The TUI opens with `○ Inactive — no caffeinate running`.
- **Clean up.** Run `V cleanup`.

## Gotchas

- `latte` sends only an argument that matches `^\d+(s|m|h)$` to the timed path. `5x` and `30 m` fall through to subcommand parsing, so their error is the subcommand error, not a duration error.
- Options after a duration go through latte's own parser, not `@effect/cli`. Prove option behavior on both `on` and the timed path. See [flags.md](./flags.md).
