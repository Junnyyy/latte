# Interactive TUI

Running `latte` in a terminal opens an Ink dashboard. It shows live status, refreshes every second, and takes single-key commands to start, stop, time, keep the screen on, and pick exact flags.

## Sub-features

- `tui-open` draws `☕ latte`, the status block, and the action bar `[o] on  [x] off  [t] timed  [s] screen ○  [f] advanced  [q] quit`.
- `tui-on` starts an indefinite session with `o`. With a session running, `o` asks `Caffeinate is already running. Replace?` and `y` or `n` answers.
- `tui-off` stops the session with `x`.
- `tui-timed` opens a `Duration:` input with `t`. `enter` starts the timer, `esc` cancels, and invalid input shows `is not a valid duration`.
- `tui-timed-replace` asks `Caffeinate is already running. Replace?` when a duration is entered while a session runs, and `y` starts the timer.
- `tui-screen` toggles the display flag with `s`. The action bar shows `[s] screen ●` when it is on and `[s] screen ○` when it is off. The next start uses it.
- `tui-flags` opens the advanced picker with `f`. Letter keys toggle modes, `r` resets to the `awake` preset plus `LATTE_FLAGS`, `enter` keeps the choice for this TUI session, and `esc` discards it.
- `tui-quit` exits with `q` or `ctrl-c` and leaves the session running.

## How to get to it (user POV)

- Run `latte` with no arguments in a terminal.

## Driving it with latte-verify

Preconditions:

- Baseline preconditions from the index hold.

- **Open and start.** Run `V pty on wait:Inactive send:o 'wait:● Active' 'wait:Duration: indefinite' send:q`. The transcript shows `○ Inactive — no caffeinate running`, then `● Active — preventing sleep` over `Mac stays awake, screen can sleep`. `caffeinate-after.txt` shows `caffeinate -is`, still alive after the TUI quit.
- **Stop.** Run `V pty off 'wait:● Active' send:x wait:Inactive send:q`. `caffeinate-after.txt` reads `(none)`.
- **Timed.** Run `V pty timed wait:Inactive send:t wait:Duration: send:90s key:enter 'wait:● Active' 'wait:Remaining: 1m 2' send:q`. The transcript shows `Duration: 90s` and then a `Remaining:` countdown. `caffeinate-after.txt` shows `caffeinate -is -t 90`.
- **Replace with a timer.** With a session running, run `V pty timed-replace 'wait:● Active' send:t wait:Duration: send:90s key:enter 'wait:Replace?' send:y 'wait:Remaining: 1m 2' send:q`. `caffeinate-after.txt` shows `caffeinate -is -t 90` with a new PID.
- **Invalid duration.** Run `V pty bad-duration wait:Inactive send:t wait:Duration: send:abc key:enter 'wait:is not a valid duration' key:esc 'wait:[q] quit' send:q`. The transcript shows `"abc" is not a valid duration (use e.g. 30m, 2h, 90s)`, and `caffeinate-after.txt` reads `(none)`.
- **Screen then replace.** With a session running, run `V pty screen 'wait:● Active' 'wait:[s] screen ○' send:s 'wait:[s] screen ●' send:o 'wait:Replace?' send:y 'wait:Mac and screen stay awake' send:q`. The last frame shows `Mac and screen stay awake`. `caffeinate-after.txt` shows `caffeinate -dis` with a new PID.
- **Advanced flags then replace.** With a session running, run `V pty flags 'wait:● Active' send:f 'wait:[r] reset' send:m 'wait:[m] disk ●' key:enter 'wait:[q] quit' send:o 'wait:Replace?' send:y 'wait:custom flags' send:q`. The last frame shows `custom flags -ims (idle, disk, system (AC))`. `caffeinate-after.txt` shows `caffeinate -ims` with a new PID.
- **Confirm from outside.** Run `V cli status -- status` after any TUI recipe. It reports the same session the last frame showed.
- **Clean up.** Run `V cleanup`.

## Gotchas

- Known bug as of 0.2.1. `tui-timed-replace` fails. With a session running, the input shows `Duration: 90s █`, but `enter` submits the value without its last character and reports `"90" is not a valid duration`. It reproduced in 4 of 4 runs with a 1s pause before `enter`, and in 0 of 6 runs with no session running. Do not shorten the journey to pass it. Report it as failing until the bug is fixed.
- Ink draws a first frame before it reads the keyboard. A key sent too early is echoed into the terminal as text and lost. `wait:` pauses 0.3s after each match for this reason, so always `wait:` before a `send:`.
- The first frame of an active session shows `Running for 0s` before the elapsed time loads. Do not use `Running for` as a handle.
- The duration input accepts one letter or digit per keystroke. Pasted text is dropped, which is why `send:` types characters one at a time.
- Quitting the TUI from a real terminal leaves `caffeinate` running. A PTY whose session leader is latte itself kills it on hangup. The helper runs latte under a job-control shell to match a terminal tab. Closing the terminal window while the TUI is open is a different path, and this map does not cover it yet.
- The screen toggle and the picker edit one flag set. Turning on `d` in the picker also shows `[s] screen ●`. `s` changes only the next start. It does not restart a running session.
- Flag picker and screen choices last only for the TUI session. They do not change `LATTE_FLAGS`.
