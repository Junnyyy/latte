# On and off

On starts an indefinite `caffeinate` with latte's default modes. Off stops it. Starting while a session already runs replaces that session, after a prompt when the user is at a terminal.

## Sub-features

- `on-start` starts `caffeinate -imsu` and prints `Caffeinate started`.
- `on-replace-auto` replaces a running session without asking when stdin is not a terminal.
- `on-replace-prompt` asks `Kill existing and start indefinite? (y/n)` at a terminal. `n` keeps the old session.
- `off-running` stops the session and prints `Caffeinate stopped`.
- `off-idle` prints `No caffeinate running` and exits `0`.

## How to get to it (user POV)

- Run `latte on`.
- Run `latte off`.

## Driving it with latte-verify

Preconditions:

- Baseline preconditions from the index hold.

- **Start.** Run `V cli on -- on`. stdout reads `☕ Caffeinate started — preventing sleep`. `caffeinate-after.txt` shows `caffeinate -imsu` with no `-t`.
- **Confirm state.** Run `V cli status-on -- status`. stdout reads `Duration: indefinite`.
- **Replace without a TTY.** Run `V cli replace -- on --no-wake`. stdout reads `⚠ Caffeinate is already running` and then `Caffeinate started`. `caffeinate-after.txt` shows one process, `caffeinate -ims`, with a new PID.
- **Decline at a terminal.** Run `V pty decline 'wait:(y/n)' send:n wait:Cancelled. -- on`. The transcript shows `Kill existing and start indefinite? (y/n) n` and `Cancelled.`. `caffeinate-after.txt` shows the same PID as `caffeinate-before.txt`.
- **Stop.** Run `V cli off -- off`. stdout reads `☕ Caffeinate stopped`. `caffeinate-after.txt` reads `(none)`.
- **Stop when idle.** Run `V cli off-idle -- off`. stdout reads `No caffeinate running` and exit is `0`.
- **Clean up.** Run `V cleanup`.

## Gotchas

- `latte off` runs `pkill -x caffeinate` and stops every `caffeinate` the user owns, not only latte's. That is why the helper refuses it while a foreign one is alive.
- Under `cli` the replace prompt never shows. Drive `on-replace-prompt` through `pty`.
- A `pty` recipe that waits for `(y/n)` with nothing running fails with `latte exited while waiting`. Start a session first.
