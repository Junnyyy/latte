# Status

Status tells the user whether a `caffeinate` is running, which sleep modes it holds, how long it has run, and how long remains.

## Sub-features

- `status-idle` reports that nothing is running.
- `status-indefinite` reports modes, elapsed time, and `Duration: indefinite`.
- `status-timed` reports modes, elapsed time, and `Remaining:`.
- `status-root-notty` shows the same report for bare `latte` when stderr is not a terminal.

## How to get to it (user POV)

- Run `latte status`.
- Run `latte` with output piped or redirected, so stderr is not a terminal.

## Driving it with latte-verify

Preconditions:

- Baseline preconditions from the index hold.

- **Idle.** Run `V cli status-idle -- status`. stdout reads `☕ No caffeinate running` and exit is `0`.
- **Bare latte without a TTY.** Run `V cli root-notty --`. stdout matches the idle report, and no TUI frame is drawn.
- **Indefinite.** Run `V cli start -- on`, then `V cli status-on -- status`. stdout reads `Active — preventing sleep`, `Modes: idle, disk, system (AC), wake display`, `Running for:`, and `Duration: indefinite`.
- **Timed.** Run `V cli start -- 2m`, then `V cli status-timed -- status`. stdout shows `Remaining:` under `2m`. `caffeinate-after.txt` shows `caffeinate -imsu -t 120`.
- **Clean up.** Run `V cleanup`.

## Gotchas

- Status reads the first PID from `pgrep -x caffeinate`. With a foreign `caffeinate` alive it reports that process, so `doctor` must report `mutating: safe` before you trust the output.
- `Running for` comes from the `ps` start time, which has one-second resolution.
