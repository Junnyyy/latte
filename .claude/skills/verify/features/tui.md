# Interactive TUI

Running `latte` in a terminal opens an Ink dashboard. It shows live status, refreshes every second, and takes single-key commands to start, stop, time, wait for an app, keep the screen on, and pick exact flags.

## Sub-features

- `tui-open` draws `☕ latte`, the status block, and the action bar `[o] on  [x] off  [t] timed  [w] while  [s] screen ○  [f] advanced  [q] quit`.
- `tui-on` starts an indefinite session with `o`. With a session running, `o` asks `Caffeinate is already running. Replace?` and `y` or `n` answers.
- `tui-off` stops the session with `x`.
- `tui-timed` opens a `Duration:` input with `t`. `enter` starts the timer, `esc` cancels, and invalid input shows `is not a valid duration`.
- `tui-timed-replace` asks `Caffeinate is already running. Replace?` when a duration is entered while a session runs, and `y` starts the timer.
- `tui-while` opens a `Stay awake while:` input with `w`. `enter` resolves the app name or PID the same way `--while` does and starts `caffeinate -w <pid>`. With a session running, it asks `Caffeinate is already running. Replace?` first. A name that is not running or a dead PID shows the error under the input and starts nothing.
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
- **Screen then replace.** With a session running, run `V pty screen 'wait:● Active' 'wait:[s] screen ○' send:s 'wait:[s] screen ●' 'wait:Next start: Mac and screen stay awake. Press o, t, or w to apply.' send:o 'wait:Replace?' send:y 'wait:Mac and screen stay awake' send:q`. After `s`, a frame shows `Next start: Mac and screen stay awake. Press o, t, or w to apply.` The last frame shows `Mac and screen stay awake` and no `Next start` line. `caffeinate-after.txt` shows `caffeinate -dis` with a new PID.
- **Advanced flags then replace.** With a session running, run `V pty flags 'wait:● Active' send:f 'wait:[r] reset' send:m 'wait:[m] disk ●' key:enter 'wait:[q] quit' send:o 'wait:Replace?' send:y 'wait:custom flags' send:q`. The last frame shows `custom flags -ims (idle, disk, system (AC))`. `caffeinate-after.txt` shows `caffeinate -ims` with a new PID.
- **While.** Start two disposable targets with `sleep 600 & echo $!`, twice. Write their PIDs as `<a>` and `<b>`. Run `V pty while-start wait:Inactive send:w 'wait:Stay awake while:' send:<a> key:enter 'wait:Until sleep exits' send:q`. `caffeinate-after.txt` shows `caffeinate -is -w <a>`. Then run `V pty while-replace 'wait:Until sleep exits' send:w 'wait:Stay awake while:' send:<b> key:enter 'wait:Replace?' send:y 'wait:PID <b>' send:q`. `caffeinate-after.txt` shows `caffeinate -is -w <b>` with a new PID.
- **While, missing.** Run `V pty while-missing wait:Inactive send:w 'wait:Stay awake while:' send:no-such-app key:enter "wait:no-such-app isn't running" key:esc 'wait:[q] quit' send:q`. `caffeinate-after.txt` equals `caffeinate-before.txt`.
- **While, exit.** With the `while-replace` session running, start `(sleep 3; kill <b>) &`, then run `V pty while-exit 'wait:Until sleep exits' wait:Inactive send:q`. `caffeinate-after.txt` reads `(none)`.
- **Confirm from outside.** Run `V cli status -- status` after any TUI recipe. It reports the same session the last frame showed.
- **Clean up.** Run `V cleanup`.

## Gotchas

- `tui-timed-replace` once looked broken: `enter` submitted `"90"` for a typed `90s`. The helper caused it. It waited with Tcl `sleep`, which does not read the PTY, so Ink's frames filled the PTY output buffer and latte blocked writing stderr. Keys sent meanwhile reached latte late, together with the next key. Every `pty` pause now keeps reading, and the recipe passed 4 of 4 runs against the same 0.2.1 build. If keys arrive late again, check that the driver reads output while it waits before suspecting latte.
- Ink draws a first frame before it reads the keyboard. A key sent too early is echoed into the terminal as text and lost. `wait:` pauses 0.3s after each match for this reason, so always `wait:` before a `send:`.
- The first frame of an active session shows `Running for 0s` before the elapsed time loads. Do not use `Running for` as a handle.
- The duration input accepts one letter or digit per keystroke. Pasted text is dropped, which is why `send:` types characters one at a time.
- Quitting the TUI from a real terminal leaves `caffeinate` running. A PTY whose session leader is latte itself kills it on hangup. The helper runs latte under a job-control shell to match a terminal tab. Closing the terminal window while the TUI is open is a different path, and this map does not cover it yet.
- The screen toggle and the picker edit one flag set. Turning on `d` in the picker also shows `[s] screen ●`. `s` changes only the next start. It does not restart a running session. While the choice differs from the running session, the dashboard shows a `Next start:` line.
- Flag picker and screen choices last only for the TUI session. They do not change `LATTE_FLAGS`.
