# Watch an app or process

`--while <app|pid>` keeps the Mac awake until that process exits. latte resolves the name to one PID and passes it to `caffeinate -w`. With a duration as well, `caffeinate` exits at whichever comes first.

## Sub-features

- `while-pid` starts `caffeinate -is -w <pid>` for a numeric PID and prints `On until <name> exits`.
- `while-exit` shows status as idle once the watched process exits.
- `while-timed` starts `caffeinate -is -w <pid> -t <seconds>` and prints `On for <duration> or until <name> exits`.
- `while-status` shows `Until: <name> exits (PID <pid>)` in `latte status` and `Until <name> exits (PID <pid>)` in the TUI.
- `while-ancestor` picks the Claude Code session latte runs inside when several sessions are open.
- `while-missing` fails with exit `1` for a name that is not running or a dead PID, and leaves any running `caffeinate` alone.

## How to get to it (user POV)

- Run `latte on --while <app|pid>`, or `latte <duration> --while <app|pid>`. Names include `claude`, `claude-desktop`, `code`, `cursor`, `codex`, and any app or executable name.

## Driving it with latte-verify

Preconditions:

- Baseline preconditions from the index hold.
- Start a disposable process to watch: `sleep 60 & echo $!`. Write its PID as `<sleep pid>`. The tool call that starts it must not wait for it.

- **Start.** Run `V cli while -- on --while <sleep pid>`. stdout reads `☕ On until sleep exits — Mac stays awake, screen can sleep`. `caffeinate-after.txt` shows `caffeinate -is -w <sleep pid>`.
- **Status.** Run `V cli status-while -- status`. stdout shows `Until: sleep exits (PID <sleep pid>)` and no `Duration: indefinite` line.
- **TUI status.** Run `V pty tui-while 'wait:Until sleep exits' send:q`.
- **Exit.** Run `kill <sleep pid>`, then `V cli status-after -- status`. stdout reads `☕ No caffeinate running`.
- **Timed.** Start a new `sleep 60`, then run `V cli while-timed -- 2m --while <sleep pid>`. stdout reads `☕ On for 2m or until sleep exits — ...`. `caffeinate-after.txt` shows `-w <sleep pid> -t 120`.
- **Ancestor.** From inside a Claude Code session with another session open, run `V cli while-claude -- on --while claude`. `caffeinate-after.txt` shows `-w` with the PID of the session that ran the command. Find it by walking `ps -o ppid=` up from the shell.
- **Missing.** Run `V cli while-missing -- on --while no-such-app` and `V cli while-dead -- on --while 999999`. Each exits `1` with a message on stderr, and `caffeinate-after.txt` equals `caffeinate-before.txt`.
- **Clean up.** Run `V cleanup` and kill any `sleep` you started.

## Gotchas

- `caffeinate` honors only the last `-w`, so a session watches one PID. Several matches for a name fail with a list of PIDs unless one is an ancestor of latte.
- `caffeinate -w` with a PID that does not exist exits at once. latte checks the PID before it starts `caffeinate`, so a missing target never replaces a running session.
- The `cli` driver runs latte from the verify helper, whose ancestors are the shell and the agent that called it. An ancestor match is real behavior here, not a test artifact.
